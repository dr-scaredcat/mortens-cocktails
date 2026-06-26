import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kun administratorer kan udføre denne handling");
}

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
    const { data: used } = await sb.from("cocktail_ingredients").select("ingredient_id");
    const usedIds = (used ?? []).map(
      (r: { ingredient_id: string }) => r.ingredient_id,
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

    const ingIds: { ingredient_id: string; amount: number | null; unit: string | null }[] = [];
    for (const item of data.ingredients) {
      const name = item.name.trim();
      if (!name) continue;
      const { data: existingIng } = await sb
        .from("ingredients")
        .select("id")
        .ilike("name", name)
        .maybeSingle();
      let id = existingIng?.id as string | undefined;
      if (!id) {
        const { data: created, error } = await sb
          .from("ingredients")
          .insert({ name, category: "Andet", available: false })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        id = created.id;
      }
      ingIds.push({ ingredient_id: id!, amount: item.amount ?? null, unit: item.unit ?? null });
    }

    if (data.glass?.trim()) {
      await sb
        .from("glasses")
        .upsert({ name: data.glass.trim() }, { onConflict: "name", ignoreDuplicates: true });
    }
    if (data.garnish?.trim()) {
      await sb
        .from("garnishes")
        .upsert({ name: data.garnish.trim() }, { onConflict: "name", ignoreDuplicates: true });
    }

    const payload = {
      name: data.name,
      description: data.description ?? null,
      image_url: data.image_url && data.image_url.length > 0 ? data.image_url : null,
      glass: data.glass ?? null,
      garnish: data.garnish ?? null,
      instructions: data.instructions ?? null,
      created_by: context.userId,
    };

    let cocktailId = data.id;
    if (cocktailId) {
      const { error } = await sb.from("cocktails").update(payload).eq("id", cocktailId);
      if (error) throw new Error(error.message);
    } else {
      // Ny cocktail: sæt position til max+1 så den havner sidst
      const { data: maxRow } = await sb
        .from("cocktails")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = (maxRow?.position ?? 0) + 1;
      const { data: row, error } = await sb
        .from("cocktails")
        .insert({ ...payload, position: nextPos })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      cocktailId = row.id;
    }

    await sb.from("cocktail_ingredients").delete().eq("cocktail_id", cocktailId!);
    if (ingIds.length > 0) {
      const { error } = await sb.from("cocktail_ingredients").insert(
        ingIds.map((r, i) => ({ ...r, cocktail_id: cocktailId!, position: i })),
      );
      if (error) throw new Error(error.message);
    }

    await sb.from("cocktail_tags").delete().eq("cocktail_id", cocktailId!);
    if (data.tags.length > 0) {
      const { error } = await sb.from("cocktail_tags").insert(
        data.tags.map((tag) => ({ cocktail_id: cocktailId!, tag })),
      );
      if (error) throw new Error(error.message);
    }

    return { id: cocktailId };
  });

export const deleteCocktail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cocktails").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetCocktailRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_ratings")
      .delete()
      .eq("cocktail_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderCocktails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: string[]) => z.array(z.string().uuid()).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    for (let i = 0; i < data.length; i++) {
      await sb.from("cocktails").update({ position: i }).eq("id", data[i]);
    }
    return { ok: true };
  });

export const setCocktailsOnMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; onMenu: boolean }) =>
    z.object({ ids: z.array(z.string().uuid()), onMenu: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktails")
      .update({ on_menu: data.onMenu })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function lookupCocktailDbImage(name: string): Promise<string | null> {
  const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.drinks?.length) return null;
    const pick = json.drinks[0];
    return pick.strDrinkThumb ?? null;
  } catch {
    return null;
  }
}

export const fetchCocktailDbImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const image = await lookupCocktailDbImage(data.name);
    return { image };
  });

export const backfillCocktailImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: rows, error } = await sb.from("cocktails").select("id, name, image_url");
    if (error) throw new Error(error.message);
    let updated = 0;
    let missing = 0;
    for (const c of rows ?? []) {
      if (c.image_url) continue;
      const image = await lookupCocktailDbImage(c.name);
      if (!image) { missing += 1; continue; }
      const { error: upErr } = await sb.from("cocktails").update({ image_url: image }).eq("id", c.id);
      if (!upErr) updated += 1;
    }
    return { updated, missing };
  });
