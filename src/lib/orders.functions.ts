import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
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