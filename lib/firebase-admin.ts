import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let app: App | undefined;
let messaging: Messaging | undefined;

function getFirebaseAdmin() {
  if (!app) {
    const existingApps = getApps();
    
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) {
        console.warn("Firebase Admin credentials not configured");
        return null;
      }

      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  }

  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  if (!messaging) {
    const app = getFirebaseAdmin();
    if (!app) return null;
    messaging = getMessaging(app);
  }
  return messaging;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  tokens: string[],
  payload: PushPayload
): Promise<{ success: number; failure: number; failedTokens: string[] }> {
  const messaging = getFirebaseMessaging();
  
  if (!messaging) {
    console.warn("Firebase Messaging not initialized, skipping push");
    return { success: 0, failure: tokens.length, failedTokens: tokens };
  }

  if (tokens.length === 0) {
    return { success: 0, failure: 0, failedTokens: [] };
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      webpush: {
        fcmOptions: {
          link: payload.data?.url || "/dashboard",
        },
        notification: {
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
        },
      },
    });

    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push(tokens[idx]);
        console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
      }
    });

    console.log(`Push notification sent: ${response.successCount} success, ${response.failureCount} failure`);

    return {
      success: response.successCount,
      failure: response.failureCount,
      failedTokens,
    };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return { success: 0, failure: tokens.length, failedTokens: tokens };
  }
}

// Clean up invalid tokens from database
export async function cleanupInvalidTokens(failedTokens: string[]) {
  if (failedTokens.length === 0) return;

  const { db, devices } = await import("./db");
  const { inArray } = await import("drizzle-orm");

  try {
    await db.delete(devices).where(inArray(devices.fcmToken, failedTokens));
    console.log(`Cleaned up ${failedTokens.length} invalid tokens`);
  } catch (error) {
    console.error("Error cleaning up invalid tokens:", error);
  }
}
