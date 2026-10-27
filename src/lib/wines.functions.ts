import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { publicClient } from "@/lib/supabase-shared";

// ── Vintyper ────────────────────────────────────────────────────────────────
export const WINE_TYPE_ORDER = [
  "rød",
  "hvid",
  "rosé",
  "mousserende",
  "dessertvin",
  "andet",
] as const;

export type WineType = (typeof WINE_TYPE_ORDER)[number];

function wineTypeRank(type: string): number {
  const idx = WINE_TYPE_ORDER.indexOf(type as WineType);
  return idx === -1 ? WINE_TYPE_ORDER.length : idx;
}

// ── Placeringstyper ─────────────────────────────────────────────────────────
// depth: 1 = forrest (mod lågen), 2 = bagerst (mod væggen)
// layer: 1 = nederste lag,        2 = øverste lag

export type WinePlacement = {
  id: string;
  wine_id: string;
  shelf: number;
  slot: number;
  depth: number; // 1 | 2
  layer: number; // 1 | 2
};

export function depthLabel(depth: number): string {
  return depth === 1 ? "forrest" : "bagerst";
}

export function shelfDepthKey(shelf: number, depth: number): string {
  return `${shelf}:${depth}`;
}

export type WineWithDetails = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  country: string | null;
  region: string | null;
  grapes: string | null;
  wine_type: string;
  /** Vinkategori (public.wine_styles.id) — deles med Astons Køkken */
  style_id: string | null;
  abv: number | null;
  bottle_size_cl: number;
  price: number | null;
  drink_from: number | null;
  drink_to: number | null;
  quantity: number;
  placements: WinePlacement[];
  image_url: string | null;
  description: string | null;
  tasting_notes: string | null;
  food_pairing: string | null;
  serving_temp: string | null;
};

// ── Fælles hjælper til at bygge WineWithDetails fra rå DB-rækker ───────────
function buildWineList(
  wines: any[],
  placements: any[],
  onlyPlaced: boolean,
): WineWithDetails[] {
  const placementsByWine = new Map<string, WinePlacement[]>();
  for (const p of placements) {
    const pl: WinePlacement = {
      id: p.id,
      wine_id: p.wine_id,
      shelf: p.shelf,
      slot: p.slot,
      depth: p.depth,
      layer: p.layer,
    };
    if (!placementsByWine.has(p.wine_id)) placementsByWine.set(p.wine_id, []);
    placementsByWine.get(p.wine_id)!.push(pl);
  }

  let result: WineWithDetails[] = wines.map((w) => {
    const pls = placementsByWine.get(w.id) ?? [];
    return {
      id: w.id,
      name: w.name,
      producer: w.producer ?? null,
      vintage: w.vintage ?? null,
      country: w.country ?? null,
      region: w.region ?? null,
      grapes: w.grapes ?? null,
      wine_type: w.wine_type,
      style_id: w.style_id ?? null,
      abv: w.abv ?? null,
      bottle_size_cl: w.bottle_size_cl ?? 75,
      price: w.price ?? null,
      drink_from: w.drink_from ?? null,
      drink_to: w.drink_to ?? null,
      quantity: pls.length,
      placements: pls,
      image_url: w.image_url ?? null,
      description: w.description ?? null,
      tasting_notes: w.tasting_notes ?? null,
      food_pairing: w.food_pairing ?? null,
      serving_temp: w.serving_temp ?? null,
    };
  });

  if (onlyPlaced) result = result.filter((w) => w.placements.length > 0);

  return result.sort((a, b) => {
    const rankDiff = wineTypeRank(a.wine_type) - wineTypeRank(b.wine_type);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, "da");
  });
}

// ── Liste over vine (offentlig — kun placerede) ─────────────────────────────
export const listWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineWithDetails[]> => {
    const sb = publicClient();
    const [winesRes, placementsRes] = await Promise.all([
      (sb.from("wines") as any).select("*"),
      (sb.from("wine_placements") as any).select("*"),
    ]);
    if (winesRes.error) throw new Error(winesRes.error.message);
    if (placementsRes.error) throw new Error(placementsRes.error.message);
    return buildWineList(winesRes.data ?? [], placementsRes.data ?? [], true);
  },
);

// ── Alle vine inkl. uplacerede (admin) ─────────────────────────────────────
export const listAllWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineWithDetails[]> => {
    const sb = publicClient();
    const [winesRes, placementsRes] = await Promise.all([
      (sb.from("wines") as any).select("*"),
      (sb.from("wine_placements") as any).select("*"),
    ]);
    if (winesRes.error) throw new Error(winesRes.error.message);
    if (placementsRes.error) throw new Error(placementsRes.error.message);
    return buildWineList(winesRes.data ?? [], placementsRes.data ?? [], false);
  },
);

// ── Vinkategorier (offentlig) ───────────────────────────────────────────────
// Fælles liste i public.wine_styles, som også bruges af Astons Køkken til
// "Vin til retten". bar_type matcher wine_type her (rød, hvid …); null = øl.
export type WineStyle = {
  id: string;
  wine_label: string;
  style: string;
  bar_type: string | null;
  neighbors: string[];
  sort_order: number;
};

export const listWineStyles = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineStyle[]> => {
    const sb = publicClient() as any;
    const { data, error } = await sb.from("wine_styles").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as WineStyle[];
  },
);

// ── Hent wine_self_serve-indstilling (offentlig) ────────────────────────────
export const getWineSelfServe = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ enabled: boolean }> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "wine_self_serve")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const v = data?.value;
    return { enabled: v === true || v === "true" };
  },
);

// ── Drik en flaske (offentlig — databasen tjekker admin eller self_serve) ──
// logAction: 'drukket' | 'bestilt-og-drukket'
export const drinkWine = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      placementId: string;
      wineId: string;
      wineName: string;
      logAction?: string;
      requireSelfServe?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    // Send brugerens token med, hvis der er et (admin), så databasen kender
    // auth.uid(). Gæster uden login kører som anon.
    const authHeader = getRequest()?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const sb = publicClient(token);

    // Al validering og skrivning sker atomisk i drink_wine-RPC'en
    // (SECURITY DEFINER): admin-tjek / self-serve-tjek, sletning af
    // placeringen og logning i order_log. Vinens id og navn slås op i
    // databasen; wineId/wineName/requireSelfServe bevares i inputtet af
    // hensyn til eksisterende kaldere.
    const { error } = await (sb as any).rpc("drink_wine", {
      _placement_id: data.placementId,
      _log_action: data.logAction ?? "drukket",
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ── Vinkøleskabets layout ───────────────────────────────────────────────────
export type WineFridgeShelf = { slotsForrest: number; slotsBagerst: number };
export type WineFridgeLayout = { shelves: WineFridgeShelf[] };

export const DEFAULT_WINE_FRIDGE_LAYOUT: WineFridgeLayout = {
  shelves: [
    { slotsForrest: 5, slotsBagerst: 5 },
    { slotsForrest: 5, slotsBagerst: 5 },
    { slotsForrest: 5, slotsBagerst: 5 },
    { slotsForrest: 5, slotsBagerst: 5 },
    { slotsForrest: 5, slotsBagerst: 5 },
    { slotsForrest: 5, slotsBagerst: 5 },
  ],
};

function isValidLayout(value: unknown): value is WineFridgeLayout {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as any).shelves) &&
    (value as any).shelves.every(
      (s: any) =>
        !!s &&
        typeof s === "object" &&
        typeof s.slotsForrest === "number" && s.slotsForrest >= 1 &&
        typeof s.slotsBagerst === "number" && s.slotsBagerst >= 1,
    )
  );
}

export const getWineFridgeLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineFridgeLayout> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "wine_fridge_layout")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_WINE_FRIDGE_LAYOUT;
    return isValidLayout(data.value) ? data.value : DEFAULT_WINE_FRIDGE_LAYOUT;
  },
);
