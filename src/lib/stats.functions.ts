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
    kind?: "cocktail" | "spirit";
    cocktailId: string | null;
    spiritId?: string | null;
    cocktailName: string;
    customerName: string;
    note: string | null;
    status: string;
    loggedAt: string;
    quantity?: number;
  }) => z.object({
    originalOrderId: z.string(),
    kind: z.enum(["cocktail", "spirit"]).optional().default("cocktail"),
    cocktailId: z.string().uuid().nullable(),
    spiritId: z.string().uuid().nullable().optional().default(null),
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
      kind?: "cocktail" | "spirit";
      cocktailId: string | null;
      spiritId?: string | null;
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
      kind: z.enum(["cocktail", "spirit"]).optional().default("cocktail"),
      cocktailId: z.string().uuid().nullable(),
      spiritId: z.string().uuid().nullable().optional().default(null),
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
      const key = row.spirit_type?.trim() ? row.spirit_type.trim() : SPIRIT_TYPE_FALLBACK;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result: SpiritTypeStatRow[] = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
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
// Tæller efter quantity, så en bestilling på ×3 tæller som 3 drinks.
// Filtreret til kind='cocktail', så spiritus-bestillinger ikke tæller med.

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
// Samme princip som getTopCocktails, men filtreret til kind='spirit'.
// Vare-navnet ligger også her i cocktail_name-kolonnen (delt bestillingslog).

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
// Bruges på det offentlige menukort, så den er bevidst uden auth-middleware.
// Den udstiller kun hvilke cocktails der er populære (id + antal) — ingen
// gæstenavne eller andet følsomt. Tæller efter quantity og matcher på
// cocktail_id (robust over for omdøbninger). Filtreret til kind='cocktail'.

export type PopularBadge = "bestseller" | "popular";
export type PopularCocktailRow = {
  cocktail_id: string;
  count: number;
  rank: number;
  badge: PopularBadge;
};

const POPULAR_THRESHOLD = 3; // mindst 3 bestillinger før et badge gives
const POPULAR_LIMIT = 5;     // #1 = bestseller, #2-5 = populær

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
// Matcher på spirit_id og er filtreret til kind='spirit'.

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
// Returnerer RÅ bestillingspunkter (tidsstempel + antal). Al gruppering,
// "bar-døgn"-logik og positionering på tidsaksen sker i klienten, så det kan
// regnes i lokal tid (Europe/Copenhagen) frem for UTC.

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

    // Byg per-gæst optælling (efter quantity)
    const guestMap = new Map<string, Map<string, number>>();
    for (const row of allRows) {
      const b = bucket(row.logged_at);
      if (!guestMap.has(row.customer_name)) guestMap.set(row.customer_name, new Map());
      const m = guestMap.get(row.customer_name)!;
      m.set(b, (m.get(b) ?? 0) + (row.quantity ?? 1));
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
