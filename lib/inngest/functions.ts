import { inngest } from './client';
import { ingestRSSFeeds } from '@/lib/ingest/rss';
import { ingestPizzintSignal } from '@/lib/ingest/pizzint';
import { ingestGoogleTrends } from '@/lib/ingest/google-trends';
import {
  clusterSignals,
  rescoreAllClusters,
  mergeSimilarClusters,
} from '@/lib/clustering';
import { processNotifications } from '@/lib/notifications';

export const nowSignalPipeline = inngest.createFunction(
  {
    id: 'now-signal-pipeline',
    name: 'Now Signal Pipeline',
  },
  { cron: '1 */4 * * *' },
  async ({ step, logger }) => {
    logger.info('Starting Now Signal pipeline...');

    // Step 1: Fetch and ingest RSS feeds
    const ingestResult = await step.run('ingest-rss', async () => {
      return await ingestRSSFeeds();
    });
    logger.info(`RSS ingest: ${ingestResult.inserted} new signals`);

    // Step 1b: Check PIZZINT (Pentagon pizza activity)
    const pizzintResult = await step.run('ingest-pizzint', async () => {
      return await ingestPizzintSignal();
    });
    if (pizzintResult.isAnomaly) {
      logger.warn(`PIZZINT ALERT: DEFCON ${pizzintResult.defconLevel}!`);
    } else {
      logger.info(`PIZZINT: Normal (DEFCON ${pizzintResult.defconLevel})`);
    }

    // Step 1c: Fetch Google Trends
    const trendsResult = await step.run('ingest-google-trends', async () => {
      return await ingestGoogleTrends();
    });
    logger.info(
      `Google Trends: ${trendsResult.inserted} new signals (${trendsResult.duplicates} duplicates)`,
    );

    const clusterResult = await step.run('cluster-signals', async () => {
      return await clusterSignals();
    });
    logger.info(
      `Clustering: ${clusterResult.processed} signals, ${clusterResult.clustersCreated} new clusters`,
    );

    const rescoreCount = await step.run('rescore-clusters', async () => {
      return await rescoreAllClusters();
    });
    logger.info(`Rescored ${rescoreCount} clusters`);

    const mergeResult = await step.run('merge-similar-clusters', async () => {
      return await mergeSimilarClusters();
    });
    logger.info(
      `Cluster merging: ${mergeResult.merged} merged, ${mergeResult.threads} threads, ${mergeResult.subClustersCreated} sub-clusters`,
    );

    // Step 4: Process notifications
    const notificationResult = await step.run(
      'process-notifications',
      async () => {
        return await processNotifications();
      },
    );
    logger.info(
      `Notifications: ${notificationResult.sent} sent, ${notificationResult.skipped} skipped`,
    );

    return {
      ingest: ingestResult,
      pizzint: pizzintResult,
      googleTrends: trendsResult,
      clustering: clusterResult,
      rescored: rescoreCount,
      merging: mergeResult,
      notifications: notificationResult,
    };
  },
);

// Manual trigger for testing
export const manualPipelineTrigger = inngest.createFunction(
  {
    id: 'now-signal-manual',
    name: 'Now Signal Manual Trigger',
  },
  { event: 'now-signal/manual-run' },
  async ({ step, logger }) => {
    logger.info('Manual pipeline trigger...');

    const ingestResult = await step.run('ingest-rss', async () => {
      return await ingestRSSFeeds();
    });

    const pizzintResult = await step.run('ingest-pizzint', async () => {
      return await ingestPizzintSignal();
    });

    const trendsResult = await step.run('ingest-google-trends', async () => {
      return await ingestGoogleTrends();
    });

    const clusterResult = await step.run('cluster-signals', async () => {
      return await clusterSignals();
    });

    const rescoreCount = await step.run('rescore-clusters', async () => {
      return await rescoreAllClusters();
    });

    const mergeResult = await step.run('merge-similar-clusters', async () => {
      return await mergeSimilarClusters();
    });

    const notificationResult = await step.run(
      'process-notifications',
      async () => {
        return await processNotifications();
      },
    );

    return {
      ingest: ingestResult,
      pizzint: pizzintResult,
      googleTrends: trendsResult,
      clustering: clusterResult,
      rescored: rescoreCount,
      merging: mergeResult,
      notifications: notificationResult,
    };
  },
);

// Cleanup expired clusters (runs daily)
export const cleanupExpiredClusters = inngest.createFunction(
  {
    id: 'cleanup-expired-clusters',
    name: 'Cleanup Expired Clusters',
  },
  { cron: '0 0 * * *' }, // Daily at midnight
  async ({ step, logger }) => {
    const { db, eventClusters } = await import('@/lib/db');
    const { lt } = await import('drizzle-orm');

    const deleted = await step.run('delete-expired', async () => {
      const result = await db
        .delete(eventClusters)
        .where(lt(eventClusters.ttlExpiresAt, new Date()))
        .returning({ id: eventClusters.id });
      return result.length;
    });

    logger.info(`Cleaned up ${deleted} expired clusters`);
    return { deleted };
  },
);

// Export all functions
export const functions = [
  nowSignalPipeline,
  manualPipelineTrigger,
  cleanupExpiredClusters,
];
