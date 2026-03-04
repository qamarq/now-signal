"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  userId: string;
}

export function NotificationSettings({ userId }: Props) {
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "default" | "unsupported"
  >("default");
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    setChecking(true);
    try {
      // Check if notifications are supported
      if (!("Notification" in window)) {
        setPermissionStatus("unsupported");
        return;
      }

      setPermissionStatus(Notification.permission as "granted" | "denied" | "default");

      // Check if device is registered
      const response = await fetch("/api/devices/status");
      if (response.ok) {
        const data = await response.json();
        setIsRegistered(data.registered);
      }
    } catch (error) {
      console.error("Error checking notification status:", error);
    } finally {
      setChecking(false);
    }
  };

  const enableNotifications = async () => {
    if (permissionStatus === "unsupported") {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    setLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as "granted" | "denied" | "default");

      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      // Get Firebase messaging token
      const { getToken, getMessaging } = await import("firebase/messaging");
      const { initializeApp, getApps } = await import("firebase/app");

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      // Initialize Firebase
      const app =
        getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const messaging = getMessaging(app);

      // Register service worker
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      // Get FCM token
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        throw new Error("Failed to get FCM token");
      }

      // Register device with backend
      const response = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (!response.ok) {
        throw new Error("Failed to register device");
      }

      setIsRegistered(true);
      toast.success("Push notifications enabled successfully");
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Failed to enable push notifications");
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/devices/unregister", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to unregister device");
      }

      setIsRegistered(false);
      toast.success("Push notifications disabled");
    } catch (error) {
      console.error("Error disabling notifications:", error);
      toast.error("Failed to disable push notifications");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking notification status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isRegistered ? (
            <>
              <Bell className="h-5 w-5 text-green-500" />
              Push Notifications Enabled
            </>
          ) : (
            <>
              <BellOff className="h-5 w-5 text-muted-foreground" />
              Push Notifications Disabled
            </>
          )}
        </CardTitle>
        <CardDescription>
          {permissionStatus === "unsupported"
            ? "Push notifications are not supported in this browser"
            : isRegistered
            ? "You will receive push notifications for events matching your subscriptions"
            : "Enable push notifications to get real-time alerts"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Browser permission:</span>
          <Badge
            variant={
              permissionStatus === "granted"
                ? "default"
                : permissionStatus === "denied"
                ? "destructive"
                : "secondary"
            }
          >
            {permissionStatus === "granted" && (
              <CheckCircle className="h-3 w-3 mr-1" />
            )}
            {permissionStatus === "denied" && (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {permissionStatus}
          </Badge>
        </div>

        {permissionStatus === "denied" && (
          <p className="text-sm text-destructive">
            Notifications are blocked. Please enable them in your browser settings.
          </p>
        )}

        <div className="flex gap-2">
          {!isRegistered ? (
            <Button
              onClick={enableNotifications}
              disabled={loading || permissionStatus === "unsupported"}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enable Notifications
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={disableNotifications}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disable Notifications
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
