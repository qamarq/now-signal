"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DiscordWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (webhookUrl: string) => void;
}

export function DiscordWebhookDialog({
  open,
  onOpenChange,
  onSuccess,
}: DiscordWebhookDialogProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      toast.error("Invalid Discord webhook URL format");
      return;
    }

    setTesting(true);
    try {
      const response = await fetch("/api/discord/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to test webhook");
      }

      toast.success("Test message sent successfully! Check your Discord channel.");
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to test webhook"
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      toast.error("Invalid Discord webhook URL format");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/discord/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save webhook");
      }

      toast.success("Discord webhook connected successfully!");
      onSuccess(webhookUrl);
      setWebhookUrl("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving webhook:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save webhook"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setWebhookUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Connect Discord Webhook</DialogTitle>
          <DialogDescription>
            Enter your Discord webhook URL to receive notifications in your
            channel. You can create a webhook in your Discord server settings
            under Integrations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={testing || saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={testing || saving}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || saving || !webhookUrl.trim()}
          >
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test
          </Button>
          <Button
            onClick={handleSave}
            disabled={testing || saving || !webhookUrl.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
