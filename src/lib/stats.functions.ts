import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";

// supabaseAdmin bruger service role og bypasser RLS — kun safe i server functions
async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ── Skriv en bestilling til loggen ─────────────────────────────────────────

export const logOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    originalOrderId: string;
    cocktailId: string | null;
    cocktailName: string;
    customerName: string;
    note: string | null;
    status: string;
    loggedAt: string;
  }) => z.object({
    originalOrderId: z.string(),
    cocktailId: z.string().uuid().nullable(),
    cocktailName: z.string(),
    customerName: z.string(),
    note: z.string().nullable(),
    status: z.string(),
    loggedAt: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    const { error } = await sb.from("order_log" as any).insert({
      original_order_id: data.originalOrderId,
      cocktail_id: data.cocktailId,
      cocktail_name: data.cocktailName,
      customer_name: data.customerName,
      note: data.note,
      status: data.status,
      logged_at: data.loggedAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Bulk-log alle bestillinger (bruges før deleteAll) ──────────────────────

export const logOrdersBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    orders: Array<{
      originalOrderId: string;
      cocktailId: string | null;
      cocktailName: string;
      customerName: string;
      note: string | null;
      status: string;
      loggedAt: string;
    }>;
  }) => z.object({
    orders: z.array(z.object({
      originalOrderId: z.string(),
      cocktailId: z.string().uuid().nullable(),
      cocktailName: z.string(),
      customerName: z.string(),
      note: z.string().nullable(),
      status: z.string(),
      loggedAt: z.string(),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.orders.length === 0) return { ok: true };
    const sb = await getAdminClient();
    const rows = data.orders.map((o) => ({
      original_order_id: o.originalOrderId,
      cocktail_id: o.cocktailId,
      cocktail_name: o.cocktailName,
      customer_name: o.customerName,
      note: o.note,
      status: o.status,
      logged_at: o.loggedAt,
    }));
    const { error } = await sb.from("order_log" as any).insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Statistik: Cocktails pr. tag ───────────────────────────────────────────

export type TagStatRow = { tag: string; count: number };

export const getTagStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cocktail_tags")
      .select("tag");
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
    }
    const result: TagStatRow[] = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    return result;
  });

// ── Statistik: Rating-fordeling ────────────────────────────────────────────

export type RatingDistRow = { rating: number; count: number };

export const getRatingDistribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cocktail_ratings")
      .select("rating");
    if (error) throw new Error(error.message);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of data ?? []) {
      const r = Number(row.rating);
      if (r >= 1 && r <= 5) counts[r]++;
    }
    const result: RatingDistRow[] = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: counts[r],
    }));
    return result;
  });

// ── Statistik: Top 5 mest bestilte cocktails ──────────────────────────────

export type TopCocktailRow = { cocktail_name: string; count: number };

export const getTopCocktails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    const { data, error } = await sb
      .from("order_log" as any)
      .select("cocktail_name");
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ cocktail_name: string }>) {
      counts.set(row.cocktail_name, (counts.get(row.cocktail_name) ?? 0) + 1);
    }
    const result: TopCocktailRow[] = Array.from(counts.entries())
      .map(([cocktail_name, count]) => ({ cocktail_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return result;
  });

// ── Statistik: Bestillinger over tid ──────────────────────────────────────

export type OrderOverTimeRow = { bucket: string; count: number };

const rangeInput = z.object({
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
});

export const getOrdersOverTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string | null; to?: string | null }) => rangeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    let query = sb
      .from("order_log" as any)
      .select("logged_at")
      .order("logged_at", { ascending: true });
    if (data.from) query = query.gte("logged_at", data.from);
    if (data.to) query = query.lte("logged_at", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Gruppér efter dag (YYYY-MM-DD)
    const counts = new Map<string, number>();
    for (const row of (rows ?? []) as Array<{ logged_at: string }>) {
      const day = row.logged_at.slice(0, 10); // YYYY-MM-DD
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    // Fyld huller i datoer
    if (counts.size === 0) return [];
    const days = Array.from(counts.keys()).sort();
    const start = new Date(days[0]);
    const end = new Date(days[days.length - 1]);
    const result: OrderOverTimeRow[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      result.push({ bucket: key, count: counts.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  });

// ── Statistik: Gæster der bestiller mest (med tidsserie) ──────────────────

export type GuestTimePoint = { time: string; cumulative: number };
export type GuestSeriesRow = { customer_name: string; total: number; series: GuestTimePoint[] };

export const getGuestSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string | null; to?: string | null }) => rangeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    let query = sb
      .from("order_log" as any)
      .select("customer_name, logged_at")
      .order("logged_at", { ascending: true });
    if (data.from) query = query.gte("logged_at", data.from);
    if (data.to) query = query.lte("logged_at", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Byg tidsserie pr. gæst, grupperet pr. time (eller dag ved lange perioder)
    const allRows = (rows ?? []) as Array<{ customer_name: string; logged_at: string }>;

    // Find tidsperiode
    if (allRows.length === 0) return [];
    const firstTime = new Date(allRows[0].logged_at);
    const lastTime = new Date(allRows[allRows.length - 1].logged_at);
    const spanHours = (lastTime.getTime() - firstTime.getTime()) / 1000 / 3600;
    // Brug timer ved <= 48t, ellers dage
    const useHours = spanHours <= 48;

    function bucket(iso: string): string {
      if (useHours) return iso.slice(0, 13) + ":00"; // YYYY-MM-DDTHH:00
      return iso.slice(0, 10);                        // YYYY-MM-DD
    }

    // Byg per-gæst optælling
    const guestMap = new Map<string, Map<string, number>>();
    for (const row of allRows) {
      const b = bucket(row.logged_at);
      if (!guestMap.has(row.customer_name)) guestMap.set(row.customer_name, new Map());
      const m = guestMap.get(row.customer_name)!;
      m.set(b, (m.get(b) ?? 0) + 1);
    }

    // Saml alle unikke buckets
    const allBuckets = Array.from(
      new Set(allRows.map((r) => bucket(r.logged_at)))
    ).sort();

    // Byg kumulerede serier og find top 8 gæster
    const result: GuestSeriesRow[] = Array.from(guestMap.entries())
      .map(([customer_name, bucketMap]) => {
        let cum = 0;
        const series: GuestTimePoint[] = allBuckets.map((b) => {
          cum += bucketMap.get(b) ?? 0;
          return { time: b, cumulative: cum };
        });
        return { customer_name, total: cum, series };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return result;
  });

// ── Nulstil statistikdata ──────────────────────────────────────────────────

export const clearOrderLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    const { error } = await sb
      .from("order_log" as any)
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
