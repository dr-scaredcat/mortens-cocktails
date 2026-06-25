import { useEffect } from "react";
import type { ThemeColors } from "@/lib/themes.functions";

export function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty("--background", colors.background);
  root.style.setProperty("--foreground", colors.foreground);
  root.style.setProperty("--card", colors.card);
  root.style.setProperty("--card-foreground", colors.foreground);
  root.style.setProperty("--popover", colors.card);
  root.style.setProperty("--popover-foreground", colors.foreground);
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-foreground", colors.primaryForeground);
  root.style.setProperty("--secondary", colors.accent);
  root.style.setProperty("--secondary-foreground", colors.accentForeground);
  root.style.setProperty("--muted", colors.muted);
  root.style.setProperty("--muted-foreground", colors.mutedForeground);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-foreground", colors.accentForeground);
  root.style.setProperty("--destructive", colors.destructive);
  root.style.setProperty("--destructive-foreground", colors.destructiveForeground);
  root.style.setProperty("--border", colors.border);
  root.style.setProperty("--input", colors.muted);
  root.style.setProperty("--ring", colors.primary);
}

export function useApplyTheme(colors: ThemeColors | undefined) {
  useEffect(() => {
    if (!colors) return;
    applyThemeColors(colors);
  }, [colors]);
}
