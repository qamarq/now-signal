import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export const model = openai('gpt-4o-mini');
export const strongModel = openai('gpt-4o');
export const claudeModel = anthropic('claude-3-5-sonnet-20241022');
