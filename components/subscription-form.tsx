"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, REGIONS } from "@/lib/constants";

interface Subscription {
  id: string;
  userId: string;
  categories: string[];
  regions: string[];
  sensitivity: string;
  earlyEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  maxPushPerDay: number;
}

interface Props {
  subscription: Subscription;
}

export function SubscriptionForm({ subscription }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>(
    subscription.categories
  );
  const [regions, setRegions] = useState<string[]>(subscription.regions);
  const [sensitivity, setSensitivity] = useState(subscription.sensitivity);
  const [earlyEnabled, setEarlyEnabled] = useState(subscription.earlyEnabled);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    subscription.quietHoursStart !== null
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    subscription.quietHoursStart ?? 22
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    subscription.quietHoursEnd ?? 8
  );
  const [maxPushPerDay, setMaxPushPerDay] = useState(subscription.maxPushPerDay);

  const handleCategoryChange = (value: string, checked: boolean) => {
    if (checked) {
      setCategories([...categories, value]);
    } else {
      setCategories(categories.filter((c) => c !== value));
    }
  };

  const handleRegionChange = (value: string, checked: boolean) => {
    if (checked) {
      setRegions([...regions, value]);
    } else {
      setRegions(regions.filter((r) => r !== value));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          regions,
          sensitivity,
          earlyEnabled,
          quietHoursStart: quietHoursEnabled ? quietHoursStart : null,
          quietHoursEnd: quietHoursEnabled ? quietHoursEnd : null,
          maxPushPerDay,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update subscription");
      }

      toast.success("Settings saved successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Select the types of events you want to be notified about
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((category) => (
              <div key={category.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.value}`}
                  checked={categories.includes(category.value)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`category-${category.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {category.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regions</CardTitle>
          <CardDescription>
            Select the regions you want to monitor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {REGIONS.map((region) => (
              <div key={region.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`region-${region.value}`}
                  checked={regions.includes(region.value)}
                  onCheckedChange={(checked) =>
                    handleRegionChange(region.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`region-${region.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {region.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Configure how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Early Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications for unconfirmed events based on early
                signals
              </p>
            </div>
            <Switch
              checked={earlyEnabled}
              onCheckedChange={setEarlyEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Sensitivity</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Higher sensitivity means more notifications for lower confidence
              events
            </p>
            <Select value={sensitivity} onValueChange={setSensitivity}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (80%+ confidence)</SelectItem>
                <SelectItem value="med">Medium (70%+ confidence)</SelectItem>
                <SelectItem value="high">High (60%+ confidence)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPush">Max Notifications Per Day</Label>
            <Input
              id="maxPush"
              type="number"
              min={1}
              max={50}
              value={maxPushPerDay}
              onChange={(e) => setMaxPushPerDay(Number(e.target.value))}
              className="w-[200px]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Quiet Hours</Label>
                <p className="text-sm text-muted-foreground">
                  Don't send notifications during these hours
                </p>
              </div>
              <Switch
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
              />
            </div>
            {quietHoursEnabled && (
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label htmlFor="quietStart">Start</Label>
                  <Select
                    value={String(quietHoursStart)}
                    onValueChange={(v) => setQuietHoursStart(Number(v))}
                  >
                    <SelectTrigger id="quietStart" className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quietEnd">End</Label>
                  <Select
                    value={String(quietHoursEnd)}
                    onValueChange={(v) => setQuietHoursEnd(Number(v))}
                  >
                    <SelectTrigger id="quietEnd" className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
