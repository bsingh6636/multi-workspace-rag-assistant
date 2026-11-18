import 'dotenv/config';
import { z } from 'zod';

// All env access goes through here. Validated once at startup so a missing key
// fails loudly on boot instead of on the first request. Values are never logged.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // Chunks and queries must use the same model; changing it means re-embedding everything.
  GEMINI_EMBED_MODEL: z.string().min(1).default('gemini-embedding-001'),
  // Free-tier quota for GEMINI_EMBED_MODEL per minute (check aistudio.google.com/rate-limit).
  // One upload may use at most 95% of it (services/uploadLimit.ts).
  GEMINI_EMBED_RPM: z.coerce.number().int().positive().default(100),
  GEMINI_EMBED_TPM: z.coerce.number().int().positive().default(30_000),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  // Used after retries on the primary fail with 429/5xx/timeout (DESIGN §6).
  GEMINI_CHAT_FALLBACK_MODEL: z.string().min(1).default('gemini-3.6-flash'),
  // Chunks scoring below this are left out of the prompt. It filters chunks;
  // it never decides whether the LLM is called (hard rule 7).
  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.62),
  // Rounds of tool calls per answer before the model must reply in text (DESIGN §5).
  MAX_TOOL_ITERATIONS: z.coerce.number().int().min(1).max(5).default(3),
  // Optional: only the send_discord_summary tool needs it. Empty = not configured.
  DISCORD_WEBHOOK_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only the variable names are printed, never their values.
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  console.error(`Invalid or missing environment variables: ${names}. See .env.example.`);
  process.exit(1);
}

export const config = parsed.data;
