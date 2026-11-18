import {
  FunctionCallingConfigMode,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
  type FunctionCall,
  type GenerateContentResponse,
  type SafetySetting,
  type Tool,
} from '@google/genai';
import { config } from '../config';
import { ai, isRetryable, withRetry } from './gemini';

export type LlmRequest = {
  systemInstruction: string;
  contents: Content[];
  tools?: Tool[];
  // 'NONE' keeps the tools declared but makes the model answer in text
  // (the last round of the tool loop).
  toolMode?: 'AUTO' | 'NONE';
  // Pins the call to one model. Later rounds of a tool loop use the model that
  // answered the first round (see services/toolLoop.ts).
  model?: string;
};

export type LlmResult = {
  // The model's turn exactly as received. A tool loop sends it back unchanged,
  // because Gemini 3 function calls carry a thoughtSignature that must return.
  content: Content;
  text: string;
  functionCalls: FunctionCall[];
  model: string; // which model answered (primary or fallback)
  tokensIn: number | null;
  tokensOut: number | null;
};

// Newer Gemini models don't block anything by default. Everything the model
// writes can leave the app (a Discord post goes to a shared channel as the
// bot), so hate and sexual content are blocked even at low probability.
// Harassment is blocked at medium: at low, a document with bossy injected text
// ("ignore your instructions…") blocked most answers that retrieved it, and the
// abusive posts from testing were blocked the same at either level.
// Dangerous content is blocked at medium, so documents about security still work.
const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Gemini's safety filter stopped the request or the reply. Not retried (the
// same input is blocked again); the chat turns it into a fixed answer.
export class SafetyBlockedError extends Error {
  constructor(
    public reason: string,
    public categories: string[] = [], // e.g. ["HARASSMENT:MEDIUM"], for the log
  ) {
    super(`Blocked by the safety filter (${reason})`);
  }
}

// The safety categories Gemini rated above NEGLIGIBLE, as "HARASSMENT:MEDIUM".
export function flaggedCategories(res: Pick<GenerateContentResponse, 'promptFeedback' | 'candidates'>): string[] {
  const ratings = res.candidates?.[0]?.safetyRatings ?? res.promptFeedback?.safetyRatings ?? [];
  return ratings
    .filter((r) => r.probability && r.probability !== 'NEGLIGIBLE')
    .map((r) => `${String(r.category).replace('HARM_CATEGORY_', '')}:${r.probability}`);
}

const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

// Why the response was blocked, or null. The prompt itself can be blocked
// (promptFeedback), or the reply can stop for a safety reason (finishReason).
export function blockReasonOf(res: Pick<GenerateContentResponse, 'promptFeedback' | 'candidates'>): string | null {
  const promptBlock = res.promptFeedback?.blockReason;
  if (promptBlock) return String(promptBlock);
  const finish = res.candidates?.[0]?.finishReason;
  return finish && BLOCKED_FINISH_REASONS.has(finish) ? finish : null;
}

// One Gemini call. The primary model gets the full retry schedule (1s, 2s, 4s).
// If it is still rate-limited or overloaded, the fallback model gets one try
// (DESIGN §6). Errors like a bad key (400/403) fail at once on the primary.
export async function generate(req: LlmRequest): Promise<LlmResult> {
  if (req.model) return await withRetry(() => callModel(req.model!, req));

  try {
    return await withRetry(() => callModel(config.GEMINI_CHAT_MODEL, req));
  } catch (err) {
    if (!isRetryable(err)) throw err;
    console.warn(`${config.GEMINI_CHAT_MODEL} unavailable after retries; trying ${config.GEMINI_CHAT_FALLBACK_MODEL}`);
    return await callModel(config.GEMINI_CHAT_FALLBACK_MODEL, req);
  }
}

async function callModel(model: string, req: LlmRequest): Promise<LlmResult> {
  const res = await ai.models.generateContent({
    model,
    contents: req.contents,
    config: {
      systemInstruction: req.systemInstruction,
      safetySettings: SAFETY_SETTINGS,
      tools: req.tools,
      toolConfig:
        req.toolMode === 'NONE' ? { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } } : undefined,
    },
  });

  const blocked = blockReasonOf(res);
  if (blocked) throw new SafetyBlockedError(blocked, flaggedCategories(res));

  // Read the parts directly: res.text logs an SDK warning when the reply also
  // has function calls. Thought parts are the model's reasoning, not the answer.
  const content = res.candidates?.[0]?.content;
  const parts = content?.parts ?? [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  const functionCalls = parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []));

  if (!content || (!text && functionCalls.length === 0)) throw new Error('The model returned an empty answer');

  return {
    content: { role: 'model', parts },
    text,
    functionCalls,
    model,
    tokensIn: res.usageMetadata?.promptTokenCount ?? null,
    tokensOut: res.usageMetadata?.candidatesTokenCount ?? null,
  };
}
