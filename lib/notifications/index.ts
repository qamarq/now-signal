import {
  db,
  eventClusters,
  subscriptions,
  devices,
  notificationLog,
} from "@/lib/db";
import { eq, gte, and, or, sql, inArray, not, lt } from "drizzle-orm";
import { sendPushNotification, cleanupInvalidTokens } from "@/lib/firebase-admin";
import { shouldNotifyUser, isMajorUpdate } from "@/lib/clustering/scoring";
import { SENSITIVITY_THRESHOLDS } from "@/lib/constants";

const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MAJOR_UPDATE_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

interface NotificationResult {
  sent: number;
  skipped: number;
  errors: number;
}

export async function processNotifications(): Promise<NotificationResult> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // Get active clusters that need notification processing
  const activeClusters = await db
    .select()
    .from(eventClusters)
    .where(
      and(
        gte(eventClusters.ttlExpiresAt, new Date()),
        or(
          // Newly confirmed events
          and(
            eq(eventClusters.status, "confirmed"),
            or(
              sql`${eventClusters.lastNotifiedStatus} IS NULL`,
              not(eq(eventClusters.lastNotifiedStatus, "confirmed"))
            )
          ),
          // Early events that haven't been notified
          and(
            eq(eventClusters.status, "early"),
            sql`${eventClusters.lastNotifiedStatus} IS NULL`
          ),
          // Potential major updates (confirmed events with changed confidence)
          and(
            eq(eventClusters.status, "confirmed"),
            eq(eventClusters.lastNotifiedStatus, "confirmed"),
            lt(
              eventClusters.lastNotifiedAt,
              new Date(Date.now() - MAJOR_UPDATE_COOLDOWN_MS)
            )
          )
        )
      )
    );

  for (const cluster of activeClusters) {
    try {
      const result = await processClusterNotifications(cluster);
      sent += result.sent;
      skipped += result.skipped;
      errors += result.errors;
    } catch (error) {
      console.error(`Error processing notifications for cluster ${cluster.id}:`, error);
      errors++;
    }
  }

  return { sent, skipped, errors };
}

async function processClusterNotifications(
  cluster: typeof eventClusters.$inferSelect
): Promise<NotificationResult> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  const notificationType = determineNotificationType(cluster);
  if (!notificationType) {
    return { sent: 0, skipped: 1, errors: 0 };
  }

  // Find matching users
  const matchingUsers = await findMatchingUsers(cluster, notificationType);

  for (const user of matchingUsers) {
    try {
      const result = await sendUserNotification(user, cluster, notificationType);
      if (result.sent) {
        sent++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error sending notification to user ${user.userId}:`, error);
      errors++;
    }
  }

  // Update cluster notification status if we sent any
  if (sent > 0) {
    await db
      .update(eventClusters)
      .set({
        lastNotifiedStatus: cluster.status,
        lastNotifiedAt: new Date(),
      })
      .where(eq(eventClusters.id, cluster.id));
  }

  return { sent, skipped, errors };
}

function determineNotificationType(
  cluster: typeof eventClusters.$inferSelect
): "confirmed" | "early" | "major_update" | null {
  if (cluster.status === "confirmed") {
    if (
      !cluster.lastNotifiedStatus ||
      cluster.lastNotifiedStatus !== "confirmed"
    ) {
      return "confirmed";
    }

    // Check for major update
    const evidence = cluster.evidence as {
      uniqueDomains?: string[];
    } | null;

    // For major updates, we'd need to compare with previous state
    // For MVP, we'll just check if enough time has passed
    if (
      cluster.lastNotifiedAt &&
      Date.now() - cluster.lastNotifiedAt.getTime() >= MAJOR_UPDATE_COOLDOWN_MS
    ) {
      // Simple heuristic: if confidence is high, consider it a major update opportunity
      if (cluster.confidence >= 80) {
        return "major_update";
      }
    }
    return null;
  }

  if (cluster.status === "early" && !cluster.lastNotifiedStatus) {
    return "early";
  }

  return null;
}

interface MatchingUser {
  userId: string;
  subscription: typeof subscriptions.$inferSelect;
  deviceTokens: string[];
}

async function findMatchingUsers(
  cluster: typeof eventClusters.$inferSelect,
  notificationType: "confirmed" | "early" | "major_update"
): Promise<MatchingUser[]> {
  // Get all subscriptions that match this cluster
  const allSubscriptions = await db.select().from(subscriptions);

  const matchingUsers: MatchingUser[] = [];

  for (const sub of allSubscriptions) {
    // Check if user wants early notifications
    if (notificationType === "early" && !sub.earlyEnabled) {
      continue;
    }

    // Check category match (empty = all)
    if (sub.categories.length > 0 && !sub.categories.includes(cluster.category)) {
      continue;
    }

    // Check region match (empty = all)
    if (sub.regions.length > 0) {
      const hasMatchingRegion = cluster.regions.some((r) =>
        sub.regions.includes(r)
      );
      if (!hasMatchingRegion) {
        continue;
      }
    }

    // Check sensitivity threshold for early notifications
    if (notificationType === "early") {
      const sensitivity = sub.sensitivity as keyof typeof SENSITIVITY_THRESHOLDS;
      if (!shouldNotifyUser(cluster.earlyScore, sensitivity)) {
        continue;
      }
    }

    // Check quiet hours
    if (isInQuietHours(sub.quietHoursStart, sub.quietHoursEnd)) {
      continue;
    }

    // Check daily limit
    const dailyCount = await getDailyNotificationCount(sub.userId);
    if (dailyCount >= sub.maxPushPerDay) {
      continue;
    }

    // Check deduplication
    const alreadySent = await checkDeduplication(
      sub.userId,
      cluster.id,
      notificationType
    );
    if (alreadySent) {
      continue;
    }

    // Get user's device tokens
    const userDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, sub.userId));

    if (userDevices.length > 0) {
      matchingUsers.push({
        userId: sub.userId,
        subscription: sub,
        deviceTokens: userDevices.map((d) => d.fcmToken),
      });
    }
  }

  return matchingUsers;
}

function isInQuietHours(
  start: number | null,
  end: number | null
): boolean {
  if (start === null || end === null) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();

  if (start <= end) {
    // Normal range (e.g., 22-08 doesn't wrap)
    return currentHour >= start && currentHour < end;
  } else {
    // Wrapped range (e.g., 22-08 wraps midnight)
    return currentHour >= start || currentHour < end;
  }
}

async function getDailyNotificationCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        gte(notificationLog.sentAt, today)
      )
    )
    .then((rows) => Number(rows[0]?.count || 0));

  return count;
}

async function checkDeduplication(
  userId: string,
  clusterId: string,
  type: string
): Promise<boolean> {
  const cooldown = type === "major_update" 
    ? MAJOR_UPDATE_COOLDOWN_MS 
    : NOTIFICATION_COOLDOWN_MS;
  
  const cutoff = new Date(Date.now() - cooldown);

  const existing = await db
    .select()
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.clusterId, clusterId),
        eq(notificationLog.type, type),
        gte(notificationLog.sentAt, cutoff)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  return !!existing;
}

async function sendUserNotification(
  user: MatchingUser,
  cluster: typeof eventClusters.$inferSelect,
  type: "confirmed" | "early" | "major_update"
): Promise<{ sent: boolean }> {
  const title = formatNotificationTitle(cluster, type);
  const body = formatNotificationBody(cluster);

  const result = await sendPushNotification(user.deviceTokens, {
    title,
    body,
    data: {
      clusterId: cluster.id,
      status: cluster.status,
      url: `/events/${cluster.id}`,
    },
  });

  // Clean up invalid tokens
  if (result.failedTokens.length > 0) {
    await cleanupInvalidTokens(result.failedTokens);
  }

  // Log notification
  if (result.success > 0) {
    const dedupeKey = `${user.userId}:${cluster.id}:${type}:${Date.now()}`;

    await db.insert(notificationLog).values({
      userId: user.userId,
      clusterId: cluster.id,
      type,
      dedupeKey,
    });

    return { sent: true };
  }

  return { sent: false };
}

function formatNotificationTitle(
  cluster: typeof eventClusters.$inferSelect,
  type: "confirmed" | "early" | "major_update"
): string {
  const prefix = {
    confirmed: "CONFIRMED",
    early: "EARLY",
    major_update: "UPDATE",
  }[type];

  const regions = cluster.regions.join(", ");
  return `${prefix}: ${regions}`;
}

function formatNotificationBody(
  cluster: typeof eventClusters.$inferSelect
): string {
  const hypothesis = cluster.hypothesis || "Developing event detected";
  // Truncate to ~120 chars
  return hypothesis.length > 120
    ? hypothesis.slice(0, 117) + "..."
    : hypothesis;
}
