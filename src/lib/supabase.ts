import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
if (!supabaseKey) throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY')

const globalForSupabase = globalThis as unknown as {
  _supabase: ReturnType<typeof createClient> | undefined
}

export const supabase =
  globalForSupabase._supabase ??
  createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase._supabase = supabase
}
