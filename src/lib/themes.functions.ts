import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

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

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kun administratorer kan udføre denne handling");
}

export type ThemeColors = {
  background: string;
  card: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  destructive: string;
  destructiveForeground: string;
};

export type Theme = {
  id: string;
  name: string;
  colors: ThemeColors;
  isBuiltIn?: boolean;
};

export const DEFAULT_LIGHT_THEME: Theme = {
  id: "built-in-light",
  name: "Lys",
  isBuiltIn: true,
  colors: {
    background: "oklch(0.97 0.025 75)",
    card: "oklch(0.99 0.015 80)",
    foreground: "oklch(0.22 0.04 320)",
    primary: "oklch(0.65 0.22 0)",
    primaryForeground: "oklch(0.99 0.01 80)",
    muted: "oklch(0.93 0.03 80)",
    mutedForeground: "oklch(0.45 0.06 320)",
    accent: "oklch(0.78 0.17 195)",
    accentForeground: "oklch(0.22 0.05 240)",
    border: "oklch(0.85 0.05 20)",
    destructive: "oklch(0.6 0.22 25)",
    destructiveForeground: "oklch(0.99 0.01 80)",
  },
};

export const DEFAULT_DARK_THEME: Theme = {
  id: "built-in-dark",
  name: "Mørk",
  isBuiltIn: true,
  colors: {
    background: "oklch(0.129 0.042 264.695)",
    card: "oklch(0.208 0.042 265.755)",
    foreground: "oklch(0.984 0.003 247.858)",
    primary: "oklch(0.929 0.013 255.508)",
    primaryForeground: "oklch(0.208 0.042 265.755)",
    muted: "oklch(0.279 0.041 260.031)",
    mutedForeground: "oklch(0.704 0.04 256.788)",
    accent: "oklch(0.279 0.041 260.031)",
    accentForeground: "oklch(0.984 0.003 247.858)",
    border: "oklch(1 0 0 / 10%)",
    destructive: "oklch(0.704 0.191 22.216)",
    destructiveForeground: "oklch(0.984 0.003 247.858)",
  },
};

const DEFAULT_THEMES: Theme[] = [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME];

const themeColorsSchema = z.object({
  background: z.string().min(1),
  card: z.string().min(1),
  foreground: z.string().min(1),
  primary: z.string().min(1),
  primaryForeground: z.string().min(1),
  muted: z.string().min(1),
  mutedForeground: z.string().min(1),
  accent: z.string().min(1),
  accentForeground: z.string().min(1),
  border: z.string().min(1),
  destructive: z.string().min(1),
  destructiveForeground: z.string().min(1),
});

const themeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  colors: themeColorsSchema,
  isBuiltIn: z.boolean().optional(),
});

export type ThemesData = {
  themes: Theme[];
  activeThemeId: string;
};

async function getThemeSettingsFromDb(
  sb: ReturnType<typeof publicClient>,
): Promise<ThemesData> {
  const { data, error } = await sb
    .from("app_settings")
    .select("key, value")
    .in("key", ["themes", "active_theme"]);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const themesRow = rows.find((r) => r.key === "themes");
  const activeRow = rows.find((r) => r.key === "active_theme");

  const themes: Theme[] = themesRow?.value
    ? (themesRow.value as unknown as Theme[])
    : DEFAULT_THEMES;

  const activeThemeId: string =
    typeof activeRow?.value === "string"
      ? activeRow.value
      : activeRow?.value
        ? String(activeRow.value)
        : "built-in-light";

  return { themes, activeThemeId };
}

export const getThemesData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  return getThemeSettingsFromDb(sb);
});

export const setActiveTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "active_theme", value: data.id as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => themeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { themes } = await getThemeSettingsFromDb(sb);

    const existing = themes.findIndex((t) => t.id === data.id);
    let updated: Theme[];
    if (existing >= 0) {
      updated = themes.map((t) => (t.id === data.id ? (data as Theme) : t));
    } else {
      updated = [...themes, data as Theme];
    }

    const { error } = await sb
      .from("app_settings")
      .upsert({ key: "themes", value: updated as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { themes, activeThemeId } = await getThemeSettingsFromDb(sb);

    const updated = themes.filter((t) => t.id !== data.id);
    const { error } = await sb
      .from("app_settings")
      .upsert({ key: "themes", value: updated as unknown as never });
    if (error) throw new Error(error.message);

    if (activeThemeId === data.id && updated.length > 0) {
      await sb
        .from("app_settings")
        .upsert({ key: "active_theme", value: updated[0].id as unknown as never });
    }

    return { ok: true };
  });
