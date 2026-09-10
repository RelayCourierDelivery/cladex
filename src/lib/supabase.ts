import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface FreightLoad {
  id: string
  created_at: string | null
  source: string
  broker_name: string | null
  broker_contact: string | null
  pickup_city_state: string | null
  dropoff_city_state: string | null
  equipment: string | null
  weight_lbs: number | null
  rate: number | null
  urgency: string | null
  notes: string | null
  status: string | null
  converted_job_id: string | null
  owner_id: string | null
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabaseConfigurationError =
  !supabaseUrl || !supabasePublishableKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add both values in the Vercel project environment variables, then redeploy.'
    : ''

export const supabase: SupabaseClient | null =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null
