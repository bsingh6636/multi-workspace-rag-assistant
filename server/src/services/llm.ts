import type { Content } from '@google/genai';
import { config } from '../config';
import { ai, isRetryable, withRetry } from './gemini';

export type LlmResult = {
  text: string;
  model: string; // which model answered (primary or fallback)
  tokensIn: number | null;
  tokensOut: number | null;
};

// One Gemini call. The primary model gets the full retry schedule (1s, 2s, 4s).
// If it is still rate-limited or overloaded, the fallback model gets one try
// (DESIGN §6). Errors like a bad key (400/403) fail at once on the primary.
// Part 4 adds tool declarations and function calls here.
export async function generate(input: { systemInstruction: string; contents: Content[] }): Promise<LlmResult> {
  try {
    return await withRetry(() => callModel(config.GEMINI_CHAT_MODEL, input));
  } catch (err) {
    if (!isRetryable(err)) throw err;
    console.warn(`${config.GEMINI_CHAT_MODEL} unavailable after retries; trying ${config.GEMINI_CHAT_FALLBACK_MODEL}`);
    return await callModel(config.GEMINI_CHAT_FALLBACK_MODEL, input);
  }
}

async function callModel(
  model: string,
  { systemInstruction, contents }: { systemInstruction: string; contents: Content[] },
): Promise<LlmResult> {
  const res = await ai.models.generateContent({ model, contents, config: { systemInstruction } });

  const text = res.text?.trim() ?? '';
  if (!text) throw new Error('The model returned an empty answer');

  return {
    text,
    model,
    tokensIn: res.usageMetadata?.promptTokenCount ?? null,
    tokensOut: res.usageMetadata?.candidatesTokenCount ?? null,
  };
}
