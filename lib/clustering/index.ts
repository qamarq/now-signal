import crypto from "crypto";
import { db, signals, eventClusters, clusterSignals as clusterSignalsTable } from "@/lib/db";
import { eq, gte, desc } from "drizzle-orm";
import { calculateEarlyScore, calculateConfirmScore, determineStatus } from "./scoring";
import { generateHypothesis } from "@/lib/ai/matching";

// Time bucket: 4 hours (for grouping signals into clusters)
const TIME_BUCKET_MS = 4 * 60 * 60 * 1000;

export function getTimeBucket(date: Date): number {
  return Math.floor(date.getTime() / TIME_BUCKET_MS) * TIME_BUCKET_MS;
}

export function createClusterKey(
  category: string,
  regions: string[],
  timeBucket: number
): string {
  const sortedRegions = [...regions].sort().join(",");
  return crypto
    .createHash("sha256")
    .update(`${category}:${sortedRegions}:${timeBucket}`)
    .digest("hex")
    .slice(0, 32);
}

interface SignalWithEntities {
  id: string;
  publishedAt: Date;
  url: string;
  title: string;
  content: string | null;
  entities: {
    regions?: string[];
    keywords?: string[];
    category?: string;
  } | null;
}

export async function clusterSignals(): Promise<{
  processed: number;
  clustersCreated: number;
  clustersUpdated: number;
}> {
  // Get recent signals that haven't been clustered (last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const recentSignals = await db
    .select()
    .from(signals)
    .where(gte(signals.publishedAt, sixHoursAgo))
    .orderBy(desc(signals.publishedAt));

  // Get already clustered signal IDs
  const clusteredSignalIds = await db
    .select({ signalId: clusterSignalsTable.signalId })
    .from(clusterSignalsTable)
    .then((rows) => new Set(rows.map((r) => r.signalId)));

  // Filter to unclustered signals only
  const unclusteredSignals = recentSignals.filter(
    (s) => !clusteredSignalIds.has(s.id)
  );

  let processed = 0;
  let clustersCreated = 0;
  let clustersUpdated = 0;

  const clusterCache = new Map<string, string>(); // clusterKey -> clusterId

  for (const signal of unclusteredSignals) {
    const entities = signal.entities as SignalWithEntities["entities"];
    const category = entities?.category || "other";
    const regions = entities?.regions || ["GLOBAL"];
    const timeBucket = getTimeBucket(signal.publishedAt);
    const clusterKey = createClusterKey(category, regions, timeBucket);

    let clusterId = clusterCache.get(clusterKey);

    if (!clusterId) {
      // Check if cluster exists in DB
      const existingCluster = await db
        .select()
        .from(eventClusters)
        .where(eq(eventClusters.clusterKey, clusterKey))
        .limit(1)
        .then((rows) => rows[0]);

      if (existingCluster) {
        clusterId = existingCluster.id;
        clustersUpdated++;
      } else {
        // Create new cluster
        const now = new Date();
        const ttlExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h TTL

        const [newCluster] = await db
          .insert(eventClusters)
          .values({
            clusterKey,
            firstSeen: signal.publishedAt,
            lastSeen: signal.publishedAt,
            category,
            regions,
            status: "early",
            confidence: 0,
            earlyScore: 0,
            confirmScore: 0,
            hypothesis: signal.title,
            evidence: {
              sources: [signal.url],
              signalCount: 1,
              uniqueDomains: [extractDomain(signal.url)],
              keywords: entities?.keywords || [],
            },
            ttlExpiresAt: ttlExpires,
          })
          .returning();

        clusterId = newCluster.id;
        clustersCreated++;
      }

      clusterCache.set(clusterKey, clusterId);
    }

    // Link signal to cluster
    try {
      await db.insert(clusterSignalsTable).values({
        clusterId,
        signalId: signal.id,
      });
      processed++;

      // Update cluster metadata
      await updateClusterMetadata(clusterId);
    } catch (error) {
      // Ignore duplicate key errors
      if (!(error instanceof Error && error.message.includes("unique"))) {
        console.error("Error linking signal to cluster:", error);
      }
    }
  }

  console.log(
    `Clustering complete: ${processed} signals processed, ${clustersCreated} clusters created, ${clustersUpdated} clusters updated`
  );

  return { processed, clustersCreated, clustersUpdated };
}

async function updateClusterMetadata(clusterId: string) {
  // Get all signals for this cluster
  const clusterSignalRows = await db
    .select({
      signal: signals,
    })
    .from(clusterSignalsTable)
    .innerJoin(signals, eq(clusterSignalsTable.signalId, signals.id))
    .where(eq(clusterSignalsTable.clusterId, clusterId));

  if (clusterSignalRows.length === 0) return;

  const signalList = clusterSignalRows.map((r) => r.signal);

  // Calculate evidence
  const urls = signalList.map((s) => s.url);
  const domains = [...new Set(urls.map(extractDomain))];
  const allKeywords = new Set<string>();

  for (const signal of signalList) {
    const entities = signal.entities as SignalWithEntities["entities"];
    if (entities?.keywords) {
      entities.keywords.forEach((k) => allKeywords.add(k));
    }
  }

  // Get the most recent signal title as hypothesis
  const sortedByDate = [...signalList].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  
  // Use AI to generate better hypothesis if we have multiple signals
  let hypothesis = sortedByDate[0].title;
  if (signalList.length >= 3) {
    try {
      hypothesis = await generateHypothesis(signalList);
    } catch (error) {
      console.error("Error generating AI hypothesis:", error);
    }
  }

  // Calculate scores
  const earlyScore = calculateEarlyScore(signalList, domains);
  const confirmScore = calculateConfirmScore(signalList, domains);
  const { status, confidence } = determineStatus(earlyScore, confirmScore);

  // Get last seen time
  const lastSeen = sortedByDate[0].publishedAt;

  // Update cluster
  await db
    .update(eventClusters)
    .set({
      lastSeen,
      earlyScore,
      confirmScore,
      confidence,
      status,
      hypothesis,
      evidence: {
        sources: urls,
        signalCount: signalList.length,
        uniqueDomains: domains,
        keywords: Array.from(allKeywords).slice(0, 20),
      },
    })
    .where(eq(eventClusters.id, clusterId));
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// Re-score all active clusters (called periodically)
export async function rescoreAllClusters(): Promise<number> {
  const activeClusters = await db
    .select()
    .from(eventClusters)
    .where(gte(eventClusters.ttlExpiresAt, new Date()));

  let updated = 0;

  for (const cluster of activeClusters) {
    try {
      await updateClusterMetadata(cluster.id);
      updated++;
    } catch (error) {
      console.error(`Error rescoring cluster ${cluster.id}:`, error);
    }
  }

  console.log(`Rescored ${updated} clusters`);
  return updated;
}

/**
 * Merge similar clusters using AI semantic matching
 * This combines clusters that are about the same event but were created
 * in different time buckets or with slightly different categories
 */
export async function mergeSimilarClusters(): Promise<{
  merged: number;
  threads: number;
}> {
  const { suggestThreadMerge } = await import("@/lib/ai/matching");
  const { inArray } = await import("drizzle-orm");

  // Get active clusters from last 24 hours that aren't already merged
  const recentClusters = await db
    .select()
    .from(eventClusters)
    .where(gte(eventClusters.ttlExpiresAt, new Date()))
    .orderBy(desc(eventClusters.lastSeen));

  if (recentClusters.length < 2) {
    return { merged: 0, threads: 0 };
  }

  // Group clusters by category + region for more targeted merging
  const clusterGroups = new Map<string, typeof recentClusters>();
  
  for (const cluster of recentClusters) {
    // Create a loose grouping key (just category)
    const groupKey = cluster.category;
    
    const existing = clusterGroups.get(groupKey) || [];
    existing.push(cluster);
    clusterGroups.set(groupKey, existing);
  }

  let totalMerged = 0;
  let totalThreads = 0;

  // Process each group
  for (const [groupKey, clusters] of clusterGroups) {
    if (clusters.length < 2) continue;

    // Limit to 10 most recent clusters per group for AI processing
    const clustersToAnalyze = clusters.slice(0, 10);

    try {
      const mergesuggestions = await suggestThreadMerge(
        clustersToAnalyze.map((c) => ({
          id: c.id,
          hypothesis: c.hypothesis,
          category: c.category,
          regions: c.regions,
        }))
      );

      for (const suggestion of mergesuggestions) {
        if (suggestion.clusterIds.length < 2 || suggestion.confidence < 70) {
          continue;
        }

        // Get the clusters to merge
        const clustersToMerge = clustersToAnalyze.filter((c) =>
          suggestion.clusterIds.includes(c.id)
        );

        if (clustersToMerge.length < 2) continue;

        // Pick the cluster with most signals as the primary
        const primaryCluster = clustersToMerge.reduce((best, current) => {
          const bestEvidence = best.evidence as { signalCount?: number } | null;
          const currentEvidence = current.evidence as { signalCount?: number } | null;
          return (currentEvidence?.signalCount || 0) > (bestEvidence?.signalCount || 0)
            ? current
            : best;
        });

        const secondaryClusters = clustersToMerge.filter(
          (c) => c.id !== primaryCluster.id
        );

        // Move signals from secondary clusters to primary
        for (const secondary of secondaryClusters) {
          await db
            .update(clusterSignalsTable)
            .set({ clusterId: primaryCluster.id })
            .where(eq(clusterSignalsTable.clusterId, secondary.id));

          // Delete the secondary cluster
          await db
            .delete(eventClusters)
            .where(eq(eventClusters.id, secondary.id));

          totalMerged++;
        }

        // Update primary cluster with new thread name
        await db
          .update(eventClusters)
          .set({
            hypothesis: suggestion.threadName,
          })
          .where(eq(eventClusters.id, primaryCluster.id));

        // Re-calculate metadata for merged cluster
        await updateClusterMetadata(primaryCluster.id);

        totalThreads++;

        console.log(
          `Merged ${secondaryClusters.length} clusters into "${suggestion.threadName}" (confidence: ${suggestion.confidence}%)`
        );
      }
    } catch (error) {
      console.error(`Error merging clusters in group ${groupKey}:`, error);
    }
  }

  console.log(`Cluster merging complete: ${totalMerged} merged, ${totalThreads} threads created`);
  return { merged: totalMerged, threads: totalThreads };
}
