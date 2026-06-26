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

export const deleteUnusedIngredients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: used, error: usedErr } = await sb
      .from("cocktail_ingredients")
      .select("ingredient_id");
    if (usedErr) throw new Error(usedErr.message);
    const usedIds: string[] = (used ?? []).map(
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

    // Auto-opret glas i tabellen hvis det ikke allerede findes
    if (data.glass?.trim()) {
      await sb
        .from("glasses")
        .upsert({ name: data.glass.trim() }, { onConflict: "name", ignoreDuplicates: true });
    }

    // Auto-opret pynt i tabellen hvis den ikke allerede findes
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

export const setCocktailsOnMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; onMenu: boolean }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), onMenu: z.boolean() }).parse(d),
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

// =================== Categories ===================

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; oldName?: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(60),
        oldName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    if (data.id) {
      const { error } = await sb.from("categories").update({ name: data.name }).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (data.oldName && data.oldName !== data.name) {
        await sb
          .from("ingredients")
          .update({ category: data.name })
          .eq("category", data.oldName);
      }
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("categories")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    // Move ingredients in this category to "Andet"
    await sb.from("ingredients").update({ category: "Andet" }).eq("category", data.name);
    const { error } = await sb.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Tags ===================

export const upsertTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; oldName?: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(40),
        oldName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    if (data.id) {
      const { error } = await sb.from("tags").update({ name: data.name }).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (data.oldName && data.oldName !== data.name) {
        await sb.from("cocktail_tags").update({ tag: data.name }).eq("tag", data.oldName);
      }
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("tags")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    await sb.from("cocktail_tags").delete().eq("tag", data.name);
    const { error } = await sb.from("tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Glasses ===================

export const upsertGlass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; oldName?: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        oldName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    if (data.id) {
      const { error } = await sb.from("glasses").update({ name: data.name }).eq("id", data.id);
      if (error) throw new Error(error.message);
      // Cascade rename til alle cocktails der bruger det gamle glasnavn
      if (data.oldName && data.oldName !== data.name) {
        await sb.from("cocktails").update({ glass: data.name }).eq("glass", data.oldName);
      }
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("glasses")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteGlass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    // Nulstil glasfeltet på cocktails der bruger dette glas
    await sb.from("cocktails").update({ glass: null }).eq("glass", data.name);
    const { error } = await sb.from("glasses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Garnishes ===================

export const upsertGarnish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; oldName?: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        oldName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    if (data.id) {
      const { error } = await sb.from("garnishes").update({ name: data.name }).eq("id", data.id);
      if (error) throw new Error(error.message);
      // Cascade rename til alle cocktails der bruger det gamle pyntnavn
      if (data.oldName && data.oldName !== data.name) {
        await sb.from("cocktails").update({ garnish: data.name }).eq("garnish", data.oldName);
      }
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("garnishes")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteGarnish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    // Nulstil garnishfeltet på cocktails der bruger denne pynt
    await sb.from("cocktails").update({ garnish: null }).eq("garnish", data.name);
    const { error } = await sb.from("garnishes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Users / admin grants ===================

export type AdminUserRow = { id: string; email: string | null };

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result: AdminUserRow[] = [];
    for (const r of roles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      result.push({ id: r.user_id, email: data.user?.email ?? null });
    }
    return result;
  });

export const grantAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const target = await findUserIdByEmail(data.email);
    if (!target) throw new Error("Ingen bruger fundet med den email. Brugeren skal være oprettet først.");
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: target, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (!data.users.length || data.users.length < perPage) return null;
    page += 1;
    if (page > 25) return null;
  }
}

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Du kan ikke fjerne dig selv som admin.");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== TheCocktailDB image lookup ===================

async function lookupCocktailDbImage(name: string): Promise<string | null> {
  const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { drinks: Array<{ strDrink: string; strDrinkThumb: string | null }> | null };
  if (!json.drinks || json.drinks.length === 0) return null;
  const lower = name.trim().toLowerCase();
  const exact = json.drinks.find((d) => d.strDrink.toLowerCase() === lower);
  const pick = exact ?? json.drinks[0];
  return pick.strDrinkThumb ?? null;
}

export const fetchCocktailDbImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().min(1).max(120) }).parse(d),
  )
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
    const { data: rows, error } = await sb
      .from("cocktails")
      .select("id, name, image_url");
    if (error) throw new Error(error.message);
    let updated = 0;
    let missing = 0;
    for (const c of rows ?? []) {
      if (c.image_url) continue;
      const image = await lookupCocktailDbImage(c.name);
      if (!image) {
        missing += 1;
        continue;
      }
      const { error: upErr } = await sb
        .from("cocktails")
        .update({ image_url: image })
        .eq("id", c.id);
      if (!upErr) updated += 1;
    }
    return { updated, missing };
  });
