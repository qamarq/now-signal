import { eventClusters } from "@/lib/db";

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp: string;
  footer?: {
    text: string;
  };
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

export async function sendDiscordNotification(
  webhookUrl: string,
  cluster: typeof eventClusters.$inferSelect,
  type: "confirmed" | "early" | "major_update"
): Promise<{ success: boolean; error?: string }> {
  try {
    const embed = createDiscordEmbed(cluster, type);
    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord webhook error:", errorText);
      return {
        success: false,
        error: `Discord API error: ${response.status} ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending Discord notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function createDiscordEmbed(
  cluster: typeof eventClusters.$inferSelect,
  type: "confirmed" | "early" | "major_update"
): DiscordEmbed {
  // Kolory dla różnych typów
  const colors = {
    confirmed: 0x3b82f6, // niebieski
    early: 0xf97316, // pomarańczowy
    major_update: 0x8b5cf6, // fioletowy
  };

  const typeLabels = {
    confirmed: "CONFIRMED EVENT",
    early: "EARLY SIGNAL",
    major_update: "MAJOR UPDATE",
  };

  const evidence = cluster.evidence as {
    sources?: string[];
    signalCount?: number;
    uniqueDomains?: string[];
    keywords?: string[];
  } | null;

  const fields: DiscordEmbed["fields"] = [
    {
      name: "Category",
      value: cluster.category,
      inline: true,
    },
    {
      name: "Regions",
      value: cluster.regions.join(", ") || "N/A",
      inline: true,
    },
    {
      name: "Confidence",
      value: `${cluster.confidence}%`,
      inline: true,
    },
  ];

  if (evidence) {
    if (evidence.signalCount) {
      fields.push({
        name: "Signal Count",
        value: String(evidence.signalCount),
        inline: true,
      });
    }
    if (evidence.uniqueDomains && evidence.uniqueDomains.length > 0) {
      fields.push({
        name: "Sources",
        value: evidence.uniqueDomains.slice(0, 3).join(", "),
        inline: true,
      });
    }
    if (evidence.keywords && evidence.keywords.length > 0) {
      fields.push({
        name: "Keywords",
        value: evidence.keywords.slice(0, 5).join(", "),
        inline: false,
      });
    }
  }

  return {
    title: typeLabels[type],
    description: cluster.hypothesis || "Developing event detected",
    color: colors[type],
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Now Signal",
    },
  };
}

export async function testDiscordWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const testEmbed: DiscordEmbed = {
      title: "Test Connection",
      description: "This is a test message from Now Signal. Your Discord webhook is configured correctly!",
      color: 0x22c55e, // zielony
      fields: [
        {
          name: "Status",
          value: "Connected",
          inline: true,
        },
        {
          name: "Timestamp",
          value: new Date().toLocaleString(),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "Now Signal",
      },
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [testEmbed] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord webhook test error:", errorText);
      return {
        success: false,
        error: `Discord API error: ${response.status} ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error testing Discord webhook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
