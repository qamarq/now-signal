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
import { Input } from "@/components/ui/input";
import { Bell, BellOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { DiscordWebhookDialog } from "@/components/discord-webhook-dialog";

interface Props {
  userId: string;
  discordWebhook: string | null;
}

export function NotificationSettings({ userId, discordWebhook: initialWebhook }: Props) {
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "default" | "unsupported"
  >("default");
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [discordWebhook, setDiscordWebhook] = useState<string | null>(initialWebhook);
  const [showDiscordDialog, setShowDiscordDialog] = useState(false);
  const [removingWebhook, setRemovingWebhook] = useState(false);

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
      // Request permission and get token
      const { requestNotificationPermission } = await import("@/lib/firebase/requestNotificationPermission");
      const token = await requestNotificationPermission();

      if (!token) {
        const permission = Notification.permission;
        setPermissionStatus(permission as "granted" | "denied" | "default");
        
        if (permission === "denied") {
          toast.error("Notification permission denied");
        } else {
          toast.error("Failed to get notification token");
        }
        return;
      }

      // Update permission status
      setPermissionStatus("granted");

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

  const handleRemoveWebhook = async () => {
    setRemovingWebhook(true);
    try {
      const response = await fetch("/api/discord/webhook", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove webhook");
      }

      setDiscordWebhook(null);
      toast.success("Discord webhook removed");
    } catch (error) {
      console.error("Error removing webhook:", error);
      toast.error("Failed to remove Discord webhook");
    } finally {
      setRemovingWebhook(false);
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
    <div className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Discord Notifications</CardTitle>
          <CardDescription>
            Send notifications to a Discord channel via webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!discordWebhook ? (
            <Button
              onClick={() => setShowDiscordDialog(true)}
              variant="outline"
              className="w-full"
            >
              <svg
                className="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Connect Discord
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                value={discordWebhook}
                disabled
                className="font-mono text-sm"
              />
              <Button
                onClick={handleRemoveWebhook}
                disabled={removingWebhook}
                variant="destructive"
                className="w-full"
              >
                {removingWebhook && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Remove Webhook
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <DiscordWebhookDialog
        open={showDiscordDialog}
        onOpenChange={setShowDiscordDialog}
        onSuccess={(url) => setDiscordWebhook(url)}
      />
    </div>
  );
}
