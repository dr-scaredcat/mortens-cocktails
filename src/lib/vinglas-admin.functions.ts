import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";

// ── Opret/opdatér glastype ──────────────────────────────────────────────────
const upsertGlassTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  quantityOwned: z.number().int().min(0).max(999).nullable().optional(),
});

export const upsertGlassType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertGlassTypeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const payload = {
      name: data.name,
      image_url: data.imageUrl?.trim() || null,
      quantity_owned: data.quantityOwned ?? null,
    };
    if (data.id) {
      const { error } = await (sb.from("glass_types") as any).update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (sb.from("glass_types") as any)
      .insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ── Slet glastype (CASCADE sletter tilhørende opslag) ───────────────────────
export const deleteGlassType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("glass_types") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Opret/opdatér drue/vin → glas opslag ────────────────────────────────────
const upsertMappingSchema = z.object({
  id: z.string().uuid().optional(),
  wineName: z.string().trim().min(1).max(200),
  glassId: z.string().uuid(),
});

export const upsertGrapeMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertMappingSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const payload = { wine_name: data.wineName, glass_id: data.glassId };
    if (data.id) {
      const { error } = await (sb.from("grape_glass_mapping") as any).update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (sb.from("grape_glass_mapping") as any)
      .insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ── Slet drue/vin → glas opslag ─────────────────────────────────────────────
export const deleteGrapeMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("grape_glass_mapping") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
