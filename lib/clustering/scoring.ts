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

export function calculateEarlyScore(
  signals: Signal[],
  domains: string[]
): number {
  if (signals.length === 0) return 0;

  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;

  let totalScore = 0;

  const pizzintSignals = signals.filter((s) => s.source === "pizzint");
  let pizzintScore = 0;
  
  if (pizzintSignals.length > 0) {
    const maxPizzintData = pizzintSignals.reduce((best, s) => {
      const entities = s.entities as { pizzint_data?: { score?: number; defcon_level?: number } } | null;
      const defcon = entities?.pizzint_data?.defcon_level || 5;
      const currentScore = entities?.pizzint_data?.score || 0;
      
      if (defcon < best.defcon || (defcon === best.defcon && currentScore > best.score)) {
        return { defcon, score: currentScore };
      }
      return best;
    }, { defcon: 5, score: 0 });

    if (maxPizzintData.defcon <= 2) {
      pizzintScore = 40;
    } else if (maxPizzintData.defcon === 3) {
      pizzintScore = 30;
    } else if (maxPizzintData.defcon === 4) {
      pizzintScore = 20;
    } else {
      pizzintScore = 10;
    }

    console.log(`PIZZINT Early Score: ${pizzintScore} (DEFCON ${maxPizzintData.defcon})`);
  }
  totalScore += pizzintScore;

  const trendSignals = signals.filter((s) => s.source === "google_trends");
  const rssSignals = signals.filter((s) => s.source === "rss");
  
  let trendsScore = 0;
  if (trendSignals.length > 0) {
    const trendKeywords = new Set<string>();
    const trendTraffic = [];
    
    for (const signal of trendSignals) {
      const entities = signal.entities as { 
        keywords?: string[]; 
        google_trends_data?: { traffic?: number } 
      } | null;
      
      if (entities?.keywords) {
        entities.keywords.forEach(k => trendKeywords.add(k.toLowerCase()));
      }
      
      const traffic = entities?.google_trends_data?.traffic || 0;
      if (traffic > 0) trendTraffic.push(traffic);
    }

    const keywordOverlap = calculateKeywordOverlap(trendSignals);
    
    const hasKeywordCorrelation = keywordOverlap >= 2;
    const multipleTrends = trendSignals.length >= 2;
    const highTraffic = trendTraffic.some(t => t >= 5000);
    const veryHighTraffic = trendTraffic.some(t => t >= 20000);
    const noOfficialNews = rssSignals.length === 0;
    
    if (noOfficialNews && hasKeywordCorrelation && multipleTrends) {
      if (veryHighTraffic) {
        trendsScore = 35;
      } else if (highTraffic) {
        trendsScore = 28;
      } else {
        trendsScore = 20;
      }
    } else if (hasKeywordCorrelation && multipleTrends) {
      trendsScore = rssSignals.length === 1 ? 15 : 10;
    } else if (trendSignals.length >= 1) {
      trendsScore = highTraffic ? 8 : 5;
    }

    console.log(`Google Trends Early Score: ${trendsScore} (${trendSignals.length} trends, ${keywordOverlap} overlapping keywords, ${rssSignals.length} RSS)`);
  }
  totalScore += trendsScore;

  const recentSignals = signals.filter(
    (s) => s.publishedAt.getTime() > thirtyMinAgo
  );
  const velocityScore = Math.min(recentSignals.length * 5, 15);
  totalScore += velocityScore;

  let coherenceScore = 0;
  const allText = signals
    .map((s) => `${s.title} ${s.content || ""}`)
    .join(" ")
    .toLowerCase();

  let keywordCount = 0;
  for (const keyword of URGENCY_KEYWORDS) {
    if (allText.includes(keyword.toLowerCase())) {
      keywordCount++;
    }
  }
  coherenceScore = Math.min(keywordCount * 2, 10);
  totalScore += coherenceScore;

  console.log(`Early Score breakdown: PIZZINT=${pizzintScore}, Trends=${trendsScore}, Velocity=${velocityScore}, Coherence=${coherenceScore}, Total=${totalScore}`);

  return Math.min(totalScore, 100);
}

function calculateKeywordOverlap(trendSignals: Signal[]): number {
  if (trendSignals.length < 2) return 0;
  
  let maxOverlap = 0;
  
  for (let i = 0; i < trendSignals.length; i++) {
    const keywords1 = new Set(
      ((trendSignals[i].entities as { keywords?: string[] } | null)?.keywords || [])
        .map(k => k.toLowerCase())
    );
    
    for (let j = i + 1; j < trendSignals.length; j++) {
      const keywords2 = 
        ((trendSignals[j].entities as { keywords?: string[] } | null)?.keywords || [])
          .map(k => k.toLowerCase());
      
      const overlap = keywords2.filter(k => keywords1.has(k)).length;
      maxOverlap = Math.max(maxOverlap, overlap);
    }
  }
  
  return maxOverlap;
}

export function calculateConfirmScore(
  signals: Signal[],
  domains: string[]
): number {
  if (signals.length === 0) return 0;

  const rssSignals = signals.filter((s) => s.source === "rss");
  const rssScore = Math.min(rssSignals.length * 15, 40);

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

  const timestamps = signals.map((s) => s.publishedAt.getTime()).sort();
  let timeScore = 0;
  if (timestamps.length >= 2) {
    const timeSpreadMinutes =
      (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
    if (timeSpreadMinutes >= 5 && timeSpreadMinutes <= 60) {
      timeScore = 20;
    } else if (timeSpreadMinutes > 60) {
      timeScore = 10;
    }
  }

  return Math.min(rssScore + domainScore + timeScore, 100);
}

export function determineStatus(
  earlyScore: number,
  confirmScore: number
): { status: "early" | "watch" | "confirmed"; confidence: number } {
  if (confirmScore >= 70) {
    return {
      status: "confirmed",
      confidence: confirmScore,
    };
  }

  if (earlyScore >= 50 && confirmScore < 40) {
    return {
      status: "early",
      confidence: earlyScore,
    };
  }

  if (earlyScore >= 40 && confirmScore >= 40 && confirmScore < 70) {
    return {
      status: "early",
      confidence: Math.max(earlyScore, confirmScore),
    };
  }

  return {
    status: "watch",
    confidence: Math.max(earlyScore, confirmScore),
  };
}

export function shouldNotifyUser(
  earlyScore: number,
  sensitivity: keyof typeof SENSITIVITY_THRESHOLDS
): boolean {
  const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
  return earlyScore >= threshold;
}

export function isMajorUpdate(
  oldConfidence: number,
  newConfidence: number,
  oldDomains: string[],
  newDomains: string[]
): boolean {
  if (newConfidence - oldConfidence >= 15) {
    return true;
  }

  const oldSet = new Set(oldDomains);
  const hasNewDomain = newDomains.some((d) => !oldSet.has(d));

  return hasNewDomain;
}
