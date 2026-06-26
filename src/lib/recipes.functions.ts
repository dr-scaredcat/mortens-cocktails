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

const recipeImageInput = z.object({
  url: z.string().url(),
  position: z.number().int().default(0),
});

const recipeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  images: z.array(recipeImageInput).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
      }),
    )
    .min(0),
});

export const saveRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recipeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    // Resolve / auto-create ingredients
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
      ingIds.push({ ingredient_id: id!, amount: item.amount ?? null, unit: item.unit ?? null });
    }

    const payload = {
      name: data.name,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
    };

    let recipeId: string;

    if (data.id) {
      const { error } = await sb.from("recipes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      recipeId = data.id;
    } else {
      const { data: row, error } = await sb
        .from("recipes")
        .insert({ ...payload, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      recipeId = row.id;
    }

    // Replace images
    await sb.from("recipe_images").delete().eq("recipe_id", recipeId);
    if (data.images.length > 0) {
      const { error } = await sb.from("recipe_images").insert(
        data.images.map((img, i) => ({ recipe_id: recipeId, url: img.url, position: i })),
      );
      if (error) throw new Error(error.message);
    }

    // Replace ingredients
    await sb.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    if (ingIds.length > 0) {
      const { error } = await sb.from("recipe_ingredients").insert(
        ingIds.map((r, i) => ({ ...r, recipe_id: recipeId, position: i })),
      );
      if (error) throw new Error(error.message);
    }

    return { id: recipeId };
  });

export const deleteRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("recipes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
