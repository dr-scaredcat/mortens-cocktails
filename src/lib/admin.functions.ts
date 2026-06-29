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

    // 1) Hent alle brugte ingrediens-ID'er via en SECURITY DEFINER funktion, der
    //    omgår RLS og samler ID'er fra BÅDE cocktail_ingredients og
    //    recipe_ingredients. Se SQL-funktionen get_used_ingredient_ids i databasen.
    const { data: usedRows, error: usedErr } = await sb.rpc("get_used_ingredient_ids" as any);
    if (usedErr) throw new Error(`Kunne ikke hente brugte ingredienser: ${usedErr.message}`);

    const usedIds = new Set(
      ((usedRows ?? []) as { ingredient_id: string }[])
        .map((r) => r.ingredient_id)
        .filter(Boolean),
    );

    // 2) Hent alle ingrediens-ID'er og beregn hvilke der er ubrugte i JS.
    //    Dette undgår en skrøbelig "not in (...)"-streng med mange UUID'er.
    const { data: allIngs, error: allErr } = await sb.from("ingredients").select("id");
    if (allErr) throw new Error(allErr.message);

    const unusedIds = ((allIngs ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => id && !usedIds.has(id));

    if (unusedIds.length === 0) {
      return { deleted: 0 };
    }

    // 3) Slet kun de ubrugte ID'er via en eksplicit "in"-liste.
    const { error: delErr } = await sb.from("ingredients").delete().in("id", unusedIds);
    if (delErr) throw new Error(delErr.message);

    return { deleted: unusedIds.length };
  });

// Returnér ID'er på alle ingredienser der bruges i cocktails ELLER opskrifter.
// Bruges af frontend til at vise hvilke ingredienser der er ubrugte.
export const listUsedIngredientIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    const { data: usedRows, error } = await sb.rpc("get_used_ingredient_ids" as any);
    if (error) throw new Error(`Kunne ikke hente brugte ingredienser: ${error.message}`);

    const ids = Array.from(
      new Set(
        ((usedRows ?? []) as { ingredient_id: string }[])
          .map((r) => r.ingredient_id)
          .filter(Boolean),
      ),
    );
    return { ids };
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
    // Hent alle eksisterende ingredienser én gang og match case-insensitivt i JS.
    const names = data.ingredients.map((i) => i.name.trim()).filter((n) => n.length > 0);

    const { data: allIngs, error: ingErr } = await sb.from("ingredients").select("id, name");
    if (ingErr) throw new Error(ingErr.message);

    const idByLowerName = new Map<string, string>(
      (allIngs ?? []).map((i: { id: string; name: string }) => [i.name.trim().toLowerCase(), i.id]),
    );

    // Find unikke navne der mangler (dedup case-insensitivt), og opret dem i ÉT insert.
    const missingByLower = new Map<string, string>(); // lower -> original visningsnavn
    for (const n of names) {
      const lower = n.toLowerCase();
      if (!idByLowerName.has(lower) && !missingByLower.has(lower)) {
        missingByLower.set(lower, n);
      }
    }
    if (missingByLower.size > 0) {
      const { data: created, error } = await sb
        .from("ingredients")
        .insert(
          Array.from(missingByLower.values()).map((name) => ({
            name,
            category: "Andet",
            available: false,
          })),
        )
        .select("id, name");
      if (error) throw new Error(error.message);
      for (const row of (created ?? []) as Array<{ id: string; name: string }>) {
        idByLowerName.set(row.name.trim().toLowerCase(), row.id);
      }
    }

    // Byg ingrediens-rækker i samme rækkefølge som input (bevarer dubletter og mængder).
    const ingIds: { ingredient_id: string; amount: number | null; unit: string | null }[] = [];
    for (const item of data.ingredients) {
      const name = item.name.trim();
      if (!name) continue;
      const id = idByLowerName.get(name.toLowerCase());
      if (!id) continue; // burde ikke ske — alle navne er nu oprettet
      ingIds.push({ ingredient_id: id, amount: item.amount ?? null, unit: item.unit ?? null });
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
        await sb.from("ingredients").update({ category: data.name }).eq("category", data.oldName);
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
    await sb.from("ingredients").update({ category: "Andet" }).eq("category", data.name);
    const { error } = await sb.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    await Promise.all(
      data.ids.map((id, i) => sb.from("categories").update({ position: i + 1 }).eq("id", id)),
    );
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

export const reorderTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    await Promise.all(
      data.ids.map((id, i) => sb.from("tags").update({ position: i + 1 }).eq("id", id)),
    );
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

    // Hent alle admin-brugeres email parallelt i stedet for sekventielt (N+1-waterfall).
    const result = await Promise.all(
      (roles ?? []).map(async (r: { user_id: string }) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        return { id: r.user_id, email: data.user?.email ?? null };
      }),
    );
    return result as AdminUserRow[];
  });

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const user = (data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return user?.id ?? null;
}

export const grantAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const target = await findUserIdByEmail(data.email);
    if (!target)
      throw new Error(
        "Ingen bruger fundet med den email. Brugeren skal være oprettet først.",
      );
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: target, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId)
      throw new Error("Du kan ikke fjerne dine egne admin-rettigheder");
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== CocktailDB image helpers ===================

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

// =====================================================================
//  Indsæt dette i BUNDEN af src/lib/admin.functions.ts
//  Alle imports (createServerFn, requireSupabaseAuth, assertAdmin, z)
//  findes allerede i filen — ingen ændringer i toppen er nødvendige.
// =====================================================================

// =================== Spiritus typer ===================

export const upsertSpiritType = createServerFn({ method: "POST" })
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
      const { error } = await (sb.from("spirit_types") as any)
        .update({ name: data.name })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      // Omdøb typen på alle spiritus der bruger den.
      if (data.oldName && data.oldName !== data.name) {
        await (sb.from("spirits") as any)
          .update({ spirit_type: data.name })
          .eq("spirit_type", data.oldName);
      }
      return { id: data.id };
    }
    const { data: row, error } = await (sb.from("spirit_types") as any)
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSpiritType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    // Spiritus med denne type mister deres type (sættes til null → vises under "Øvrige").
    await (sb.from("spirits") as any).update({ spirit_type: null }).eq("spirit_type", data.name);
    const { error } = await (sb.from("spirit_types") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSpiritTypes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    await Promise.all(
      data.ids.map((id, i) =>
        (sb.from("spirit_types") as any).update({ position: i + 1 }).eq("id", id),
      ),
    );
    return { ok: true };
  });

// =================== Spiritus ===================

export const upsertSpirit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    spiritType?: string | null;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().nullable().optional(),
        image_url: z.string().nullable().optional(),
        spiritType: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const name = data.name.trim();

    // ── Find eller opret den tilknyttede ingrediens ────────────────────────
    // Findes en ingrediens med dette navn (case-insensitivt) → link til den.
    // Ellers, hvis vi redigerer og spiritussen allerede har en ingrediens →
    // omdøb den (følg navnet). Ellers opret en ny i kategori "Andet" med
    // available=true.
    const { data: existingIng, error: findErr } = await sb
      .from("ingredients")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    let currentIngredientId: string | null = null;
    if (data.id) {
      const { data: cur } = await (sb.from("spirits") as any)
        .select("ingredient_id")
        .eq("id", data.id)
        .maybeSingle();
      currentIngredientId = (cur?.ingredient_id as string | null) ?? null;
    }

    let ingredientId: string;
    if (existingIng) {
      ingredientId = existingIng.id as string;
    } else if (data.id && currentIngredientId) {
      const { error: renErr } = await sb
        .from("ingredients")
        .update({ name })
        .eq("id", currentIngredientId);
      if (renErr) throw new Error(renErr.message);
      ingredientId = currentIngredientId;
    } else {
      const { data: createdIng, error: insErr } = await sb
        .from("ingredients")
        .insert({ name, category: "Andet", available: true })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      ingredientId = createdIng.id as string;
    }

    const payload = {
      name,
      description: data.description?.trim() ? data.description.trim() : null,
      image_url: data.image_url && data.image_url.length > 0 ? data.image_url : null,
      spirit_type: data.spiritType && data.spiritType.length > 0 ? data.spiritType : null,
      ingredient_id: ingredientId,
    };

    if (data.id) {
      const { error } = await (sb.from("spirits") as any).update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    // Ny spiritus — placér sidst.
    const { data: maxRow } = await (sb.from("spirits") as any)
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = ((maxRow?.position as number | undefined) ?? 0) + 1;

    const { data: row, error } = await (sb.from("spirits") as any)
      .insert({ ...payload, position: nextPos, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSpirit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Ingrediensen røres ikke — den kan bruges i cocktails/opskrifter.
    const { error } = await (context.supabase.from("spirits") as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSpirits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    await Promise.all(
      data.ids.map((id, i) => (sb.from("spirits") as any).update({ position: i + 1 }).eq("id", id)),
    );
    return { ok: true };
  });

export const resetSpiritRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("spirit_ratings") as any)
      .delete()
      .eq("spirit_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
