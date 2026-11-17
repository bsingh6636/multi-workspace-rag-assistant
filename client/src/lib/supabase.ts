import { createClient } from '@supabase/supabase-js'

// Public values only: the anon key is safe in the browser because RLS (with no
// policies) blocks it from reading any table. All data goes through Express.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)')
}

// supabase-js stores the session in localStorage and refreshes the token itself.
export const supabase = createClient(url, anonKey)
