import { URGENCY_KEYWORDS, SENSITIVITY_THRESHOLDS } from "@/lib/constants";

interface Signal {
  id: string;
  publishedAt: Date;
  url: string;
  title: string;
  content: string | null;
  source: string;
  entities: {
    regions?: string[];
    keywords?: string[];
    category?: string;
  } | null;
}

/**
 * Calculate Early Score (0-100)
 * Based on:
 * - velocity: signals in last 30 min
 * - diversity: unique domains
 * - coherence: urgency keywords match
 * - PIZZINT: Pentagon area activity (major boost for anomalies)
 */
export function calculateEarlyScore(
  signals: Signal[],
  domains: string[]
): number {
  if (signals.length === 0) return 0;

  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;

  // Velocity: count signals in last 30 min (max 25 points)
  const recentSignals = signals.filter(
    (s) => s.publishedAt.getTime() > thirtyMinAgo
  );
  const velocityScore = Math.min(recentSignals.length * 8, 25);

  // Diversity: unique domains (max 25 points)
  const diversityScore = Math.min(domains.length * 8, 25);

  // Coherence: urgency keywords presence (max 30 points)
  let coherenceScore = 0;
  const allText = signals
    .map((s) => `${s.title} ${s.content || ""}`)
    .join(" ")
    .toLowerCase();

  for (const keyword of URGENCY_KEYWORDS) {
    if (allText.includes(keyword.toLowerCase())) {
      coherenceScore += 5;
    }
  }
  coherenceScore = Math.min(coherenceScore, 30);

  // PIZZINT: Pentagon area activity boost (max 20 points)
  const pizzintSignals = signals.filter((s) => s.source === "pizzint");
  let intelligenceScore = 0;
  if (pizzintSignals.length > 0) {
    // Get the highest PIZZINT score from entities
    const maxPizzintScore = Math.max(
      ...pizzintSignals.map((s) => {
        const entities = s.entities as { pizzint_data?: { score?: number; defcon_level?: number } } | null;
        // DEFCON 1-2 = critical, 3 = high, 4 = medium
        const defcon = entities?.pizzint_data?.defcon_level || 5;
        if (defcon <= 2) return 20;
        if (defcon === 3) return 15;
        if (defcon === 4) return 10;
        return 0;
      })
    );
    intelligenceScore = maxPizzintScore;
  }

  return Math.min(velocityScore + diversityScore + coherenceScore + intelligenceScore, 100);
}

/**
 * Calculate Confirm Score (0-100)
 * Based on:
 * - source reliability (RSS = higher trust)
 * - domain diversity (multiple independent sources)
 * - time spread (reports over time = more reliable)
 */
export function calculateConfirmScore(
  signals: Signal[],
  domains: string[]
): number {
  if (signals.length === 0) return 0;

  // RSS source bonus (max 40 points)
  const rssSignals = signals.filter((s) => s.source === "rss");
  const rssScore = Math.min(rssSignals.length * 15, 40);

  // Domain diversity for RSS sources (max 40 points)
  const rssDomains = new Set(
    rssSignals.map((s) => {
      try {
        return new URL(s.url).hostname.replace(/^www\./, "");
      } catch {
        return "unknown";
      }
    })
  );
  const domainScore = Math.min(rssDomains.size * 20, 40);

  // Time consistency: signals spread over time (max 20 points)
  const timestamps = signals.map((s) => s.publishedAt.getTime()).sort();
  let timeScore = 0;
  if (timestamps.length >= 2) {
    const timeSpreadMinutes =
      (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
    // Bonus for reports spread over 5-30 minutes
    if (timeSpreadMinutes >= 5 && timeSpreadMinutes <= 60) {
      timeScore = 20;
    } else if (timeSpreadMinutes > 60) {
      timeScore = 10; // Still good but older
    }
  }

  return Math.min(rssScore + domainScore + timeScore, 100);
}

/**
 * Determine event status based on scores
 */
export function determineStatus(
  earlyScore: number,
  confirmScore: number
): { status: "early" | "watch" | "confirmed"; confidence: number } {
  // Confirmed: high confirm score OR multiple RSS sources
  if (confirmScore >= 75) {
    return {
      status: "confirmed",
      confidence: Math.max(confirmScore, earlyScore),
    };
  }

  // Early: high early score, low confirm
  if (earlyScore >= 60 && confirmScore < 50) {
    return {
      status: "early",
      confidence: earlyScore,
    };
  }

  // Watch: moderate scores
  return {
    status: "watch",
    confidence: Math.max(earlyScore, confirmScore),
  };
}

/**
 * Check if user should receive notification based on sensitivity
 */
export function shouldNotifyUser(
  earlyScore: number,
  sensitivity: keyof typeof SENSITIVITY_THRESHOLDS
): boolean {
  const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
  return earlyScore >= threshold;
}

/**
 * Check if a major update occurred (confidence increase >= 15 or new domain)
 */
export function isMajorUpdate(
  oldConfidence: number,
  newConfidence: number,
  oldDomains: string[],
  newDomains: string[]
): boolean {
  // Confidence increased significantly
  if (newConfidence - oldConfidence >= 15) {
    return true;
  }

  // New domain added
  const oldSet = new Set(oldDomains);
  const hasNewDomain = newDomains.some((d) => !oldSet.has(d));

  return hasNewDomain;
}
