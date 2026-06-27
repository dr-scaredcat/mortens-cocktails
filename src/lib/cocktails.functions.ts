import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    process.env.SUPABASE_URL ||
    "https://dkvrwwpbaarfyqyrnhha.supabase.co";
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_NsAPFaHuYb2mQbejaLy9WQ_BtLxx8ri";
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type IngredientRow = {
  id: string;
  name: string;
  category: string;
  available: boolean;
};

export type CocktailWithDetails = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  glass: string | null;
  garnish: string | null;
  instructions: string | null;
  on_menu: boolean;
  position: number;
  tags: string[];
  ingredients: {
    ingredient_id: string;
    name: string;
    amount: number | null;
    unit: string | null;
    available: boolean;
  }[];
  missing: string[];
  avg_rating: number | null;
  rating_count: number;
};

export type RecipeWithDetails = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  images: { id: string; url: string; position: number }[];
  ingredients: {
    ingredient_id: string;
    name: string;
    amount: number | null;
    unit: string | null;
    available: boolean;
  }[];
  missing: string[];
};

export const listIngredients = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("ingredients")
    .select("id, name, category, available")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as IngredientRow[];
});

export type CategoryRow = { id: string; name: string; position: number };
export type TagRow = { id: string; name: string; position: number };

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("categories")
    .select("id, name, position")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryRow[];
});

export const listTags = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("tags")
    .select("id, name, position")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TagRow[];
});

export const listCocktails = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [cocktailsRes, ciRes, ingRes, tagsRes, ratingsRes, tagListRes] = await Promise.all([
    sb.from("cocktails").select("*").order("position").order("name"),
    sb.from("cocktail_ingredients").select("cocktail_id, ingredient_id, amount, unit, position"),
    sb.from("ingredients").select("id, name, available"),
    sb.from("cocktail_tags").select("cocktail_id, tag"),
    sb.from("cocktail_ratings").select("cocktail_id, rating"),
    sb.from("tags").select("name, position").order("position"),
  ]);
  if (cocktailsRes.error) throw new Error(cocktailsRes.error.message);
  if (ciRes.error) throw new Error(ciRes.error.message);
  if (ingRes.error) throw new Error(ingRes.error.message);
  if (tagsRes.error) throw new Error(tagsRes.error.message);
  if (ratingsRes.error) throw new Error(ratingsRes.error.message);
  if (tagListRes.error) throw new Error(tagListRes.error.message);

  const tagOrder = new Map((tagListRes.data ?? []).map((t) => [t.name, t.position]));

  const ratingMap = new Map<string, { sum: number; count: number }>();
  for (const r of ratingsRes.data ?? []) {
    const e = ratingMap.get(r.cocktail_id) ?? { sum: 0, count: 0 };
    e.sum += Number(r.rating);
    e.count += 1;
    ratingMap.set(r.cocktail_id, e);
  }

  const ingMap = new Map((ingRes.data ?? []).map((i) => [i.id, i]));
  const result: CocktailWithDetails[] = (cocktailsRes.data ?? []).map((c) => {
    const items = (ciRes.data ?? [])
      .filter((r) => r.cocktail_id === c.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((r) => {
        const ing = ingMap.get(r.ingredient_id);
        return {
          ingredient_id: r.ingredient_id,
          name: ing?.name ?? "Ukendt",
          amount: r.amount,
          unit: r.unit,
          available: !!ing?.available,
        };
      });
    const missing = items.filter((i) => !i.available).map((i) => i.name);
    const tags = (tagsRes.data ?? [])
      .filter((t) => t.cocktail_id === c.id)
      .map((t) => t.tag)
      .sort((a, b) => (tagOrder.get(a) ?? 999) - (tagOrder.get(b) ?? 999));
    const agg = ratingMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      glass: c.glass,
      garnish: c.garnish,
      instructions: c.instructions,
      on_menu: (c as any).on_menu ?? true,
      position: (c as any).position ?? 0,
      tags,
      ingredients: items,
      missing,
      avg_rating: agg ? agg.sum / agg.count : null,
      rating_count: agg ? agg.count : 0,
    };
  });
  return result;
});

export const listRecipes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [recipesRes, imagesRes, riRes, ingRes] = await Promise.all([
    sb.from("recipes").select("*").order("name"),
    sb.from("recipe_images").select("id, recipe_id, url, position").order("position"),
    sb.from("recipe_ingredients").select("recipe_id, ingredient_id, amount, unit, position"),
    sb.from("ingredients").select("id, name, available"),
  ]);
  if (recipesRes.error) throw new Error(recipesRes.error.message);
  if (imagesRes.error) throw new Error(imagesRes.error.message);
  if (riRes.error) throw new Error(riRes.error.message);
  if (ingRes.error) throw new Error(ingRes.error.message);

  const ingMap = new Map((ingRes.data ?? []).map((i) => [i.id, i]));

  const result: RecipeWithDetails[] = (recipesRes.data ?? []).map((r) => {
    const images = (imagesRes.data ?? [])
      .filter((img) => img.recipe_id === r.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((img) => ({ id: img.id, url: img.url, position: img.position }));

    const items = (riRes.data ?? [])
      .filter((ri) => ri.recipe_id === r.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((ri) => {
        const ing = ingMap.get(ri.ingredient_id);
        return {
          ingredient_id: ri.ingredient_id,
          name: ing?.name ?? "Ukendt",
          amount: ri.amount,
          unit: ri.unit,
          available: !!ing?.available,
        };
      });

    const missing = items.filter((i) => !i.available).map((i) => i.name);

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      instructions: r.instructions,
      images,
      ingredients: items,
      missing,
    };
  });

  return result;
});

export const rateCocktail = createServerFn({ method: "POST" })
  .inputValidator((d: { cocktailId: string; raterId: string; rating: number }) => {
    if (!/^[0-9a-f-]{8,64}$/i.test(d.raterId)) throw new Error("Ugyldigt rater-id");
    if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5)
      throw new Error("Rating skal være 1–5");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb
      .from("cocktail_ratings")
      .upsert(
        {
          cocktail_id: data.cocktailId,
          rater_id: data.raterId,
          rating: data.rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cocktail_id,rater_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRatings = createServerFn({ method: "POST" })
  .inputValidator((d: { raterId: string }) => {
    if (!/^[0-9a-f-]{8,64}$/i.test(d.raterId)) throw new Error("Ugyldigt rater-id");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb
      .from("cocktail_ratings")
      .select("cocktail_id, rating")
      .eq("rater_id", data.raterId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as { cocktail_id: string; rating: number }[];
  });

export type GlassRow = { id: string; name: string };
export type GarnishRow = { id: string; name: string };

export const listGlasses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("glasses").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as GlassRow[];
});

export const listGarnishes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("garnishes").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as GarnishRow[];
});
