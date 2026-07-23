import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";
import { WINE_TYPE_ORDER, type WineFridgeLayout } from "@/lib/wines.functions";

const wineTypeSchema = z.enum(WINE_TYPE_ORDER);

const placementSchema = z.object({
  shelf: z.number().int().min(1).max(15),
  slot: z.number().int().min(1).max(20),
  depth: z.number().int().min(1).max(2),
  layer: z.number().int().min(1).max(2),
});

// ── Gem wine_self_serve (admin) ─────────────────────────────────────────────
export const setWineSelfServe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "wine_self_serve", value: data.enabled as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Opret/opdatér vin ──────────────────────────────────────────────────────
const upsertWineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  producer: z.string().trim().max(120).nullable().optional(),
  vintage: z.number().int().min(1900).max(2100).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  grapes: z.string().trim().max(200).nullable().optional(),
  wineType: wineTypeSchema,
  abv: z.number().min(0).max(100).nullable().optional(),
  bottleSizeCl: z.number().int().min(1).max(3000).optional().default(75),
  price: z.number().min(0).nullable().optional(),
  drinkFrom: z.number().int().min(1900).max(2100).nullable().optional(),
  drinkTo: z.number().int().min(1900).max(2100).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  tastingNotes: z.string().trim().max(1000).nullable().optional(),
  foodPairing: z.string().trim().max(500).nullable().optional(),
  servingTemp: z.string().trim().max(60).nullable().optional(),
  placements: z.array(placementSchema).max(99),
});

export const upsertWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertWineSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    // Ingen interne duplikater
    const posKeys = data.placements.map((p) => `${p.shelf}:${p.slot}:${p.depth}:${p.layer}`);
    if (new Set(posKeys).size !== posKeys.length) {
      throw new Error("To eller flere placeringer er identiske");
    }

    // Valider layer=2: kræver nabo-par i lag 1
    if (data.placements.some((p) => p.layer === 2)) {
      let q = (sb.from("wine_placements") as any).select("shelf, slot, depth, layer");
      if (data.id) q = q.neq("wine_id", data.id);
      const { data: existing, error: epErr } = await q;
      if (epErr) throw new Error(epErr.message);

      const allLayer1 = new Set<string>();
      for (const ep of (existing ?? []) as any[]) {
        if (ep.layer === 1) allLayer1.add(`${ep.shelf}:${ep.slot}:${ep.depth}`);
      }
      for (const p of data.placements) {
        if (p.layer === 1) allLayer1.add(`${p.shelf}:${p.slot}:${p.depth}`);
      }
      for (const p of data.placements) {
        if (p.layer === 2) {
          if (!allLayer1.has(`${p.shelf}:${p.slot}:${p.depth}`) ||
              !allLayer1.has(`${p.shelf}:${p.slot + 1}:${p.depth}`)) {
            throw new Error(
              `Øverste lag hylde ${p.shelf}, plads ${p.slot} (${p.depth === 1 ? "forrest" : "bagerst"}) kræver flasker på plads ${p.slot} og ${p.slot + 1} i lag 1`,
            );
          }
        }
      }
    }

    // Kollisionstjek mod andre vine
    if (data.placements.length > 0) {
      let colQ = (sb.from("wine_placements") as any).select("shelf, slot, depth, layer, wine_id, wines(name)");
      if (data.id) colQ = colQ.neq("wine_id", data.id);
      const { data: existing, error: colErr } = await colQ;
      if (colErr) throw new Error(colErr.message);

      const occupied = new Map<string, string>();
      for (const ep of (existing ?? []) as any[]) {
        occupied.set(`${ep.shelf}:${ep.slot}:${ep.depth}:${ep.layer}`, ep.wines?.name ?? "en anden vin");
      }
      for (const p of data.placements) {
        const key = `${p.shelf}:${p.slot}:${p.depth}:${p.layer}`;
        if (occupied.has(key)) throw new Error(`Pladsen er optaget af ${occupied.get(key)}`);
      }
    }

    const winePayload = {
      name: data.name,
      producer: data.producer ?? null,
      vintage: data.vintage ?? null,
      country: data.country ?? null,
      region: data.region ?? null,
      grapes: data.grapes ?? null,
      wine_type: data.wineType,
      abv: data.abv ?? null,
      bottle_size_cl: data.bottleSizeCl ?? 75,
      price: data.price ?? null,
      drink_from: data.drinkFrom ?? null,
      drink_to: data.drinkTo ?? null,
      image_url: data.imageUrl?.trim() || null,
      description: data.description?.trim() || null,
      tasting_notes: data.tastingNotes?.trim() || null,
      food_pairing: data.foodPairing?.trim() || null,
      serving_temp: data.servingTemp?.trim() || null,
    };

    let wineId: string;
    if (data.id) {
      const { error } = await (sb.from("wines") as any).update(winePayload).eq("id", data.id);
      if (error) throw new Error(error.message);
      wineId = data.id;
      const { error: delErr } = await (sb.from("wine_placements") as any).delete().eq("wine_id", wineId);
      if (delErr) throw new Error(delErr.message);
    } else {
      const { data: row, error } = await (sb.from("wines") as any)
        .insert({ ...winePayload, created_by: context.userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      wineId = row.id;
    }

    if (data.placements.length > 0) {
      const rows = data.placements.map((p) => ({ wine_id: wineId, shelf: p.shelf, slot: p.slot, depth: p.depth, layer: p.layer }));
      const { error: insErr } = await (sb.from("wine_placements") as any).insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { id: wineId };
  });

// ── Slet én placering ───────────────────────────────────────────────────────
export const deletePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("wine_placements") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Slet vin (CASCADE sletter placeringer) ──────────────────────────────────
export const deleteWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("wines") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Gem køleskabslayout ─────────────────────────────────────────────────────
const layoutSchema = z.object({
  shelves: z.array(z.object({ slots: z.number().int().min(1).max(20) })).min(1).max(15),
});

export const saveWineFridgeLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => layoutSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; affectedWines: string[] }> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const layout = data as WineFridgeLayout;

    const { data: placed, error: fetchErr } = await (sb.from("wine_placements") as any)
      .select("id, shelf, slot, wine_id, wines(name)");
    if (fetchErr) throw new Error(fetchErr.message);

    const affectedIds: string[] = [];
    const affectedNames = new Set<string>();
    for (const p of (placed ?? []) as any[]) {
      const shelfDef = layout.shelves[p.shelf - 1];
      if (!shelfDef || p.slot > shelfDef.slots) {
        affectedIds.push(p.id);
        if (p.wines?.name) affectedNames.add(p.wines.name);
      }
    }

    if (affectedIds.length > 0) {
      const { error: delErr } = await (sb.from("wine_placements") as any).delete().in("id", affectedIds);
      if (delErr) throw new Error(delErr.message);
    }

    const { error } = await sb.from("app_settings")
      .upsert({ key: "wine_fridge_layout", value: layout as unknown as never });
    if (error) throw new Error(error.message);

    return { ok: true, affectedWines: Array.from(affectedNames) };
  });
