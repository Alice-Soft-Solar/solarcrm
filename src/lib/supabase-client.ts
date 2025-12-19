/**
 * Centralized Supabase client utility
 * This ensures we only have one Supabase client instance throughout the app
 * Fixes "Multiple GoTrueClient instances detected" warning
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return supabaseClient;
}

/**
 * Create a new Supabase client (for cases where a fresh instance is needed)
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
}

/**
 * Get access token from localStorage for API requests
 * Extracts token from Supabase session stored in localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  // Extract project ref from URL (e.g., https://xyz.supabase.co -> xyz)
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)/);
  const projectRef = urlMatch ? urlMatch[1] : '';
  
  if (!projectRef) return null;

  const sessionKey = `sb-${projectRef}-auth-token`;
  const sessionData = localStorage.getItem(sessionKey);
  
  if (!sessionData) return null;

  try {
    const session = JSON.parse(sessionData);
    return session?.access_token || null;
  } catch (e) {
    console.error('Failed to parse session from localStorage:', e);
    return null;
  }
}



