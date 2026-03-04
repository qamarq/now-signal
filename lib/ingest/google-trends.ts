import crypto from "crypto";
import GoogleTrendsApi from "@shaivpidadi/trends-js";
import { db, signals } from "@/lib/db";
import { extractRegions, extractCategory, extractKeywords } from "./ner";

interface TrendingStory {
  title: string;
  traffic: string;
  articles: Array<{
    title?: string;
    url?: string;
    source?: string;
    snippet?: string;
  }>;
  shareUrl: string;
  startTime: number;
}

interface RealTimeTrendsResponse {
  data: {
    allTrendingStories: TrendingStory[];
  };
}

// Regions to fetch trends from (geo codes)
const TREND_REGIONS = [
  { geo: "US", region: "NA" },
  { geo: "GB", region: "EU" },
  { geo: "DE", region: "EU" },
  { geo: "FR", region: "EU" },
  { geo: "AU", region: "OC" },
  { geo: "IN", region: "AS" },
  { geo: "JP", region: "AS" },
  { geo: "BR", region: "SA" },
];

/**
 * Fetch real-time trends from Google Trends API
 */
export async function fetchRealTimeTrends(
  geo: string,
  trendingHours: number = 4
): Promise<TrendingStory[]> {
  try {
    const result: RealTimeTrendsResponse = await GoogleTrendsApi.realTimeTrends({
      geo,
      trendingHours,
    });

    if (!result.data?.allTrendingStories) {
      return [];
    }

    return result.data.allTrendingStories;
  } catch (error) {
    console.error(`Error fetching Google Trends for ${geo}:`, error);
    return [];
  }
}

/**
 * Convert a trending story to a signal
 */
function storyToSignal(story: TrendingStory, geo: string) {
  const title = story.title;

  // Build content from articles if available
  const articleSnippets = story.articles
    ?.map((a) => a.snippet || a.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const content =
    articleSnippets || `Trending search: ${story.title} (${story.traffic}+ searches)`;

  // Extract entities using our NER
  const fullText = `${title} ${content}`;
  const detectedRegions = extractRegions(fullText);
  const detectedCategory = extractCategory(fullText);
  const keywords = extractKeywords(fullText);

  // Map geo to our region if NER didn't detect anything specific
  const geoRegion = TREND_REGIONS.find((r) => r.geo === geo)?.region || "GLOBAL";
  const regions =
    detectedRegions.length === 1 && detectedRegions[0] === "GLOBAL"
      ? [geoRegion]
      : detectedRegions;

  // Create unique hash based on title + geo + hour
  const hourBucket = new Date().toISOString().slice(0, 13);
  const hash = crypto
    .createHash("sha256")
    .update(`gtrends:${title}:${geo}:${hourBucket}`)
    .digest("hex");

  // Parse traffic number
  const trafficNum = parseInt(story.traffic.replace(/[^0-9]/g, ""), 10) || 0;

  return {
    source: "google_trends" as const,
    publishedAt: story.startTime ? new Date(story.startTime * 1000) : new Date(),
    url:
      story.articles?.[0]?.url ||
      `https://trends.google.com/trends/trendingsearches/realtime?geo=${geo}`,
    title,
    content,
    lang: "en",
    entities: {
      regions,
      keywords,
      category: detectedCategory,
      google_trends_data: {
        geo,
        traffic: trafficNum,
        article_count: story.articles?.length || 0,
      },
    },
    hash,
  };
}

/**
 * Ingest real-time trends from Google Trends
 * Fetches trends from multiple regions
 */
export async function ingestGoogleTrends(): Promise<{
  fetched: number;
  inserted: number;
  duplicates: number;
  errors: number;
}> {
  let fetched = 0;
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  // Rotate through regions - use a different set each run to avoid rate limiting
  const runIndex = Math.floor(Date.now() / (10 * 60 * 1000)) % TREND_REGIONS.length;
  const regionsToFetch = [
    TREND_REGIONS[runIndex],
    TREND_REGIONS[(runIndex + 1) % TREND_REGIONS.length],
    TREND_REGIONS[(runIndex + 2) % TREND_REGIONS.length],
  ];

  for (const { geo } of regionsToFetch) {
    try {
      // Add delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stories = await fetchRealTimeTrends(geo, 4);
      fetched += stories.length;

      console.log(`Google Trends: Fetched ${stories.length} stories from ${geo}`);

      // Process top 10 stories per region (filter by traffic >= 1000)
      const sortedStories = stories
        .filter((s) => parseInt(s.traffic.replace(/[^0-9]/g, ""), 10) >= 1000)
        .slice(0, 10);

      for (const story of sortedStories) {
        const signalData = storyToSignal(story, geo);

        try {
          await db.insert(signals).values(signalData);
          inserted++;
          console.log(
            `Google Trends: Inserted "${story.title}" from ${geo} (${story.traffic} searches)`
          );
        } catch (error: unknown) {
          const err = error as {
            code?: string;
            message?: string;
            cause?: { code?: string };
          };
          const isDuplicate =
            err.code === "23505" ||
            err.cause?.code === "23505" ||
            err.message?.includes("unique") ||
            err.message?.includes("duplicate");

          if (isDuplicate) {
            duplicates++;
          } else {
            errors++;
            console.error(`Error inserting Google Trends signal:`, error);
          }
        }
      }
    } catch (error) {
      errors++;
      console.error(`Error fetching trends for ${geo}:`, error);
    }
  }

  console.log(
    `Google Trends: Fetched ${fetched}, Inserted ${inserted}, Duplicates ${duplicates}, Errors ${errors}`
  );

  return { fetched, inserted, duplicates, errors };
}
