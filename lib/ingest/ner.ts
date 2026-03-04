import {
  COUNTRY_TO_REGION,
  CATEGORY_KEYWORDS,
  URGENCY_KEYWORDS,
} from "@/lib/constants";

export interface ExtractedEntities {
  regions: string[];
  keywords: string[];
  category: string;
}

// Common country name variations
const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ["USA", "United States", "U.S.", "America", "American"],
  UK: ["United Kingdom", "Britain", "British", "England"],
  Russia: ["Russian", "Moscow", "Kremlin"],
  China: ["Chinese", "Beijing", "PRC"],
  Iran: ["Iranian", "Tehran"],
  Israel: ["Israeli", "Jerusalem", "Tel Aviv"],
  Palestine: ["Palestinian", "Gaza", "West Bank", "Hamas"],
  Ukraine: ["Ukrainian", "Kyiv", "Kiev"],
  Syria: ["Syrian", "Damascus"],
  "North Korea": ["DPRK", "Pyongyang", "Kim Jong"],
  "South Korea": ["ROK", "Seoul", "Korean"],
  "Saudi Arabia": ["Saudi", "Riyadh"],
  Turkey: ["Turkish", "Ankara", "Erdogan"],
  France: ["French", "Paris", "Macron"],
  Germany: ["German", "Berlin", "Scholz"],
  Japan: ["Japanese", "Tokyo"],
  India: ["Indian", "Delhi", "Modi"],
  Brazil: ["Brazilian", "Brasilia"],
  Mexico: ["Mexican", "Mexico City"],
  Australia: ["Australian", "Sydney", "Melbourne", "Canberra"],
  Egypt: ["Egyptian", "Cairo"],
  Nigeria: ["Nigerian", "Lagos", "Abuja"],
};

// Build a reverse lookup from aliases to country
const aliasToCountry: Record<string, string> = {};
for (const [country, aliases] of Object.entries(COUNTRY_ALIASES)) {
  for (const alias of aliases) {
    aliasToCountry[alias.toLowerCase()] = country;
  }
  aliasToCountry[country.toLowerCase()] = country;
}

// Add direct country mappings
for (const country of Object.keys(COUNTRY_TO_REGION)) {
  aliasToCountry[country.toLowerCase()] = country;
}

export function extractRegions(text: string): string[] {
  const regions = new Set<string>();
  const textLower = text.toLowerCase();

  // Check for country names and aliases
  for (const [alias, country] of Object.entries(aliasToCountry)) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
    if (regex.test(text)) {
      const region = COUNTRY_TO_REGION[country];
      if (region) {
        regions.add(region);
      }
    }
  }

  // If no regions found, mark as GLOBAL
  if (regions.size === 0) {
    regions.add("GLOBAL");
  }

  return Array.from(regions);
}

export function extractCategory(text: string): string {
  const textLower = text.toLowerCase();
  const categoryScores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > 0) {
      categoryScores[category] = score;
    }
  }

  // Return category with highest score, or "other" if none found
  const sorted = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : "other";
}

export function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const textLower = text.toLowerCase();

  // Check for urgency keywords
  for (const keyword of URGENCY_KEYWORDS) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    if (regex.test(text)) {
      keywords.add(keyword);
    }
  }

  // Check for category keywords
  for (const categoryKeywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
      if (regex.test(text)) {
        keywords.add(keyword);
      }
    }
  }

  return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
}

export function extractEntities(
  title: string,
  content: string
): ExtractedEntities {
  const fullText = `${title} ${content}`;

  return {
    regions: extractRegions(fullText),
    keywords: extractKeywords(fullText),
    category: extractCategory(fullText),
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
