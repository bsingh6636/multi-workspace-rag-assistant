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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only the variable names are printed, never their values.
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  console.error(`Invalid or missing environment variables: ${names}. See .env.example.`);
  process.exit(1);
}

export const config = parsed.data;
