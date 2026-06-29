import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-shared";

// Casts til "any" bruges hvor Supabase-typerne endnu ikke kender de nye
// spiritus-tabeller — samme mønster som order_log i stats.functions.ts.
// Når types.ts regenereres kan casts fjernes uden ændring i logik.

export type SpiritTypeRow = { id: string; name: string; position: number };

export type SpiritWithDetails = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  spirit_type: string | null;
  ingredient_id: string | null;
  position: number;
  /** Afledt af den tilknyttede ingrediens' available-flag. */
  available: boolean;
  avg_rating: number | null;
  rating_count: number;
};

// ── Liste over spiritus-typer (offentlig) ──────────────────────────────────
export const listSpiritTypes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await (sb.from("spirit_types") as any)
    .select("id, name, position")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SpiritTypeRow[];
});

// ── Liste over spiritus med afledt tilgængelighed + bedømmelser (offentlig) ─
export const listSpirits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [spiritsRes, ingRes, ratingsRes] = await Promise.all([
    (sb.from("spirits") as any).select("*").order("position").order("name"),
    sb.from("ingredients").select("id, available"),
    (sb.from("spirit_ratings") as any).select("spirit_id, rating"),
  ]);
  if (spiritsRes.error) throw new Error(spiritsRes.error.message);
  if (ingRes.error) throw new Error(ingRes.error.message);
  if (ratingsRes.error) throw new Error(ratingsRes.error.message);

  const availById = new Map(
    ((ingRes.data ?? []) as Array<{ id: string; available: boolean }>).map((i) => [
      i.id,
      !!i.available,
    ]),
  );

  const ratingMap = new Map<string, { sum: number; count: number }>();
  for (const r of (ratingsRes.data ?? []) as Array<{ spirit_id: string; rating: number }>) {
    const e = ratingMap.get(r.spirit_id) ?? { sum: 0, count: 0 };
    e.sum += Number(r.rating);
    e.count += 1;
    ratingMap.set(r.spirit_id, e);
  }

  const result: SpiritWithDetails[] = ((spiritsRes.data ?? []) as any[]).map((s) => {
    const agg = ratingMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      image_url: s.image_url ?? null,
      spirit_type: s.spirit_type ?? null,
      ingredient_id: s.ingredient_id ?? null,
      position: s.position ?? 0,
      available: s.ingredient_id ? availById.get(s.ingredient_id) ?? false : false,
      avg_rating: agg ? agg.sum / agg.count : null,
      rating_count: agg ? agg.count : 0,
    };
  });
  return result;
});

// ── Bedøm en spiritus (offentlig) — spejler rateCocktail ───────────────────
export const rateSpirit = createServerFn({ method: "POST" })
  .inputValidator((d: { spiritId: string; raterId: string; rating: number }) => {
    if (!/^[0-9a-f-]{8,64}$/i.test(d.raterId)) throw new Error("Ugyldigt rater-id");
    if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5)
      throw new Error("Rating skal være 1–5");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await (sb.from("spirit_ratings") as any).upsert(
      {
        spirit_id: data.spiritId,
        rater_id: data.raterId,
        rating: data.rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "spirit_id,rater_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Mine spiritus-bedømmelser (offentlig) — spejler getMyRatings ───────────
export const getMySpiritRatings = createServerFn({ method: "POST" })
  .inputValidator((d: { raterId: string }) => {
    if (!/^[0-9a-f-]{8,64}$/i.test(d.raterId)) throw new Error("Ugyldigt rater-id");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await (sb.from("spirit_ratings") as any)
      .select("spirit_id, rating")
      .eq("rater_id", data.raterId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as { spirit_id: string; rating: number }[];
  });
