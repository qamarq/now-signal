import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { db, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

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

    // Update subscription
    await db
      .update(subscriptions)
      .set({
        discordWebhook: webhookUrl,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving Discord webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove webhook from subscription
    await db
      .update(subscriptions)
      .set({
        discordWebhook: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing Discord webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
