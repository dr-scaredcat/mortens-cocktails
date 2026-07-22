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
    kind?: "cocktail" | "spirit" | "wine";
    cocktailId: string | null;
    spiritId?: string | null;
    wineId?: string | null;
    cocktailName: string;
    customerName: string;
    note: string | null;
    status: string;
    loggedAt: string;
    quantity?: number;
  }) => z.object({
    originalOrderId: z.string(),
    kind: z.enum(["cocktail", "spirit", "wine"]).optional().default("cocktail"),
    cocktailId: z.string().uuid().nullable(),
    spiritId: z.string().uuid().nullable().optional().default(null),
    wineId: z.string().uuid().nullable().optional().default(null),
    cocktailName: z.string(),
    customerName: z.string(),
    note: z.string().nullable(),
    status: z.string(),
    loggedAt: z.string(),
    quantity: z.number().int().min(1).optional().default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    const { error } = await sb.from("order_log" as any).insert({
      original_order_id: data.originalOrderId,
      kind: data.kind,
      cocktail_id: data.cocktailId,
      spirit_id: data.spiritId ?? null,
      wine_id: data.wineId ?? null,
      cocktail_name: data.cocktailName,
      customer_name: data.customerName,
      note: data.note,
      status: data.status,
      logged_at: data.loggedAt,
      quantity: data.quantity,
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
      kind?: "cocktail" | "spirit" | "wine";
      cocktailId: string | null;
      spiritId?: string | null;
      wineId?: string | null;
      cocktailName: string;
      customerName: string;
      note: string | null;
      status: string;
      loggedAt: string;
      quantity?: number;
    }>;
  }) => z.object({
    orders: z.array(z.object({
      originalOrderId: z.string(),
      kind: z.enum(["cocktail", "spirit", "wine"]).optional().default("cocktail"),
      cocktailId: z.string().uuid().nullable(),
      spiritId: z.string().uuid().nullable().optional().default(null),
      wineId: z.string().uuid().nullable().optional().default(null),
      cocktailName: z.string(),
      customerName: z.string(),
      note: z.string().nullable(),
      status: z.string(),
      loggedAt: z.string(),
      quantity: z.number().int().min(1).optional().default(1),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.orders.length === 0) return { ok: true };
    const sb = await getAdminClient();
    const rows = data.orders.map((o) => ({
      original_order_id: o.originalOrderId,
      kind: o.kind ?? "cocktail",
      cocktail_id: o.cocktailId,
      spirit_id: o.spiritId ?? null,
      wine_id: o.wineId ?? null,
      cocktail_name: o.cocktailName,
      customer_name: o.customerName,
      note: o.note,
      status: o.status,
      logged_at: o.loggedAt,
      quantity: o.quantity,
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

// ── Statistik: Spiritus efter type ─────────────────────────────────────────
// Tæller antal spiritus pr. spirit_type. Spiritus uden type grupperes som
// "Øvrige" (samme konvention som resten af appen).

export type SpiritTypeStatRow = { type: string; count: number };

const SPIRIT_TYPE_FALLBACK = "Øvrige";

export const getSpiritTypeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("spirits" as any))
      .select("spirit_type");
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ spirit_type: string | null }>) {
      const key = row.spirit_type ?? SPIRIT_TYPE_FALLBACK;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result: SpiritTypeStatRow[] = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return result;
  });

// ── Statistik: Rating-fordeling ────────────────────────────────────────────

export type RatingStatRow = { rating: number; count: number };

export const getRatingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cocktail_ratings")
      .select("rating");
    if (error) throw new Error(error.message);
    const counts = new Map<number, number>();
    for (const row of data ?? []) {
      counts.set(row.rating, (counts.get(row.rating) ?? 0) + 1);
    }
    const result: RatingStatRow[] = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: counts.get(r) ?? 0,
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
      .select("cocktail_name, quantity")
      .eq("kind", "cocktail");
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ cocktail_name: string; quantity: number | null }>) {
      counts.set(row.cocktail_name, (counts.get(row.cocktail_name) ?? 0) + (row.quantity ?? 1));
    }
    const result: TopCocktailRow[] = Array.from(counts.entries())
      .map(([cocktail_name, count]) => ({ cocktail_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return result;
  });

// ── Statistik: Top 5 mest bestilte spiritus ───────────────────────────────

export type TopSpiritRow = { spirit_name: string; count: number };

export const getTopSpirits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await getAdminClient();
    const { data, error } = await sb
      .from("order_log" as any)
      .select("cocktail_name, quantity")
      .eq("kind", "spirit");
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ cocktail_name: string; quantity: number | null }>) {
      counts.set(row.cocktail_name, (counts.get(row.cocktail_name) ?? 0) + (row.quantity ?? 1));
    }
    const result: TopSpiritRow[] = Array.from(counts.entries())
      .map(([spirit_name, count]) => ({ spirit_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return result;
  });

// ── Populære cocktails til badges (OFFENTLIG) ──────────────────────────────

export type PopularBadge = "bestseller" | "popular";
export type PopularCocktailRow = {
  cocktail_id: string;
  count: number;
  rank: number;
  badge: PopularBadge;
};

const POPULAR_THRESHOLD = 3;
const POPULAR_LIMIT = 5;

export const getPopularCocktails = createServerFn({ method: "GET" }).handler(
  async (): Promise<PopularCocktailRow[]> => {
    const sb = await getAdminClient();
    const { data, error } = await sb
      .from("order_log" as any)
      .select("cocktail_id, quantity")
      .eq("kind", "cocktail");
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ cocktail_id: string | null; quantity: number | null }>) {
      if (!row.cocktail_id) continue;
      counts.set(row.cocktail_id, (counts.get(row.cocktail_id) ?? 0) + (row.quantity ?? 1));
    }

    return Array.from(counts.entries())
      .map(([cocktail_id, count]) => ({ cocktail_id, count }))
      .filter((r) => r.count >= POPULAR_THRESHOLD)
      .sort((a, b) => b.count - a.count)
      .slice(0, POPULAR_LIMIT)
      .map((r, i) => ({
        cocktail_id: r.cocktail_id,
        count: r.count,
        rank: i + 1,
        badge: (i === 0 ? "bestseller" : "popular") as PopularBadge,
      }));
  },
);

// ── Populære spiritus til badges (OFFENTLIG) — spejler getPopularCocktails ─

export type PopularSpiritRow = {
  spirit_id: string;
  count: number;
  rank: number;
  badge: PopularBadge;
};

export const getPopularSpirits = createServerFn({ method: "GET" }).handler(
  async (): Promise<PopularSpiritRow[]> => {
    const sb = await getAdminClient();
    const { data, error } = await sb
      .from("order_log" as any)
      .select("spirit_id, quantity")
      .eq("kind", "spirit");
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ spirit_id: string | null; quantity: number | null }>) {
      if (!row.spirit_id) continue;
      counts.set(row.spirit_id, (counts.get(row.spirit_id) ?? 0) + (row.quantity ?? 1));
    }

    return Array.from(counts.entries())
      .map(([spirit_id, count]) => ({ spirit_id, count }))
      .filter((r) => r.count >= POPULAR_THRESHOLD)
      .sort((a, b) => b.count - a.count)
      .slice(0, POPULAR_LIMIT)
      .map((r, i) => ({
        spirit_id: r.spirit_id,
        count: r.count,
        rank: i + 1,
        badge: (i === 0 ? "bestseller" : "popular") as PopularBadge,
      }));
  },
);

// ── Statistik: Bestillinger over tid ──────────────────────────────────────

export type OrderPoint = { t: string; q: number };

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
      .select("logged_at, quantity")
      .order("logged_at", { ascending: true });
    if (data.from) query = query.gte("logged_at", data.from);
    if (data.to) query = query.lte("logged_at", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return ((rows ?? []) as Array<{ logged_at: string; quantity: number | null }>).map(
      (r): OrderPoint => ({ t: r.logged_at, q: r.quantity ?? 1 }),
    );
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
      .select("customer_name, logged_at, quantity")
      .order("logged_at", { ascending: true });
    if (data.from) query = query.gte("logged_at", data.from);
    if (data.to) query = query.lte("logged_at", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Byg tidsserie pr. gæst, grupperet pr. time (eller dag ved lange perioder)
    const allRows = (rows ?? []) as Array<{
      customer_name: string;
      logged_at: string;
      quantity: number | null;
    }>;

    // Find tidsspænd
    const times = allRows.map((r) => new Date(r.logged_at).getTime());
    const spanMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
    const groupByDay = spanMs > 7 * 24 * 3600 * 1000;

    function bucket(iso: string): string {
      const d = new Date(iso);
      if (groupByDay) return d.toISOString().slice(0, 10);
      return d.toISOString().slice(0, 13);
    }

    // Byg totaler pr. gæst
    const totals = new Map<string, number>();
    for (const r of allRows) {
      totals.set(r.customer_name, (totals.get(r.customer_name) ?? 0) + (r.quantity ?? 1));
    }

    // Top 10 gæster
    const top10 = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const result: GuestSeriesRow[] = top10.map((name) => {
      const personal = allRows.filter((r) => r.customer_name === name);
      const bucketMap = new Map<string, number>();
      for (const r of personal) {
        const key = bucket(r.logged_at);
        bucketMap.set(key, (bucketMap.get(key) ?? 0) + (r.quantity ?? 1));
      }
      let cumulative = 0;
      const series: GuestTimePoint[] = Array.from(bucketMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, q]) => {
          cumulative += q;
          return { time, cumulative };
        });
      return { customer_name: name, total: totals.get(name) ?? 0, series };
    });

    return result;
  });
