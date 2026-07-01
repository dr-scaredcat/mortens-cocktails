import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteSettings,
  fontStack,
  CUSTOM_FONT_FAMILY,
  CUSTOM_FONT_URL,
  DEFAULT_HEADING_FONT,
} from "@/lib/orders.functions";

// Registrerer en valgfri custom-font lagt i public/ (custom-font.woff2).
// Idempotent — filen behøver ikke eksistere; så falder browseren bare tilbage.
function ensureCustomFontFace() {
  if (typeof document === "undefined") return;
  if (document.getElementById("app-custom-font-face")) return;

  const style = document.createElement("style");
  style.id = "app-custom-font-face";
  style.textContent = `@font-face {
  font-family: '${CUSTOM_FONT_FAMILY}';
  src: url('${CUSTOM_FONT_URL}') format('woff2');
  font-display: swap;
}`;
  document.head.append(style);
}

/**
 * Usynlig komponent: registrerer custom-fonten og sætter overskrift-fonten
 * globalt ved at override Tailwind-variablen --font-serif. Logo-fonten anvendes
 * separat (inline på selve logo-navnet i headeren), så de to kan være forskellige.
 *
 * Selve Google Fonts-sættet indlæses i __root.tsx's <head> (GOOGLE_FONTS_HREF).
 */
export function FontApplier() {
  const fetchSettings = useServerFn(getSiteSettings);
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    ensureCustomFontFace();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const stack = fontStack(data?.headingFont ?? DEFAULT_HEADING_FONT);
    const root = document.documentElement;
    if (stack) root.style.setProperty("--font-serif", stack);
    else root.style.removeProperty("--font-serif");
  }, [data?.headingFont]);

  return null;
}
