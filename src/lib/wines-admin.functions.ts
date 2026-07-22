import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";
import { WINE_TYPE_ORDER, type WineFridgeLayout } from "@/lib/wines.functions";

// Al admin-skrivning for vin-lageret samles i dette selvstændige modul
// frem for at vokse den allerede store admin.functions.ts yderligere —
// samme opdelingsprincip som themes.functions.ts og
// sort-settings.functions.ts bruger for deres områder.

const wineTypeSchema = z.enum(WINE_TYPE_ORDER);

// =================== Opret/opdatér vin ===================

const upsertWineSchema = z
  .object({
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
    quantity: z.number().int().min(0).max(9999).optional().default(1),
    shelf: z.number().int().min(1).max(15).nullable().optional(),
    slot: z.number().int().min(1).max(20).nullable().optional(),
    imageUrl: z.string().trim().max(2000).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    tastingNotes: z.string().trim().max(1000).nullable().optional(),
    foodPairing: z.string().trim().max(500).nullable().optional(),
    servingTemp: z.string().trim().max(60).nullable().optional(),
  })
  .refine(
    (d) => {
      const hasShelf = d.shelf !== null && d.shelf !== undefined;
      const hasSlot = d.slot !== null && d.slot !== undefined;
      return hasShelf === hasSlot;
    },
    {
      message: "Hylde og plads skal enten begge være valgt, eller begge stå tomme",
      path: ["slot"],
    },
  );

export const upsertWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertWineSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    const shelf = data.shelf ?? null;
    const slot = data.slot ?? null;

    // Tjek om pladsen allerede er optaget af en anden vin.
    if (shelf !== null && slot !== null) {
      let occupiedQuery = (sb.from("wines") as any)
        .select("id, name")
        .eq("shelf", shelf)
        .eq("slot", slot);
      if (data.id) occupiedQuery = occupiedQuery.neq("id", data.id);
      const { data: occupied, error: occErr } = await occupiedQuery.maybeSingle();
      if (occErr) throw new Error(occErr.message);
      if (occupied) {
        throw new Error(`Pladsen er optaget af ${occupied.name}`);
      }
    }

    const payload = {
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
      quantity: data.quantity ?? 1,
      shelf,
      slot,
      image_url: data.imageUrl && data.imageUrl.length > 0 ? data.imageUrl : null,
      description:
        data.description && data.description.length > 0 ? data.description : null,
      tasting_notes:
        data.tastingNotes && data.tastingNotes.length > 0 ? data.tastingNotes : null,
      food_pairing:
        data.foodPairing && data.foodPairing.length > 0 ? data.foodPairing : null,
      serving_temp:
        data.servingTemp && data.servingTemp.length > 0 ? data.servingTemp : null,
    };

    if (data.id) {
      const { error } = await (sb.from("wines") as any).update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await (sb.from("wines") as any)
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// =================== Slet vin ===================

export const deleteWine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("wines") as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Vinkøleskabets layout ===================

const layoutSchema = z.object({
  shelves: z
    .array(z.object({ slots: z.number().int().min(1).max(20) }))
    .min(1)
    .max(15),
});

export const saveWineFridgeLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => layoutSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; affectedWines: string[] }> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const layout = data as WineFridgeLayout;

    // Find vine der havner udenfor det nye layout (hylde findes ikke
    // længere, eller pladsen overskrider det nye antal pr. hylde), og
    // nulstil deres placering.
    const { data: placed, error: fetchErr } = await (sb.from("wines") as any)
      .select("id, name, shelf, slot")
      .not("shelf", "is", null)
      .not("slot", "is", null);
    if (fetchErr) throw new Error(fetchErr.message);

    const affected: { id: string; name: string }[] = [];
    for (const w of (placed ?? []) as Array<{
      id: string;
      name: string;
      shelf: number;
      slot: number;
    }>) {
      const shelfDef = layout.shelves[w.shelf - 1];
      if (!shelfDef || w.slot > shelfDef.slots) {
        affected.push({ id: w.id, name: w.name });
      }
    }

    if (affected.length > 0) {
      const { error: clearErr } = await (sb.from("wines") as any)
        .update({ shelf: null, slot: null })
        .in(
          "id",
          affected.map((a) => a.id),
        );
      if (clearErr) throw new Error(clearErr.message);
    }

    const { error } = await sb
      .from("app_settings")
      .upsert({ key: "wine_fridge_layout", value: layout as unknown as never });
    if (error) throw new Error(error.message);

    return { ok: true, affectedWines: affected.map((a) => a.name) };
  });
