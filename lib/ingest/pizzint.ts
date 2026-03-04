import crypto from "crypto";
import { db, signals } from "@/lib/db";

const PIZZINT_API_URL = "https://www.pizzint.watch/api/dashboard-data";

export interface PizzintData {
  success: boolean;
  data: PizzintPlace[];
  defcon_level: number;
  defcon_details: {
    at_time: string;
    defcon_severity_decimal: number;
    raw_index: number;
    smoothed_index: number;
    open_places: number;
    total_places: number;
    intensity_score: number;
    breadth_score: number;
    high_count: number;
    extreme_count: number;
    max_pct: number;
    max_current_popularity: number;
    sustained: boolean;
    sentinel: boolean;
    reason: string;
  };
  active_spikes: number;
  has_active_spikes: boolean;
  overall_index: number;
  timestamp: string;
}

export interface PizzintPlace {
  place_id: string;
  name: string;
  current_popularity: number | null;
  percentage_of_usual: number | null;
  is_spike: boolean;
  spike_magnitude: number | null;
  recorded_at: string;
  data_freshness: string;
  sparkline_24h: Array<{
    current_popularity: number | null;
    recorded_at: string;
  }>;
}

/**
 * Fetch PIZZINT data from the API
 */
export async function fetchPizzintData(): Promise<PizzintData | null> {
  try {
    const response = await fetch(`${PIZZINT_API_URL}?_t=${Date.now()}`, {
      headers: {
        "User-Agent": "WorldPulse/1.0",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`PIZZINT API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as PizzintData;
  } catch (error) {
    console.error("Error fetching PIZZINT data:", error);
    return null;
  }
}

/**
 * Analyze PIZZINT data for anomalies
 * Returns true if there's unusual activity that might indicate an event
 */
export function analyzePizzintAnomaly(data: PizzintData): {
  isAnomaly: boolean;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  score: number;
} {
  const { defcon_level, defcon_details, has_active_spikes, active_spikes } = data;

  // DEFCON levels: 5 = normal, 1 = critical
  // Lower = more severe
  if (defcon_level <= 2) {
    return {
      isAnomaly: true,
      severity: "critical",
      reason: `DEFCON ${defcon_level}: Critical activity detected near Pentagon. ${active_spikes} active spikes.`,
      score: 100,
    };
  }

  if (defcon_level === 3) {
    return {
      isAnomaly: true,
      severity: "high",
      reason: `DEFCON ${defcon_level}: High activity detected. Intensity: ${defcon_details.intensity_score}, Breadth: ${defcon_details.breadth_score}`,
      score: 80,
    };
  }

  if (defcon_level === 4 && has_active_spikes) {
    return {
      isAnomaly: true,
      severity: "medium",
      reason: `Elevated activity: ${active_spikes} pizza places with unusual traffic spikes`,
      score: 60,
    };
  }

  // Check for sustained unusual activity
  if (defcon_details.sustained) {
    return {
      isAnomaly: true,
      severity: "medium",
      reason: "Sustained unusual activity pattern detected",
      score: 50,
    };
  }

  // Check for high individual spikes
  if (defcon_details.max_pct > 150) {
    return {
      isAnomaly: true,
      severity: "low",
      reason: `Single location spike: ${defcon_details.max_pct}% of usual traffic`,
      score: 40,
    };
  }

  return {
    isAnomaly: false,
    severity: "low",
    reason: "Normal activity levels",
    score: 0,
  };
}

/**
 * Get places with current spikes
 */
export function getSpikingPlaces(data: PizzintData): PizzintPlace[] {
  return data.data.filter((place) => place.is_spike);
}

/**
 * Ingest PIZZINT data as a signal if anomaly detected
 */
export async function ingestPizzintSignal(): Promise<{
  fetched: boolean;
  inserted: number;
  isAnomaly: boolean;
  defconLevel: number;
}> {
  const data = await fetchPizzintData();

  if (!data || !data.success) {
    return { fetched: false, inserted: 0, isAnomaly: false, defconLevel: 5 };
  }

  const analysis = analyzePizzintAnomaly(data);

  // Only create signal if there's an anomaly
  if (!analysis.isAnomaly) {
    console.log(`PIZZINT: Normal activity (DEFCON ${data.defcon_level})`);
    return {
      fetched: true,
      inserted: 0,
      isAnomaly: false,
      defconLevel: data.defcon_level,
    };
  }

  console.log(`PIZZINT ANOMALY: ${analysis.reason}`);

  // Create unique hash based on defcon level and hour
  const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const hash = crypto
    .createHash("sha256")
    .update(`pizzint:${data.defcon_level}:${hourBucket}`)
    .digest("hex");

  const spikingPlaces = getSpikingPlaces(data);
  const placeNames = spikingPlaces.map((p) => p.name).join(", ");

  const title = `PIZZINT Alert: DEFCON ${data.defcon_level} - Pentagon Area Activity`;
  const content = `${analysis.reason}. ${
    spikingPlaces.length > 0
      ? `Spiking locations: ${placeNames}`
      : `Open places: ${data.defcon_details.open_places}/${data.defcon_details.total_places}`
  }`;

  try {
    await db.insert(signals).values({
      source: "pizzint",
      publishedAt: new Date(data.timestamp),
      url: "https://www.pizzint.watch",
      title,
      content,
      lang: "en",
      entities: {
        regions: ["NA"], // North America / US
        keywords: ["pentagon", "military", "anomaly", "intelligence"],
        category: "conflict",
        pizzint_data: {
          defcon_level: data.defcon_level,
          severity: analysis.severity,
          score: analysis.score,
          active_spikes: data.active_spikes,
          intensity: data.defcon_details.intensity_score,
          breadth: data.defcon_details.breadth_score,
        },
      } as any,
      hash,
    });

    console.log(`PIZZINT signal inserted: DEFCON ${data.defcon_level}`);

    return {
      fetched: true,
      inserted: 1,
      isAnomaly: true,
      defconLevel: data.defcon_level,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; cause?: { code?: string } };
    const isDuplicate =
      err.code === "23505" ||
      err.cause?.code === "23505" ||
      err.message?.includes("unique") ||
      err.message?.includes("duplicate");

    if (isDuplicate) {
      console.log("PIZZINT: Signal already exists for this hour");
      return {
        fetched: true,
        inserted: 0,
        isAnomaly: true,
        defconLevel: data.defcon_level,
      };
    }

    console.error("Error inserting PIZZINT signal:", error);
    return {
      fetched: true,
      inserted: 0,
      isAnomaly: true,
      defconLevel: data.defcon_level,
    };
  }
}
