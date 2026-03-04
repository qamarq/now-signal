import { NextRequest, NextResponse } from "next/server";
import { db, devices } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { z } from "zod/v4";

const registerSchema = z.object({
  fcmToken: z.string().min(1),
  platform: z.string().optional().default("web"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const data = registerSchema.parse(body);

    // Check if device already exists
    const existing = await db
      .select()
      .from(devices)
      .where(eq(devices.fcmToken, data.fcmToken))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      // Update existing device
      await db
        .update(devices)
        .set({
          userId: session.user.id,
          lastSeen: new Date(),
        })
        .where(eq(devices.fcmToken, data.fcmToken));
    } else {
      // Insert new device
      await db.insert(devices).values({
        userId: session.user.id,
        fcmToken: data.fcmToken,
        platform: data.platform,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error registering device:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
