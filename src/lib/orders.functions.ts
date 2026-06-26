import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

function publicClient() {
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

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kun administratorer kan udføre denne handling");
}

export type OrderRow = {
  id: string;
  cocktail_id: string | null;
  cocktail_name: string;
  customer_name: string;
  note: string | null;
  status: string;
  created_at: string;
};

const orderInput = z.object({
  cocktailId: z.string().uuid(),
  cocktailName: z.string().min(1).max(120),
  customerName: z.string().trim().min(1, "Skriv dit navn").max(60),
  note: z.string().trim().max(300).optional().nullable(),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("cocktail_orders").insert({
      cocktail_id: data.cocktailId,
      cocktail_name: data.cocktailName,
      customer_name: data.customerName,
      note: data.note && data.note.length > 0 ? data.note : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cocktail_orders")
      .select("id, cocktail_id, cocktail_name, customer_name, note, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OrderRow[];
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "pending" | "done" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "done"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrderingEnabled = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "ordering_enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const v = data?.value;
    return { enabled: v === true || v === "true" };
  });

export const setOrderingEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "ordering_enabled", value: data.enabled as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignupEnabled = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "signup_enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { enabled: true };
    const v = data.value;
    return { enabled: v !== false && v !== "false" };
  });

export const setSignupEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "signup_enabled", value: data.enabled as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Sidenavn ===================

export const DEFAULT_SITE_NAME = "Barskab";

export const getSiteName = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { name: DEFAULT_SITE_NAME };
    const v = data.value;
    return { name: typeof v === "string" && v.length > 0 ? v : DEFAULT_SITE_NAME };
  });

export const setSiteName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "site_name", value: data.name as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Logostørrelse ===================

export const DEFAULT_LOGO_SIZE = 20;

export const getLogoSize = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "logo_size")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { size: DEFAULT_LOGO_SIZE };
    const v = data.value;
    const n = typeof v === "number" ? v : Number(v);
    return { size: Number.isFinite(n) ? n : DEFAULT_LOGO_SIZE };
  });

export const setLogoSize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { size: number }) =>
    z.object({ size: z.number().int().min(16).max(48) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_size", value: data.size as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Logotype ===================

export type LogoType = "barskab" | "martini" | "wine";
export const DEFAULT_LOGO_TYPE: LogoType = "barskab";

export const getLogoType = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "logo_type")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { type: DEFAULT_LOGO_TYPE };
    const v = data.value;
    const valid: LogoType[] = ["barskab", "martini", "wine"];
    return { type: valid.includes(v as LogoType) ? (v as LogoType) : DEFAULT_LOGO_TYPE };
  });

export const setLogoType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: LogoType }) =>
    z.object({ type: z.enum(["barskab", "martini", "wine"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_type", value: data.type as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
