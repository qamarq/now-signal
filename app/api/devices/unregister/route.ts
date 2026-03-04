import { NextResponse } from "next/server";
import { db, devices } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";

export async function POST() {
  try {
    const session = await requireSession();

    // Delete all devices for user
    await db.delete(devices).where(eq(devices.userId, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unregistering devices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
