import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { z } from "zod/v4";

const updateSchema = z.object({
  categories: z.array(z.string()),
  regions: z.array(z.string()),
  sensitivity: z.enum(["low", "med", "high"]),
  earlyEnabled: z.boolean(),
  quietHoursStart: z.number().min(0).max(23).nullable(),
  quietHoursEnd: z.number().min(0).max(23).nullable(),
  maxPushPerDay: z.number().min(1).max(50),
});

export async function GET() {
  try {
    const session = await requireSession();

    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0]);

    return NextResponse.json(subscription || null);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const data = updateSchema.parse(body);

    // Upsert subscription
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      await db
        .update(subscriptions)
        .set({
          categories: data.categories,
          regions: data.regions,
          sensitivity: data.sensitivity,
          earlyEnabled: data.earlyEnabled,
          quietHoursStart: data.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd,
          maxPushPerDay: data.maxPushPerDay,
        })
        .where(eq(subscriptions.userId, session.user.id));
    } else {
      await db.insert(subscriptions).values({
        userId: session.user.id,
        ...data,
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
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
