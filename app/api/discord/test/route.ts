import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { testDiscordWebhook } from "@/lib/discord";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { webhookUrl } = body;

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return NextResponse.json(
        { error: "Webhook URL is required" },
        { status: 400 }
      );
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      return NextResponse.json(
        { error: "Invalid Discord webhook URL" },
        { status: 400 }
      );
    }

    const result = await testDiscordWebhook(webhookUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test message" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error testing Discord webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
