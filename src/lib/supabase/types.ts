import type { SupabaseClient } from "@supabase/supabase-js";

/** Any Supabase client scoped to the biscuit schema (server, system, or SSR). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = SupabaseClient<any, any, any>;
