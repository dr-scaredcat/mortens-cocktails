import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteSettings,
  fontStack,
  FONT_OPTIONS,
  CUSTOM_FONT_FAMILY,
  CUSTOM_FONT_URL,
  DEFAULT_HEADING_FONT,
  DEFAULT_LOGO_FONT,
  type FontKey,
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

// Byg en Google Fonts css2-URL for netop de(n) valgte font(s). Returnerer null
// hvis ingen af dem har en Google-familie (fx "default" eller "custom" — som
// hentes lokalt). Dubletter fjernes, så samme font ikke indlæses to gange.
function buildFontHref(keys: FontKey[]): string | null {
  const families = Array.from(
    new Set(
      keys
        .map((k) => FONT_OPTIONS.find((f) => f.key === k)?.google)
        .filter((g): g is string => !!g),
    ),
  );
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${f}`)
    .join("&")}&display=swap`;
}

/**
 * Usynlig komponent: registrerer custom-fonten, indlæser KUN den/de valgte
 * Google-font(s) dynamisk, og sætter overskrift-fonten globalt ved at override
 * Tailwind-variablen --font-serif. Logo-fonten anvendes separat (inline på selve
 * logo-navnet i headeren), så de to kan være forskellige.
 *
 * Fraunces + Inter indlæses stadig statisk i __root.tsx's <head>. Resten af det
 * kuraterede sæt indlæses ikke længere på forhånd — kun det aktive valg.
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

  // Indlæs kun den/de faktisk valgte font(s) via ét dynamisk <link>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const href = buildFontHref([
      data?.headingFont ?? DEFAULT_HEADING_FONT,
      data?.logoFont ?? DEFAULT_LOGO_FONT,
    ]);
    let link = document.getElementById("app-dynamic-fonts") as HTMLLinkElement | null;

    if (!href) {
      // Ingen Google-font valgt (tema-standard/custom) — fjern et evt. tidligere link.
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = "app-dynamic-fonts";
      link.rel = "stylesheet";
      document.head.append(link);
    }
    if (link.href !== href) link.href = href;
  }, [data?.headingFont, data?.logoFont]);

  // Sæt overskrift-fonten globalt via --font-serif.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const stack = fontStack(data?.headingFont ?? DEFAULT_HEADING_FONT);
    const root = document.documentElement;
    if (stack) root.style.setProperty("--font-serif", stack);
    else root.style.removeProperty("--font-serif");
  }, [data?.headingFont]);

  return null;
}
