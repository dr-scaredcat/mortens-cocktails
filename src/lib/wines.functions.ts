import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-shared";

// Cast til "any" bruges hvor Supabase-typerne endnu ikke kender
// wines-tabellen i alle sammenhænge (fx værdien i app_settings) — samme
// mønster som order_log i stats.functions.ts. Når types.ts er fuldt
// regenereret kan casts fjernes uden ændring i logik.

// ── Vintyper ────────────────────────────────────────────────────────────
// Fast rækkefølge til sortering — matcher menukortets grupper. Ikke en
// DB-enum, så listen kan udvides uden migration; valideres i app-laget.
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
  quantity: number;
  shelf: number | null;
  slot: number | null;
  image_url: string | null;
  description: string | null;
  tasting_notes: string | null;
  food_pairing: string | null;
  serving_temp: string | null;
};

// ── Liste over vine (offentlig) ────────────────────────────────────────────
// Sorteret efter fast vintype-rækkefølge, herefter alfabetisk (da) indenfor
// typen. Bemærk: prisen filtreres IKKE fra her — samme princip som resten
// af appen (RLS giver anon læseadgang til hele rækken); at prisen kun VISES
// i admin er en UI-beslutning der håndteres i en senere fase.
export const listWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<WineWithDetails[]> => {
    const sb = publicClient();
    const { data, error } = await (sb.from("wines") as any).select("*");
    if (error) throw new Error(error.message);

    const result: WineWithDetails[] = ((data ?? []) as any[]).map((w) => ({
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
      quantity: w.quantity ?? 0,
      shelf: w.shelf ?? null,
      slot: w.slot ?? null,
      image_url: w.image_url ?? null,
      description: w.description ?? null,
      tasting_notes: w.tasting_notes ?? null,
      food_pairing: w.food_pairing ?? null,
      serving_temp: w.serving_temp ?? null,
    }));

    result.sort((a, b) => {
      const rankDiff = wineTypeRank(a.wine_type) - wineTypeRank(b.wine_type);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, "da");
    });

    return result;
  },
);

// ── Vinkøleskabets layout (offentlig) ──────────────────────────────────────
// Antal hylder og pladser pr. hylde, gemt i app_settings under nøglen
// 'wine_fridge_layout'. Pr.-hylde slot-antal, fordi hylder i vinkøleskabe
// ofte har forskellig kapacitet.

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
