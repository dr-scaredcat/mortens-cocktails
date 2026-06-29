import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient, assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";

// Sorterings-princip der gemmes server-side i app_settings, så det er låst
// på tværs af browsere/enheder og overlever en genindlæsning.
//   "manual" → den rækkefølge der er gemt i 'position' (træk-og-slip)
//   "alpha"  → alfabetisk efter navn (beregnes klientside)
//   "rating" → efter gennemsnitlig bedømmelse, højest først (klientside)
export type SortMode = "manual" | "alpha" | "rating";

const sortModeSchema = z.enum(["manual", "alpha", "rating"]);

function coerceMode(v: unknown): SortMode {
  return v === "alpha" || v === "rating" || v === "manual" ? v : "manual";
}

// =================== Cocktails ===================

export const getCocktailSort = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", "cocktails_sort")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { mode: coerceMode(data?.value) };
});

export const setCocktailSort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: SortMode }) => z.object({ mode: sortModeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "cocktails_sort", value: data.mode as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Spiritus ===================
// Spiritus-siden har kun A-Z (ingen rating-knap), men typen deles for enkelhed.

export const getSpiritSort = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", "spirits_sort")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { mode: coerceMode(data?.value) };
});

export const setSpiritSort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: SortMode }) => z.object({ mode: sortModeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "spirits_sort", value: data.mode as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
