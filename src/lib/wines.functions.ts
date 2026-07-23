import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-shared";

// ── Vintyper ────────────────────────────────────────────────────────────────
export const WINE_TYPE_ORDER = [
  "rød",
  "hvid",
  "rosé",
  "mousserende",
  "dessertvin",
  "hedvin",
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

/** Tekstbeskrivelse af dybde */
export function depthLabel(depth: number): string {
  return depth === 1 ? "forrest" : "bagerst";
}

/** Grupperingsnøgle: samme hylde + dybde vises samlet grafisk */
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
  abv: number | null;
  bottle_size_cl: number;
  price: number | null;
  drink_from: number | null;
  drink_to: number | null;
  /** Beregnet fra antal rækker i wine_placements */
  quantity: number;
  placements: WinePlacement[];
  image_url: string | null;
  description: string | null;
  tasting_notes: string | null;
  food_pairing: string | null;
  serving_temp: string | null;
};

// ── Liste over vine (offentlig — kun placerede vine) ────────────────────────
export const listWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineWithDetails[]> => {
    const sb = publicClient();

    const [winesRes, placementsRes] = await Promise.all([
      (sb.from("wines") as any).select("*"),
      (sb.from("wine_placements") as any).select("*"),
    ]);

    if (winesRes.error) throw new Error(winesRes.error.message);
    if (placementsRes.error) throw new Error(placementsRes.error.message);

    const placementsByWine = new Map<string, WinePlacement[]>();
    for (const p of (placementsRes.data ?? []) as any[]) {
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

    const result: WineWithDetails[] = ((winesRes.data ?? []) as any[]).map((w) => {
      const placements = placementsByWine.get(w.id) ?? [];
      return {
        id: w.id,
        name: w.name,
        producer: w.producer ?? null,
        vintage: w.vintage ?? null,
        country: w.country ?? null,
        region: w.region ?? null,
        grapes: w.grapes ?? null,
        wine_type: w.wine_type,
        abv: w.abv ?? null,
        bottle_size_cl: w.bottle_size_cl ?? 75,
        price: w.price ?? null,
        drink_from: w.drink_from ?? null,
        drink_to: w.drink_to ?? null,
        quantity: placements.length,
        placements,
        image_url: w.image_url ?? null,
        description: w.description ?? null,
        tasting_notes: w.tasting_notes ?? null,
        food_pairing: w.food_pairing ?? null,
        serving_temp: w.serving_temp ?? null,
      };
    });

    // Kun vine med mindst én placering vises for gæster
    return result
      .filter((w) => w.placements.length > 0)
      .sort((a, b) => {
        const rankDiff = wineTypeRank(a.wine_type) - wineTypeRank(b.wine_type);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name, "da");
      });
  },
);

// ── Alle vine inkl. uplacerede (bruges i admin) ─────────────────────────────
export const listAllWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineWithDetails[]> => {
    const sb = publicClient();

    const [winesRes, placementsRes] = await Promise.all([
      (sb.from("wines") as any).select("*"),
      (sb.from("wine_placements") as any).select("*"),
    ]);

    if (winesRes.error) throw new Error(winesRes.error.message);
    if (placementsRes.error) throw new Error(placementsRes.error.message);

    const placementsByWine = new Map<string, WinePlacement[]>();
    for (const p of (placementsRes.data ?? []) as any[]) {
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

    return ((winesRes.data ?? []) as any[])
      .map((w) => {
        const placements = placementsByWine.get(w.id) ?? [];
        return {
          id: w.id,
          name: w.name,
          producer: w.producer ?? null,
          vintage: w.vintage ?? null,
          country: w.country ?? null,
          region: w.region ?? null,
          grapes: w.grapes ?? null,
          wine_type: w.wine_type,
          abv: w.abv ?? null,
          bottle_size_cl: w.bottle_size_cl ?? 75,
          price: w.price ?? null,
          drink_from: w.drink_from ?? null,
          drink_to: w.drink_to ?? null,
          quantity: placements.length,
          placements,
          image_url: w.image_url ?? null,
          description: w.description ?? null,
          tasting_notes: w.tasting_notes ?? null,
          food_pairing: w.food_pairing ?? null,
          serving_temp: w.serving_temp ?? null,
        } as WineWithDetails;
      })
      .sort((a, b) => {
        const rankDiff = wineTypeRank(a.wine_type) - wineTypeRank(b.wine_type);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name, "da");
      });
  },
);

// ── Vinkøleskabets layout (offentlig) ──────────────────────────────────────
export type WineFridgeShelf = { slots: number };
export type WineFridgeLayout = { shelves: WineFridgeShelf[] };

export const DEFAULT_WINE_FRIDGE_LAYOUT: WineFridgeLayout = {
  shelves: [
    { slots: 5 },
    { slots: 5 },
    { slots: 5 },
    { slots: 5 },
    { slots: 5 },
    { slots: 5 },
  ],
};

function isValidLayout(value: unknown): value is WineFridgeLayout {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as { shelves?: unknown }).shelves) &&
    (value as { shelves: unknown[] }).shelves.every(
      (s) =>
        !!s &&
        typeof s === "object" &&
        typeof (s as { slots?: unknown }).slots === "number" &&
        (s as { slots: number }).slots >= 1,
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
