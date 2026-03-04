import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, signals } from "@/lib/db";
import { z } from "zod/v4";

const mockSignalSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  url: z.string().url().optional(),
  regions: z.array(z.string()).optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = mockSignalSchema.parse(body);

    const hash = crypto
      .createHash("sha256")
      .update(`mock:${data.title}:${Date.now()}`)
      .digest("hex");

    const publishedAt = data.publishedAt
      ? new Date(data.publishedAt)
      : new Date();

    const [signal] = await db
      .insert(signals)
      .values({
        source: "mock",
        publishedAt,
        url: data.url || `https://mock.worldpulse.local/${hash}`,
        title: data.title,
        content: data.content || null,
        lang: "en",
        entities: {
          regions: data.regions || ["GLOBAL"],
          keywords: data.keywords || [],
          category: data.category || "other",
        },
        hash,
      })
      .returning();

    return NextResponse.json({
      success: true,
      signal: {
        id: signal.id,
        title: signal.title,
        hash: signal.hash,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating mock signal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper endpoint to generate multiple mock signals for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get("count") || "5", 10);
  const category = searchParams.get("category") || "conflict";
  const region = searchParams.get("region") || "ME";

  const mockTitles = [
    "Breaking: Major military operation reported in region",
    "Emergency evacuation ordered as situation escalates",
    "Government confirms multiple casualties in attack",
    "International community responds to crisis",
    "Peace talks collapse amid renewed violence",
    "Humanitarian crisis deepens as conflict continues",
    "UN Security Council calls emergency meeting",
    "Explosion reported near government buildings",
    "Military forces deployed to border region",
    "State of emergency declared following unrest",
  ];

  const inserted = [];

  for (let i = 0; i < Math.min(count, 10); i++) {
    const title = mockTitles[i % mockTitles.length];
    const hash = crypto
      .createHash("sha256")
      .update(`mock:${title}:${Date.now()}:${i}`)
      .digest("hex");

    // Stagger timestamps slightly
    const publishedAt = new Date(Date.now() - i * 60000); // 1 minute apart

    try {
      const [signal] = await db
        .insert(signals)
        .values({
          source: "mock",
          publishedAt,
          url: `https://mock.worldpulse.local/${hash}`,
          title: `${title} (${i + 1})`,
          content: `This is a mock signal for testing purposes. Category: ${category}, Region: ${region}`,
          lang: "en",
          entities: {
            regions: [region],
            keywords: ["attack", "military", "breaking", "emergency"],
            category,
          },
          hash,
        })
        .returning();

      inserted.push({
        id: signal.id,
        title: signal.title,
      });
    } catch (error) {
      console.error("Error inserting mock signal:", error);
    }
  }

  return NextResponse.json({
    success: true,
    inserted: inserted.length,
    signals: inserted,
  });
}
