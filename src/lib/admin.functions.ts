import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: !!data, userId: context.userId };
  });

const ingredientInput = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1),
  available: z.boolean().optional().default(false),
});

export const upsertIngredient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; category: string; available?: boolean }) =>
    ingredientInput.extend({ id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    if (data.id) {
      const { error } = await sb
        .from("ingredients")
        .update({ name: data.name, category: data.category, available: data.available ?? false })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("ingredients").insert({
        name: data.name,
        category: data.category,
        available: data.available ?? false,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setIngredientAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; available: boolean }) =>
    z.object({ id: z.string().uuid(), available: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ingredients")
      .update({ available: data.available })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIngredient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("ingredients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUnusedIngredients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    // Hent ingredienser brugt i cocktails
    const { data: usedInCocktails } = await sb.from("cocktail_ingredients").select("ingredient_id");
    // Hent ingredienser brugt i opskrifter
    const { data: usedInRecipes } = await sb.from("recipe_ingredients" as any).select("ingredient_id");

    const usedIds = Array.from(
      new Set([
        ...((usedInCocktails ?? []) as { ingredient_id: string }[]).map((r) => r.ingredient_id),
        ...((usedInRecipes ?? []) as { ingredient_id: string }[]).map((r) => r.ingredient_id),
      ]),
    );

    if (usedIds.length === 0) {
      const { error, count } = await (sb.from("ingredients").delete().not("id", "is", null) as any).select("id");
      if (error) throw new Error(error.message);
      return { deleted: count ?? 0 };
    }
    const { error, count } = await (
      sb.from("ingredients").delete().not("id", "in", `(${usedIds.join(",")})`) as any
    ).select("id");
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

// =================== Cocktails ===================

const cocktailInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  image_url: z.string().url().nullable().optional().or(z.literal("")),
  glass: z.string().max(80).nullable().optional(),
  garnish: z.string().max(120).nullable().optional(),
  instructions: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string()).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export const saveCocktail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cocktailInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    // ── Tjek om et ANDET cocktail allerede har dette navn (case-insensitiv) ──
    const { data: existing } = await sb
      .from("cocktails")
      .select("id")
      .ilike("name", data.name.trim())
      .maybeSingle();
    if (existing && existing.id !== data.id) {
      throw new Error(`En cocktail med navnet "${data.name.trim()}" eksisterer allerede`);
    }

    // ── Resolve / auto-create ingredienser — batch i stedet for sekventielt ──
    const names = data.ingredients.map((i) => i.name.trim()).filter((n) => n.length > 0);

    const { data: allIngs, error: ingErr } = await sb.from("ingredients").select("id, name");
    if (ingErr) throw new Error(ingErr.message);

    const idByLowerName = new Map<string, string>(
      (allIngs ?? []).map((i: { id: string; name: string }) => [i.name.trim().toLowerCase(), i.id]),
    );

    const missing = [...new Set(names.filter((n) => !idByLowerName.has(n.toLowerCase())))];
    if (missing.length > 0) {
      const { data: newIngs, error: insertErr } = await sb
        .from("ingredients")
        .insert(missing.map((n) => ({ name: n, category: "Andet" })))
        .select("id, name");
      if (insertErr) throw new Error(insertErr.message);
      for (const ing of newIngs ?? []) {
        idByLowerName.set(ing.name.trim().toLowerCase(), ing.id);
      }
    }

    const resolvedIngredients = data.ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((i, pos) => ({
        ingredient_id: idByLowerName.get(i.name.trim().toLowerCase())!,
        amount: i.amount ?? null,
        unit: i.unit ?? null,
        position: pos,
      }));

    if (data.id) {
      // Update
      const { error: updErr } = await sb
        .from("cocktails")
        .update({
          name: data.name.trim(),
          description: data.description ?? null,
          image_url: data.image_url || null,
          glass: data.glass ?? null,
          garnish: data.garnish ?? null,
          instructions: data.instructions ?? null,
        })
        .eq("id", data.id);
      if (updErr) throw new Error(updErr.message);

      // Sync tags
      await sb.from("cocktail_tags" as any).delete().eq("cocktail_id", data.id);
      if (data.tags.length > 0) {
        const { data: tagRows } = await sb.from("tags").select("id, name").in("name", data.tags);
        if (tagRows && tagRows.length > 0) {
          await sb.from("cocktail_tags" as any).insert(
            tagRows.map((t: { id: string }) => ({ cocktail_id: data.id, tag_id: t.id })),
          );
        }
      }

      // Replace ingredients
      await sb.from("cocktail_ingredients").delete().eq("cocktail_id", data.id);
      if (resolvedIngredients.length > 0) {
        const { error: ingInsErr } = await sb.from("cocktail_ingredients").insert(
          resolvedIngredients.map((r) => ({ ...r, cocktail_id: data.id })),
        );
        if (ingInsErr) throw new Error(ingInsErr.message);
      }
      return { id: data.id };
    } else {
      // Insert
      const { data: newCocktail, error: insErr } = await sb
        .from("cocktails")
        .insert({
          name: data.name.trim(),
          description: data.description ?? null,
          image_url: data.image_url || null,
          glass: data.glass ?? null,
          garnish: data.garnish ?? null,
          instructions: data.instructions ?? null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      const cocktailId = newCocktail.id;

      // Sync tags
      if (data.tags.length > 0) {
        const { data: tagRows } = await sb.from("tags").select("id, name").in("name", data.tags);
        if (tagRows && tagRows.length > 0) {
          await sb.from("cocktail_tags" as any).insert(
            tagRows.map((t: { id: string }) => ({ cocktail_id: cocktailId, tag_id: t.id })),
          );
        }
      }

      if (resolvedIngredients.length > 0) {
        const { error: ingInsErr } = await sb.from("cocktail_ingredients").insert(
          resolvedIngredients.map((r) => ({ ...r, cocktail_id: cocktailId })),
        );
        if (ingInsErr) throw new Error(ingInsErr.message);
      }
      return { id: cocktailId };
    }
  });
