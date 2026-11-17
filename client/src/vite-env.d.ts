// Typed Vite env vars. Only VITE_* values reach the browser bundle, so only
// public values (Supabase URL and anon key) may use that prefix.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
