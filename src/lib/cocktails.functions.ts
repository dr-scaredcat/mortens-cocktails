import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
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
  tags: string[];
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
  const [cocktailsRes, ciRes, ingRes, tagsRes] = await Promise.all([
    sb.from("cocktails").select("*").order("name"),
    sb.from("cocktail_ingredients").select("cocktail_id, ingredient_id, amount, unit, position"),
    sb.from("ingredients").select("id, name, available"),
    sb.from("cocktail_tags").select("cocktail_id, tag"),
  ]);
  if (cocktailsRes.error) throw new Error(cocktailsRes.error.message);
  if (ciRes.error) throw new Error(ciRes.error.message);
  if (ingRes.error) throw new Error(ingRes.error.message);
  if (tagsRes.error) throw new Error(tagsRes.error.message);

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
      .map((t) => t.tag);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      glass: c.glass,
      garnish: c.garnish,
      instructions: c.instructions,
      tags,
      ingredients: items,
      missing,
    };
  });
  return result;
});