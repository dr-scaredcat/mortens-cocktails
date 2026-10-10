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
    // INSERT med onConflict DO NOTHING — fejler ikke hvis den allerede eksisterer
    const { error } = await context.supabase
      .from("shopping_list" as any)
      .insert({ ingredient_id: data.ingredientId });
    // Ignorer unique-violation (kode 23505) — ingrediensen er allerede på listen
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

// ── Fjern ingrediens og marker som tilgængelig i lageret ─────────────────────
export const removeFromShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientId: string }) =>
    z.object({ ingredientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error: availErr } = await context.supabase
      .from("ingredients")
      .update({ available: true })
      .eq("id", data.ingredientId);
    if (availErr) throw new Error(availErr.message);

    const { error } = await context.supabase
      .from("shopping_list" as any)
      .delete()
      .eq("ingredient_id", data.ingredientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Fjern ingrediens fra listen UDEN at markere som tilgængelig ──────────────
export const removeFromShoppingListOnly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientId: string }) =>
    z.object({ ingredientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shopping_list" as any)
      .delete()
      .eq("ingredient_id", data.ingredientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Tilføj flere på én gang — springer over dem der allerede er på listen ─────
export const addManyToShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ingredientIds: string[] }) =>
    z.object({ ingredientIds: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Hent eksisterende for at undgå RLS-fejl ved duplicate insert
    const { data: existing } = await context.supabase
      .from("shopping_list" as any)
      .select("ingredient_id")
      .in("ingredient_id", data.ingredientIds);

    const existingIds = new Set((existing ?? []).map((r: any) => r.ingredient_id));
    const toInsert = data.ingredientIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ ingredient_id: id }));

    if (toInsert.length === 0) return { ok: true, inserted: 0 };

    const { error } = await context.supabase
      .from("shopping_list" as any)
      .insert(toInsert);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: toInsert.length };
  });
