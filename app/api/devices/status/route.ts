import { NextResponse } from "next/server";
import { db, devices } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";

export async function GET() {
  try {
    const session = await requireSession();

    const userDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, session.user.id));

    return NextResponse.json({
      registered: userDevices.length > 0,
      devices: userDevices.map((d) => ({
        id: d.id,
        platform: d.platform,
        lastSeen: d.lastSeen,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
