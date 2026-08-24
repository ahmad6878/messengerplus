import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function emailForUsername(username) {
  return `${username.toLowerCase()}@messengerplus.app`
}

export const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/
