import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { DbClient } from "./types";

/**
 * Supabase client for background jobs (cron sync, recap sends).
 * Signs in as the dedicated system account so RLS policies apply normally —
 * no service-role key needed anywhere in the app.
 */
export async function createSystemClient(): Promise<DbClient> {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { error } = await client.auth.signInWithPassword({
    email: process.env.SYSTEM_USER_EMAIL!,
    password: process.env.SYSTEM_USER_PASSWORD!,
  });
  if (error) {
    throw new Error(`System account sign-in failed: ${error.message}`);
  }
  return client;
}
