import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";
import {
  WINE_TYPE_ORDER,
  DEFAULT_WINE_FRIDGE_LAYOUT,
  isValidLayout,
  computeUnplaceTargets,
  type WineFridgeLayout,
  type ScopedPlacement,
} from "@/lib/wines.functions";

const wineTypeSchema = z.enum(WINE_TYPE_ORDER);

const placementSchema = z.object({
  shelf: z.number().int().min(1).max(15),
  slot: z.number().int().min(1).max(20),
  depth: z.number().int().min(1).max(2),
  layer: z.number().int().min(1).max(2),
});

// ── Fælles hjælpere til placeringer ─────────────────────────────────────────
type Pos = { shelf: number; slot: number; depth: number; layer: number };

function posKey(p: Pos): string {
  return `${p.shelf}:${p.slot}:${p.depth}:${p.layer}`;
}

/** Øverste lag-flasker (lag 2) uden to støtteflasker i lag 1 */
function layer2Violations(ps: Pos[]): Set<string> {
  const layer1 = new Set(
    ps.filter((p) => p.layer === 1).map((p) => `${p.shelf}:${p.slot}:${p.depth}`),
  );
  const out = new Set<string>();
  for (const p of ps) {
    if (p.layer !== 2) continue;
    if (!layer1.has(`${p.shelf}:${p.slot}:${p.depth}`) || !layer1.has(`${p.shelf}:${p.slot + 1}:${p.depth}`)) {
      out.add(posKey(p));
    }
  }
  return out;
}

/** Fejler kun hvis en handling EFTERLADER nye øverste flasker uden støtte */
function assertNoNewLayer2Violations(before: Pos[], after: Pos[]) {
  const existing = layer2Violations(before);
  for (const k of layer2Violations(after)) {
    if (!existing.has(k)) {
      throw new Error("Øverste lag kræver flasker på begge nabopladser i nederste lag — flytningen ville efterlade en flaske uden støtte");
    }
  }
}

async function loadLayout(sb: any): Promise<WineFridgeLayout> {
  const { data, error } = await sb.from("app_settings").select("value").eq("key", "wine_fridge_layout").maybeSingle();
  if (error) throw new Error(error.message);
  return data && isValidLayout(data.value) ? data.value : DEFAULT_WINE_FRIDGE_LAYOUT;
}

function assertInBounds(layout: WineFridgeLayout, p: Pos) {
  const shelfDef = layout.shelves[p.shelf - 1];
  if (!shelfDef) throw new Error("Hylden findes ikke i køleskabets layout");
  const slots = p.depth === 1 ? shelfDef.slotsForrest : shelfDef.slotsBagerst;
  const maxSlot = p.layer === 2 ? slots - 1 : slots;
  if (p.slot > maxSlot) throw new Error("Pladsen findes ikke i køleskabets layout");
}

async function loadPlacements(sb: any): Promise<(Pos & { id: string; wine_id: string })[]> {
  const { data, error } = await sb.from("wine_placements").select("id, wine_id, shelf, slot, depth, layer");
  if (error) throw new Error(error.message);
  return (data ?? []) as (Pos & { id: string; wine_id: string })[];
}

/**
 * Gør flasker "uden plads": placeringsrækkerne slettes, og vinens
 * unplaced_count stiger tilsvarende — flaskerne forbliver på lager.
 * Tæller opdateres FØR sletning, så en fejl aldrig får flasker til at forsvinde.
 */
async function unplaceByIds(sb: any, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { data: rows, error } = await sb.from("wine_placements").select("id, wine_id").in("id", ids);
  if (error) throw new Error(error.message);
  const found = (rows ?? []) as { id: string; wine_id: string }[];
  if (found.length === 0) return 0;

  const perWine = new Map<string, number>();
  for (const r of found) perWine.set(r.wine_id, (perWine.get(r.wine_id) ?? 0) + 1);

  const { data: wines, error: wErr } = await sb
    .from("wines").select("id, unplaced_count").in("id", Array.from(perWine.keys()));
  if (wErr) throw new Error(wErr.message);
  const before = new Map<string, number>(((wines ?? []) as any[]).map((w) => [w.id, w.unplaced_count ?? 0]));

  const done: string[] = [];
  const revert = async () => {
    for (const id of done) {
      await sb.from("wines").update({ unplaced_count: before.get(id) ?? 0 }).eq("id", id);
    }
  };

  for (const [wineId, n] of perWine) {
    const { error: uErr } = await sb
      .from("wines").update({ unplaced_count: (before.get(wineId) ?? 0) + n }).eq("id", wineId);
    if (uErr) { await revert(); throw new Error(uErr.message); }
    done.push(wineId);
  }

  const { error: dErr } = await sb.from("wine_placements").delete().in("id", found.map((r) => r.id));
  if (dErr) { await revert(); throw new Error(dErr.message); }

  return found.length;
}

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
  styleId: z.string().trim().max(60).nullable().optional(),
  /** Anbefalet vinglas (public.glass_types.id) */
  glassId: z.string().uuid().nullable().optional(),
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
  /** Samlet antal flasker. Flasker uden valgt plads bliver "uden plads". */
  bottleCount: z.number().int().min(1).max(99).optional(),
  placements: z.array(placementSchema).max(99),
});

export const upsertWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertWineSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    // Samlet antal flasker — de, der ikke har en plads, havner i "uden plads"
    const totalBottles = data.bottleCount ?? data.placements.length;
    if (data.placements.length > totalBottles) {
      throw new Error("Der er valgt flere pladser end flasker");
    }
    const unplacedCount = totalBottles - data.placements.length;

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
      style_id: data.styleId || null,
      glass_id: data.glassId ?? null,
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
      unplaced_count: unplacedCount,
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

// ── Gør én flaske "uden plads" (flasken forbliver på lager) ────────────────
export const deletePlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await unplaceByIds(context.supabase, [data.id]);
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

// ── Tøm hylde / vintype / kategori / hele skabet ───────────────────────────
// Flaskerne forbliver på lager og havner under "Uden plads".
const unplaceScopeSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("shelf"), shelf: z.number().int().min(1).max(15) }),
  z.object({ scope: z.literal("type"), wineType: wineTypeSchema }),
  z.object({ scope: z.literal("style"), styleId: z.string().trim().max(60).nullable() }),
  z.object({ scope: z.literal("all") }),
]);

export const unplaceBottles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unplaceScopeSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; moved: number }> => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    const { data: rows, error } = await sb
      .from("wine_placements")
      .select("id, wine_id, shelf, slot, depth, layer, wines(wine_type, style_id)");
    if (error) throw new Error(error.message);

    const scoped: ScopedPlacement[] = ((rows ?? []) as any[]).map((r) => ({
      id: r.id, wine_id: r.wine_id, shelf: r.shelf, slot: r.slot, depth: r.depth, layer: r.layer,
      wine_type: r.wines?.wine_type ?? "",
      style_id: r.wines?.style_id ?? null,
    }));

    const { ids } = computeUnplaceTargets(scoped, data);
    const moved = await unplaceByIds(sb, ids);
    return { ok: true, moved };
  });

// ── Placér en uplaceret flaske på en ledig plads ───────────────────────────
const placeUnplacedSchema = placementSchema.extend({ wineId: z.string().uuid() });

export const placeUnplacedBottle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => placeUnplacedSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const target: Pos = { shelf: data.shelf, slot: data.slot, depth: data.depth, layer: data.layer };

    const { data: wine, error: wErr } = await sb
      .from("wines").select("id, unplaced_count").eq("id", data.wineId).maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wine) throw new Error("Vinen findes ikke");
    if ((wine.unplaced_count ?? 0) <= 0) throw new Error("Vinen har ingen flasker uden plads");

    assertInBounds(await loadLayout(sb), target);

    const existing = await loadPlacements(sb);
    if (existing.some((p) => posKey(p) === posKey(target))) throw new Error("Pladsen er optaget");
    assertNoNewLayer2Violations(existing, [...existing, target]);

    const { data: inserted, error: insErr } = await sb
      .from("wine_placements")
      .insert({ wine_id: data.wineId, ...target })
      .select("id").single();
    if (insErr) throw new Error(insErr.message);

    const { error: uErr } = await sb
      .from("wines").update({ unplaced_count: wine.unplaced_count - 1 }).eq("id", data.wineId);
    if (uErr) {
      await sb.from("wine_placements").delete().eq("id", inserted.id);
      throw new Error(uErr.message);
    }

    return { ok: true };
  });

// ── Flyt en placeret flaske — eller byt plads hvis målet er optaget ────────
const moveSchema = placementSchema.extend({ placementId: z.string().uuid() });

export const moveOrSwapBottle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => moveSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; swapped: boolean }> => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const target: Pos = { shelf: data.shelf, slot: data.slot, depth: data.depth, layer: data.layer };

    assertInBounds(await loadLayout(sb), target);

    const all = await loadPlacements(sb);
    const source = all.find((p) => p.id === data.placementId);
    if (!source) throw new Error("Flasken findes ikke længere — opdatér siden");
    if (posKey(source) === posKey(target)) throw new Error("Flasken ligger allerede der");

    const occupant = all.find((p) => posKey(p) === posKey(target)) ?? null;
    const sourcePos: Pos = { shelf: source.shelf, slot: source.slot, depth: source.depth, layer: source.layer };

    const after: Pos[] = all.map((p) => {
      if (p.id === source.id) return target;
      if (occupant && p.id === occupant.id) return sourcePos;
      return p;
    });
    assertNoNewLayer2Violations(all, after);

    const { error: aErr } = await sb.from("wine_placements").update(target).eq("id", source.id);
    if (aErr) throw new Error(aErr.message);

    if (occupant) {
      const { error: bErr } = await sb.from("wine_placements").update(sourcePos).eq("id", occupant.id);
      if (bErr) {
        // Rul første flytning tilbage, så ingen flasker ender på samme plads
        await sb.from("wine_placements").update(sourcePos).eq("id", source.id);
        throw new Error(bErr.message);
      }
    }

    return { ok: true, swapped: !!occupant };
  });

// ── Gem køleskabslayout ─────────────────────────────────────────────────────
const layoutSchema = z.object({
  shelves: z.array(z.object({
    slotsForrest: z.number().int().min(1).max(20),
    slotsBagerst: z.number().int().min(1).max(20),
  })).min(1).max(15),
});

export const saveWineFridgeLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => layoutSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; affectedWines: string[] }> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const layout = data as WineFridgeLayout;

    const { data: placed, error: fetchErr } = await (sb.from("wine_placements") as any)
      .select("id, shelf, slot, depth, layer, wine_id, wines(name)");
    if (fetchErr) throw new Error(fetchErr.message);

    const affectedIds: string[] = [];
    const affectedNames = new Set<string>();
    for (const p of (placed ?? []) as any[]) {
      const shelfDef = layout.shelves[p.shelf - 1];
      let outside = !shelfDef;
      if (shelfDef) {
        // depth 1 = forrest, depth 2 = bagerst. Øverste lag har én plads mindre.
        const slots = p.depth === 1 ? shelfDef.slotsForrest : shelfDef.slotsBagerst;
        const maxSlot = p.layer === 2 ? slots - 1 : slots;
        outside = p.slot > maxSlot;
      }
      if (outside) {
        affectedIds.push(p.id);
        if (p.wines?.name) affectedNames.add(p.wines.name);
      }
    }

    // Flasker uden for det nye layout bliver "uden plads" i stedet for at forsvinde fra lageret
    if (affectedIds.length > 0) {
      await unplaceByIds(sb, affectedIds);
    }

    const { error } = await sb.from("app_settings")
      .upsert({ key: "wine_fridge_layout", value: layout as unknown as never });
    if (error) throw new Error(error.message);

    return { ok: true, affectedWines: Array.from(affectedNames) };
  });
