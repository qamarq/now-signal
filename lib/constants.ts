// Available categories for events
export const CATEGORIES = [
  { value: "conflict", label: "Conflict & War" },
  { value: "natural_disaster", label: "Natural Disasters" },
  { value: "terrorism", label: "Terrorism" },
  { value: "politics", label: "Politics" },
  { value: "economy", label: "Economy & Finance" },
  { value: "health", label: "Health & Pandemic" },
  { value: "technology", label: "Technology" },
  { value: "environment", label: "Environment & Climate" },
  { value: "social", label: "Social & Civil Unrest" },
  { value: "other", label: "Other" },
] as const;

// Available regions (simplified for MVP)
export const REGIONS = [
  { value: "NA", label: "North America" },
  { value: "SA", label: "South America" },
  { value: "EU", label: "Europe" },
  { value: "AF", label: "Africa" },
  { value: "ME", label: "Middle East" },
  { value: "AS", label: "Asia" },
  { value: "OC", label: "Oceania" },
  { value: "GLOBAL", label: "Global" },
] as const;

// Country to region mapping (simplified)
export const COUNTRY_TO_REGION: Record<string, string> = {
  // North America
  US: "NA", USA: "NA", "United States": "NA", Canada: "NA", Mexico: "NA",
  // South America
  Brazil: "SA", Argentina: "SA", Colombia: "SA", Chile: "SA", Peru: "SA", Venezuela: "SA",
  // Europe
  UK: "EU", "United Kingdom": "EU", France: "EU", Germany: "EU", Italy: "EU", Spain: "EU",
  Poland: "EU", Ukraine: "EU", Russia: "EU", Netherlands: "EU", Belgium: "EU",
  // Africa
  Nigeria: "AF", Egypt: "AF", "South Africa": "AF", Kenya: "AF", Ethiopia: "AF",
  // Middle East
  Israel: "ME", Palestine: "ME", Gaza: "ME", Iran: "ME", Iraq: "ME", Syria: "ME",
  "Saudi Arabia": "ME", UAE: "ME", Turkey: "ME", Lebanon: "ME", Yemen: "ME",
  // Asia
  China: "AS", Japan: "AS", India: "AS", "South Korea": "AS", "North Korea": "AS",
  Pakistan: "AS", Indonesia: "AS", Thailand: "AS", Vietnam: "AS", Taiwan: "AS",
  // Oceania
  Australia: "OC", "New Zealand": "OC",
};

// Keywords for category detection
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  conflict: [
    "war", "military", "attack", "strike", "bombing", "invasion",
    "troops", "soldiers", "army", "conflict", "battle", "fighting",
    "offensive", "missile", "drone", "casualties", "killed", "wounded",
  ],
  natural_disaster: [
    "earthquake", "tsunami", "hurricane", "typhoon", "flood", "wildfire",
    "tornado", "volcano", "eruption", "landslide", "storm", "cyclone",
    "disaster", "evacuate", "evacuation", "emergency",
  ],
  terrorism: [
    "terrorist", "terrorism", "attack", "explosion", "bomb", "hostage",
    "shooting", "gunman", "extremist", "militant", "isis", "al-qaeda",
  ],
  politics: [
    "election", "president", "prime minister", "parliament", "vote",
    "government", "minister", "political", "legislation", "bill",
    "senate", "congress", "summit", "diplomatic",
  ],
  economy: [
    "economy", "stock", "market", "inflation", "recession", "gdp",
    "unemployment", "trade", "tariff", "currency", "bank", "financial",
  ],
  health: [
    "pandemic", "virus", "outbreak", "vaccine", "covid", "health",
    "hospital", "disease", "epidemic", "infection", "cases", "deaths",
  ],
  technology: [
    "tech", "ai", "artificial intelligence", "cyber", "hack", "data",
    "software", "startup", "innovation", "digital",
  ],
  environment: [
    "climate", "environment", "pollution", "emissions", "carbon",
    "renewable", "energy", "sustainability", "deforestation",
  ],
  social: [
    "protest", "demonstration", "riot", "unrest", "strike", "rally",
    "activist", "movement", "civil rights",
  ],
};

// High urgency keywords that boost early score
export const URGENCY_KEYWORDS = [
  "breaking", "urgent", "alert", "emergency", "evacuation",
  "explosion", "attack", "casualties", "killed", "wounded",
  "crisis", "imminent", "critical",
];

// Sensitivity thresholds for early notifications
export const SENSITIVITY_THRESHOLDS = {
  low: 80,
  med: 70,
  high: 60,
} as const;

export type Sensitivity = keyof typeof SENSITIVITY_THRESHOLDS;
export type Category = (typeof CATEGORIES)[number]["value"];
export type Region = (typeof REGIONS)[number]["value"];
