import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API not configured - AI matching disabled');
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export interface SignalMatch {
  isRelated: boolean;
  confidence: number; // 0-100
  reasoning: string;
  suggestedThread?: string; // Thread/topic name
}

/**
 * Use AI to determine if a trending topic is related to existing signals/events
 */
export async function matchTrendingToSignals(
  trendingTopic: string,
  existingSignals: Array<{ title: string; content?: string | null }>,
): Promise<SignalMatch> {
  const client = getOpenAIClient();

  if (!client) {
    // Fallback to simple keyword matching
    return fallbackKeywordMatch(trendingTopic, existingSignals);
  }

  try {
    const signalsSummary = existingSignals
      .slice(0, 5) // Limit to 5 most recent
      .map(
        (s, i) =>
          `${i + 1}. ${s.title}${s.content ? `: ${s.content.slice(0, 100)}` : ''}`,
      )
      .join('\n');

    const prompt = `You are an AI that helps detect if a trending topic on social media is related to news events.

Trending Topic: "${trendingTopic}"

Recent News Signals:
${signalsSummary}

Task: Determine if the trending topic is related to any of these news signals. Consider:
- Direct mentions of the same event
- Related locations or people
- Similar themes or consequences
- Reactions to the same event

Respond in JSON format:
{
  "isRelated": boolean,
  "confidence": number (0-100),
  "reasoning": "brief explanation",
  "suggestedThread": "optional thread name if creating new topic"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at identifying connections between social media trends and news events. Respond only with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(
      response.choices[0].message.content || '{}',
    ) as SignalMatch;

    return {
      isRelated: result.isRelated || false,
      confidence: Math.min(Math.max(result.confidence || 0, 0), 100),
      reasoning: result.reasoning || 'No reasoning provided',
      suggestedThread: result.suggestedThread,
    };
  } catch (error) {
    console.error('Error in AI matching:', error);
    return fallbackKeywordMatch(trendingTopic, existingSignals);
  }
}

/**
 * Fallback keyword matching when AI is unavailable
 */
function fallbackKeywordMatch(
  trendingTopic: string,
  existingSignals: Array<{ title: string; content?: string | null }>,
): SignalMatch {
  const topicLower = trendingTopic.toLowerCase();
  const keywords = topicLower.split(/\s+/).filter((w) => w.length > 3);

  let maxMatches = 0;
  for (const signal of existingSignals) {
    const signalText = `${signal.title} ${signal.content || ''}`.toLowerCase();
    const matches = keywords.filter((kw) => signalText.includes(kw)).length;
    maxMatches = Math.max(maxMatches, matches);
  }

  const confidence = Math.min((maxMatches / keywords.length) * 100, 100);
  const isRelated = confidence > 30;

  return {
    isRelated,
    confidence,
    reasoning: isRelated
      ? `Found ${maxMatches}/${keywords.length} keyword matches`
      : 'No significant keyword overlap',
  };
}

/**
 * Use AI to suggest merging/threading multiple clusters
 */
export async function suggestThreadMerge(
  clusters: Array<{
    id: string;
    hypothesis: string | null;
    category: string;
    regions: string[];
  }>,
): Promise<
  Array<{ clusterIds: string[]; threadName: string; confidence: number }>
> {
  const client = getOpenAIClient();

  if (!client || clusters.length < 2) {
    return [];
  }

  try {
    // Create a mapping of index to full ID
    const indexToId = new Map<number, string>();

    const clustersSummary = clusters
      .map((c, i) => {
        indexToId.set(i, c.id);
        return `${i}. ${c.hypothesis || 'Unknown'} (${c.category}, ${c.regions.join(', ')})`;
      })
      .join('\n');

    const prompt = `You are an AI that helps identify related news events that should be grouped into threads/storylines.

Event Clusters (numbered 0-${clusters.length - 1}):
${clustersSummary}

Task: Identify which clusters are part of the same ongoing story/thread. Consider:
- Same conflict or crisis
- Related political developments
- Connected incidents in same region
- Cause-and-effect relationships
- DO NOT merge clusters that are completely unrelated even if they share category/region

Respond in JSON format with an array of thread suggestions. Use cluster numbers (0-${clusters.length - 1}) in clusterIndices array:
{
  "threads": [
    {
      "clusterIndices": [0, 1, 2],
      "threadName": "descriptive thread name",
      "confidence": number (0-100),
      "reasoning": "brief explanation why these should merge"
    }
  ]
}

IMPORTANT: Only suggest merges with confidence >= 75. Be conservative - it's better to not merge than to merge unrelated events.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at identifying connections between news events. Be conservative and only merge clearly related events. Respond only with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Convert indices back to IDs and filter by confidence
    return (result.threads || [])
      .filter(
        (t: { confidence: number; clusterIndices: number[] }) =>
          t.confidence >= 75 &&
          Array.isArray(t.clusterIndices) &&
          t.clusterIndices.length >= 2,
      )
      .map(
        (t: {
          clusterIndices: number[];
          threadName: string;
          confidence: number;
          reasoning?: string;
        }) => ({
          clusterIds: t.clusterIndices
            .map((idx) => indexToId.get(idx))
            .filter(Boolean) as string[],
          threadName: t.threadName,
          confidence: t.confidence,
          reasoning: t.reasoning,
        }),
      )
      .filter((t: { clusterIds: string[] }) => t.clusterIds.length >= 2);
  } catch (error) {
    console.error('Error in AI thread merging:', error);
    return [];
  }
}

/**
 * Generate a hypothesis for a cluster using AI
 */
export async function generateHypothesis(
  signals: Array<{ title: string; content?: string | null }>,
): Promise<string> {
  const client = getOpenAIClient();

  if (!client || signals.length === 0) {
    return signals[0]?.title || 'Unknown event';
  }

  try {
    const signalsSummary = signals
      .slice(0, 10)
      .map((s) => `- ${s.title}`)
      .join('\n');

    const prompt = `Based on these news signals, write a concise one-sentence hypothesis about what event is happening:

${signalsSummary}

Respond with just the hypothesis sentence (max 120 characters).`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 50,
    });

    const hypothesis = response.choices[0].message.content?.trim() || '';
    return hypothesis.slice(0, 120);
  } catch (error) {
    console.error('Error generating hypothesis:', error);
    return signals[0]?.title || 'Unknown event';
  }
}

export async function detectSubEvents(
  signals: Array<{
    id: string;
    title: string;
    content?: string | null;
    url: string;
  }>,
): Promise<Array<{ topic: string; signalIds: string[]; confidence: number }>> {
  const client = getOpenAIClient();

  if (!client || signals.length < 6) {
    return [];
  }

  try {
    const indexToId = new Map<number, string>();
    const signalsSummary = signals
      .slice(0, 20)
      .map((s, i) => {
        indexToId.set(i, s.id);
        return `${i}. ${s.title}`;
      })
      .join('\n');

    const prompt = `You are analyzing news signals within a larger event cluster. Identify if there are specific sub-events that have ≥3 articles from different sources.

Signals (numbered 0-${signals.length - 1}):
${signalsSummary}

Task: Find sub-events that meet these criteria:
- ≥3 signals about the EXACT same specific incident/development
- Specific enough to warrant separate tracking (e.g., "soldier killed" within "war" event)
- NOT just slight variations of the main story

Respond in JSON format with array of sub-events. Use signal numbers (0-${signals.length - 1}) in signalIndices:
{
  "subEvents": [
    {
      "signalIndices": [0, 3, 7],
      "topic": "specific sub-event description",
      "confidence": number (0-100)
    }
  ]
}

Only suggest sub-events with confidence ≥ 80.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at identifying distinct sub-events within larger news stories. Be conservative - only split when clearly warranted. Respond only with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return (result.subEvents || [])
      .filter(
        (e: { confidence: number; signalIndices: number[] }) =>
          e.confidence >= 80 &&
          Array.isArray(e.signalIndices) &&
          e.signalIndices.length >= 3,
      )
      .map(
        (e: {
          signalIndices: number[];
          topic: string;
          confidence: number;
        }) => ({
          signalIds: e.signalIndices
            .map((idx) => indexToId.get(idx))
            .filter(Boolean) as string[],
          topic: e.topic,
          confidence: e.confidence,
        }),
      )
      .filter((e: { signalIds: string[] }) => e.signalIds.length >= 3);
  } catch (error) {
    console.error('Error detecting sub-events:', error);
    return [];
  }
}
