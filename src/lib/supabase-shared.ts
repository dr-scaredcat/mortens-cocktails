import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Anonym/public Supabase-client til brug i server functions.
 * Bruger publishable key og bypasser IKKE RLS — derfor safe at dele.
 *
 * NB: Denne fil må IKKE omdøbes til *.server.ts. Funktionsfilerne
 * (*.functions.ts) bundles delvist til klienten, og .server.ts-filer
 * strippes fra klient-bundlen — hvilket ville bryde importen.
 */
export function publicClient() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    process.env.SUPABASE_URL ||
    "https://dkvrwwpbaarfyqyrnhha.supabase.co";
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_NsAPFaHuYb2mQbejaLy9WQ_BtLxx8ri";
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verificér at den aktuelle bruger er administrator via has_role-RPC'en.
 * Kaster en fejl hvis ikke. `ctx.supabase` er den auth'ede client der
 * leveres af requireSupabaseAuth-middleware.
 */
export async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kun administratorer kan udføre denne handling");
}
