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
  .inputValidator((d: { id?: string; name: string; category: string; available?: boolean }) => ({
    id: d.id,
    ...ingredientInput.parse({ name: d.name, category: d.category, available: d.available }),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("ingredients")
        .update({ name: data.name, category: data.category, available: data.available })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("ingredients")
      .insert({ name: data.name, category: data.category, available: data.available })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
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

    // Resolve / create ingredients
    const ingIds: { ingredient_id: string; amount: number | null; unit: string | null }[] = [];
    for (const item of data.ingredients) {
      const name = item.name.trim();
      if (!name) continue;
      const { data: existing } = await sb
        .from("ingredients")
        .select("id")
        .ilike("name", name)
        .maybeSingle();
      let id = existing?.id as string | undefined;
      if (!id) {
        const { data: created, error } = await sb
          .from("ingredients")
          .insert({ name, category: "Andet", available: false })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        id = created.id;
      }
      ingIds.push({
        ingredient_id: id!,
        amount: item.amount ?? null,
        unit: item.unit ?? null,
      });
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
      const { data: row, error } = await sb
        .from("cocktails")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      cocktailId = row.id;
    }

    // Replace ingredients
    await sb.from("cocktail_ingredients").delete().eq("cocktail_id", cocktailId!);
    if (ingIds.length > 0) {
      const { error } = await sb.from("cocktail_ingredients").insert(
        ingIds.map((r, i) => ({ ...r, cocktail_id: cocktailId!, position: i })),
      );
      if (error) throw new Error(error.message);
    }

    // Replace tags
    await sb.from("cocktail_tags").delete().eq("cocktail_id", cocktailId!);
    if (data.tags.length > 0) {
      const { error } = await sb
        .from("cocktail_tags")
        .insert(data.tags.map((tag) => ({ cocktail_id: cocktailId!, tag })));
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