import Parser from "rss-parser";
import crypto from "crypto";
import { db, signals } from "@/lib/db";
import { extractEntities } from "./ner";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "WorldPulse/1.0 (RSS Reader)",
  },
});

export interface RSSFeed {
  url: string;
  name?: string;
}

export function getRSSFeeds(): RSSFeed[] {
  const feedsEnv = process.env.RSS_FEEDS || "";
  return feedsEnv
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ url }));
}

export async function fetchRSSFeed(feedUrl: string): Promise<Parser.Item[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items || [];
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

export function createSignalHash(url: string, title: string): string {
  return crypto
    .createHash("sha256")
    .update(`${url}:${title}`)
    .digest("hex");
}

export async function ingestRSSFeeds(): Promise<{
  fetched: number;
  inserted: number;
  duplicates: number;
}> {
  const feeds = getRSSFeeds();
  let fetched = 0;
  let inserted = 0;
  let duplicates = 0;

  console.log(`Fetching ${feeds.length} RSS feeds...`);

  for (const feed of feeds) {
    try {
      const items = await fetchRSSFeed(feed.url);
      fetched += items.length;

      for (const item of items) {
        if (!item.link || !item.title) continue;

        const hash = createSignalHash(item.link, item.title);
        const content = item.contentSnippet || item.content || "";
        const publishedAt = item.pubDate
          ? new Date(item.pubDate)
          : new Date();

        // Extract entities from title and content
        const entities = extractEntities(item.title, content);

        try {
          await db.insert(signals).values({
            source: "rss",
            publishedAt,
            url: item.link,
            title: item.title,
            content: content.slice(0, 5000), // Limit content length
            lang: "en", // Assume English for now
            entities,
            hash,
          });
          inserted++;
        } catch (error: unknown) {
          // Check for unique constraint violation (duplicate)
          const err = error as { code?: string; message?: string; cause?: { code?: string } };
          const isDuplicate = 
            err.code === "23505" || 
            err.cause?.code === "23505" ||
            err.message?.includes("unique") ||
            err.message?.includes("duplicate");
          
          if (isDuplicate) {
            duplicates++;
          } else {
            console.error("Error inserting signal:", error);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing feed ${feed.url}:`, error);
    }
  }

  console.log(
    `RSS ingest complete: ${fetched} fetched, ${inserted} inserted, ${duplicates} duplicates`
  );

  return { fetched, inserted, duplicates };
}
