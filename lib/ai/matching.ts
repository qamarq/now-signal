import { generateObject } from 'ai';
import { z } from 'zod';
import { model } from './model';

export interface SignalMatch {
  isRelated: boolean;
  confidence: number;
  reasoning: string;
  suggestedThread?: string;
}

export async function matchTrendingToSignals(
  trendingTopic: string,
  existingSignals: Array<{ title: string; content?: string | null }>,
): Promise<SignalMatch> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackKeywordMatch(trendingTopic, existingSignals);
  }

  try {
    const signalsSummary = existingSignals
      .slice(0, 5)
      .map(
        (s, i) =>
          `${i + 1}. ${s.title}${s.content ? `: ${s.content.slice(0, 100)}` : ''}`,
      )
      .join('\n');

    const { object } = await generateObject({
      model,
      schema: z.object({
        isRelated: z.boolean(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string(),
        suggestedThread: z.string().optional(),
      }),
      prompt: `Determine if trending topic is related to news events.

Trending Topic: "${trendingTopic}"

Recent News:
${signalsSummary}

Consider: direct mentions, related locations/people, similar themes, reactions.`,
    });

    return object;
  } catch (error) {
    console.error('Error in AI matching:', error);
    return fallbackKeywordMatch(trendingTopic, existingSignals);
  }
}

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
  if (!process.env.OPENAI_API_KEY || clusters.length < 2) {
    return [];
  }

  try {
    const indexToId = new Map<number, string>();

    const clustersSummary = clusters
      .map((c, i) => {
        indexToId.set(i, c.id);
        return `${i}. ${c.hypothesis || 'Unknown'} (${c.category}, ${c.regions.join(', ')})`;
      })
      .join('\n');

    const { object } = await generateObject({
      model,
      schema: z.object({
        threads: z.array(
          z.object({
            clusterIndices: z.array(z.number()),
            threadName: z.string(),
            confidence: z.number().min(0).max(100),
            reasoning: z.string(),
          }),
        ),
      }),
      prompt: `Identify news events that should be grouped into larger storylines/threads.

Event Clusters (numbered 0-${clusters.length - 1}):
${clustersSummary}

Group clusters that are part of the SAME ongoing story:
- Same conflict/war (e.g., "Middle East Conflict")
- Same crisis (e.g., "Energy Crisis in Europe")
- Related political saga (e.g., "US Election 2026")
- Connected incidents in same region

Be AGGRESSIVE in merging - if they're about the same general story, merge them.
Only keep separate if truly different topics.

Confidence threshold: ≥60 for merging.`,
    });

    return object.threads
      .filter((t) => t.confidence >= 60 && t.clusterIndices.length >= 2)
      .map((t) => ({
        clusterIds: t.clusterIndices
          .map((idx) => indexToId.get(idx))
          .filter(Boolean) as string[],
        threadName: t.threadName,
        confidence: t.confidence,
        reasoning: t.reasoning,
      }))
      .filter((t) => t.clusterIds.length >= 2);
  } catch (error) {
    console.error('Error in AI thread merging:', error);
    return [];
  }
}

export async function generateHypothesis(
  signals: Array<{ title: string; content?: string | null }>,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY || signals.length === 0) {
    return signals[0]?.title || 'Unknown event';
  }

  try {
    const signalsSummary = signals
      .slice(0, 10)
      .map((s) => `- ${s.title}`)
      .join('\n');

    const { object } = await generateObject({
      model,
      schema: z.object({
        hypothesis: z.string().max(120),
      }),
      prompt: `Based on these news signals, write a concise one-sentence hypothesis about what event is happening:

${signalsSummary}

Max 120 characters. Be specific and descriptive.`,
    });

    return object.hypothesis;
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
  if (!process.env.OPENAI_API_KEY || signals.length < 6) {
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

    const { object } = await generateObject({
      model,
      schema: z.object({
        subEvents: z.array(
          z.object({
            signalIndices: z.array(z.number()),
            topic: z.string(),
            confidence: z.number().min(0).max(100),
            reasoning: z.string(),
          }),
        ),
      }),
      prompt: `Identify SPECIFIC sub-events within this larger story that warrant separate tracking.

Signals (numbered 0-${signals.length - 1}):
${signalsSummary}

Find sub-events where:
- ≥2 signals about the EXACT same specific incident
- Specific enough to be notable (e.g., "Hospital strike in Gaza" within "Middle East War")
- NOT just slight variations of the main story

Be SELECTIVE - only create sub-events for truly significant specific incidents that are heavily covered.

Confidence threshold: ≥85 for sub-event creation.`,
    });

    return object.subEvents
      .filter((e) => e.confidence >= 85 && e.signalIndices.length >= 2)
      .map((e) => ({
        signalIds: e.signalIndices
          .map((idx) => indexToId.get(idx))
          .filter(Boolean) as string[],
        topic: e.topic,
        confidence: e.confidence,
      }))
      .filter((e) => e.signalIds.length >= 2);
  } catch (error) {
    console.error('Error detecting sub-events:', error);
    return [];
  }
}
