import { db, eventClusters } from '@/lib/db';
import { gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const activeClusters = await db
      .select({
        id: eventClusters.id,
        hypothesis: eventClusters.hypothesis,
        category: eventClusters.category,
        depth: eventClusters.depth,
        parentClusterId: eventClusters.parentClusterId,
        confidence: eventClusters.confidence,
        status: eventClusters.status,
        evidence: eventClusters.evidence,
      })
      .from(eventClusters)
      .where(gte(eventClusters.ttlExpiresAt, new Date()))
      .orderBy(eventClusters.depth, eventClusters.lastSeen);

    const clustersWithSignalCount = activeClusters.map((cluster) => ({
      ...cluster,
      signalCount:
        (cluster.evidence as { signalCount?: number })?.signalCount || 0,
    }));

    return NextResponse.json(clustersWithSignalCount);
  } catch (error) {
    console.error('Error fetching cluster tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster tree' },
      { status: 500 },
    );
  }
}
