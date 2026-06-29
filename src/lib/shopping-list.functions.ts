import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient } from "@/lib/supabase-shared";
import { z } from "zod";

// ── Hent hele indkøbslisten (inkl. ingrediens-detaljer) ──────────────────────
export const getShoppingList = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("shopping_list" as any)
    .select("ingredient_id, added_at, ingredients(id, name, category)")
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    ingredient_id: string;
    added_at: string;
    ingredients: { id: string; name: string; category: string };
  }>;
});

// ── Tilføj ingrediens til listen ─────────────────────────────────────────────
export const addToShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientId: string }) =>
    z.object({ ingredientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shopping_list" as any)
      .upsert({ ingredient_id: data.ingredientId }, { onConflict: "ingredient_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Fjern ingrediens fra listen (og marker som tilgængelig i lageret) ─────────
export const removeFromShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientId: string }) =>
    z.object({ ingredientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Marker som tilgængelig i lageret
    const { error: availErr } = await context.supabase
      .from("ingredients")
      .update({ available: true })
      .eq("id", data.ingredientId);
    if (availErr) throw new Error(availErr.message);

    // Fjern fra indkøbslisten
    const { error } = await context.supabase
      .from("shopping_list" as any)
      .delete()
      .eq("ingredient_id", data.ingredientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Tilføj flere på én gang (fra cocktail-kortet) ────────────────────────────
export const addManyToShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientIds: string[] }) =>
    z.object({ ingredientIds: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.ingredientIds.map((id) => ({ ingredient_id: id }));
    const { error } = await context.supabase
      .from("shopping_list" as any)
      .upsert(rows, { onConflict: "ingredient_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

