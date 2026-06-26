import { hexToOklch } from "@/lib/color-utils";
import type { ThemeColors } from "@/lib/themes.functions";

export type RgbColor = [number, number, number];

// ─── OKLCH helpers ───────────────────────────────────────────────────────────

type OklchColor = { L: number; C: number; H: number };

function parseOklch(str: string): OklchColor {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return { L: 0.5, C: 0.1, H: 0 };
  return { L: parseFloat(m[1]), C: parseFloat(m[2]), H: parseFloat(m[3]) };
}

function formatOklch({ L, C, H }: OklchColor): string {
  // Clamp to valid OKLCH ranges
  const lc = Math.max(0.05, Math.min(0.99, L));
  const cc = Math.max(0, Math.min(0.4, C));
  const hc = ((H % 360) + 360) % 360;
  return `oklch(${lc.toFixed(3)} ${cc.toFixed(3)} ${hc.toFixed(1)})`;
}

/** Apply an OKLCH offset (dL, dC, dH) to a base color */
function applyOffset(base: OklchColor, dL: number, dC: number, dH: number): string {
  return formatOklch({ L: base.L + dL, C: base.C + dC, H: base.H + dH });
}

/** Compute the OKLCH offset from anchor to target (both as oklch strings) */
function oklchOffset(
  anchor: string,
  target: string,
): { dL: number; dC: number; dH: number } {
  const a = parseOklch(anchor);
  const t = parseOklch(target);
  // Hue offset: pick the shortest arc
  let dH = t.H - a.H;
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;
  return { dL: t.L - a.L, dC: t.C - a.C, dH };
}

// ─── Lys-tema referencefarver (ankerpunkter) ─────────────────────────────────
//
// Gruppering (jf. billede 1 + 2):
//
//  LYSEST-gruppe  → anchor: background
//    card            = background + offset
//    muted           = background + offset
//
//  TEKST-gruppe   → anchor: foreground
//    accentForeground = foreground + offset
//    mutedForeground  = foreground + offset     (A: relativt til foreground)
//
//  PRIMARY-gruppe → anchor: primary
//    primaryForeground = primary + offset       (A: relativt til primary)
//    border            = primary + offset (lys-midt farve fra paletten bruges
//                        dog som yderligere korektion — se nedenfor)
//
//  ACCENT-gruppe  → anchor: accent
//    (accentForeground beregnes fra foreground-gruppen, se billede 1)
//
//  DESTRUCTIVE    → egen logik (uændret)

const LYS = {
  background:          "oklch(0.97 0.025 75)",
  card:                "oklch(0.99 0.015 80)",
  muted:               "oklch(0.93 0.03 80)",
  foreground:          "oklch(0.22 0.04 320)",
  accentForeground:    "oklch(0.22 0.05 240)",
  mutedForeground:     "oklch(0.45 0.06 320)",
  primary:             "oklch(0.65 0.22 0)",
  primaryForeground:   "oklch(0.99 0.01 80)",
  accent:              "oklch(0.78 0.17 195)",
  border:              "oklch(0.85 0.05 20)",
  destructive:         "oklch(0.6 0.22 25)",
  destructiveForeground: "oklch(0.99 0.01 80)",
};

// Pre-compute offsets fra Lys-temaet
const OFFSETS = {
  // Lysest-gruppe (anchor = background)
  cardFromBg:    oklchOffset(LYS.background, LYS.card),
  mutedFromBg:   oklchOffset(LYS.background, LYS.muted),

  // Tekst-gruppe (anchor = foreground)
  accentFgFromFg:  oklchOffset(LYS.foreground, LYS.accentForeground),
  mutedFgFromFg:   oklchOffset(LYS.foreground, LYS.mutedForeground),

  // Primary-gruppe (anchor = primary)
  primaryFgFromPrimary: oklchOffset(LYS.primary, LYS.primaryForeground),
  borderFromPrimary:    oklchOffset(LYS.primary, LYS.border),

  // Accent-gruppe (anchor = accent) — accentForeground beregnes fra foreground
  // (ingen ekstra offset her; accent er sit eget ankerpunkt)

  // Destructive-gruppe (anchor = destructive)
  destructiveFgFromDestructive: oklchOffset(LYS.destructive, LYS.destructiveForeground),
};

// ─── RGB hjælpere (bruges kun til sortering) ─────────────────────────────────

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function saturation([r, g, b]: RgbColor): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function rgbToHex([r, g, b]: RgbColor): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Hoved-mapping ───────────────────────────────────────────────────────────

function mapPaletteToTheme(palette: RgbColor[]): ThemeColors {
  // Sortér palette fra mørkest til lysest
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));

  // Vælg den mest mættede farve som primary-anker
  const mostSaturatedIdx = sorted.reduce(
    (bestIdx, color, idx) =>
      saturation(color) > saturation(sorted[bestIdx]) ? idx : bestIdx,
    0,
  );

  // De 5 palettefarver (mørk→lys)
  const darkest  = sorted[0]; // → foreground-gruppe anker
  const darkMid  = sorted[1];
  const mid      = sorted[2];
  const lightMid = sorted[3];
  const lightest = sorted[4]; // → background-gruppe anker

  // Primary: den mest mættede palettefarve
  const primaryRgb = sorted[mostSaturatedIdx];
  const primaryOklch = parseOklch(hexToOklch(rgbToHex(primaryRgb)));

  // Accent: anden mest mættede (ikke primary), ellers mid
  const accentRgb =
    sorted.find((c, i) => i !== mostSaturatedIdx && saturation(c) > 0.08) ?? mid;
  const accentOklch = parseOklch(hexToOklch(rgbToHex(accentRgb)));

  // Destructive: rødlig farve fra paletten, ellers beregn fra primary med
  // Lys-temaets destructive-karakteristika (lav hue, høj chroma)
  const destructiveRgb =
    sorted.find(([r, , b]) => r > 150 && r > b * 1.3) ?? darkMid;
  const destructiveOklch = parseOklch(hexToOklch(rgbToHex(destructiveRgb)));

  // Foreground-anker
  const fgOklch = parseOklch(hexToOklch(rgbToHex(darkest)));

  // Background-anker
  const bgOklch = parseOklch(hexToOklch(rgbToHex(lightest)));

  // ── Beregn alle farver via Lys-temaets offsets ──

  // Lysest-gruppe (anchor = background)
  const background = formatOklch(bgOklch);
  const card       = applyOffset(bgOklch, OFFSETS.cardFromBg.dL,  OFFSETS.cardFromBg.dC,  OFFSETS.cardFromBg.dH);
  const muted      = applyOffset(bgOklch, OFFSETS.mutedFromBg.dL, OFFSETS.mutedFromBg.dC, OFFSETS.mutedFromBg.dH);

  // Tekst-gruppe (anchor = foreground)
  const foreground       = formatOklch(fgOklch);
  const accentForeground = applyOffset(fgOklch, OFFSETS.accentFgFromFg.dL, OFFSETS.accentFgFromFg.dC, OFFSETS.accentFgFromFg.dH);
  const mutedForeground  = applyOffset(fgOklch, OFFSETS.mutedFgFromFg.dL,  OFFSETS.mutedFgFromFg.dC,  OFFSETS.mutedFgFromFg.dH);

  // Primary-gruppe (anchor = primary)
  const primary            = formatOklch(primaryOklch);
  const primaryForeground  = applyOffset(primaryOklch, OFFSETS.primaryFgFromPrimary.dL, OFFSETS.primaryFgFromPrimary.dC, OFFSETS.primaryFgFromPrimary.dH);
  const border             = applyOffset(primaryOklch, OFFSETS.borderFromPrimary.dL,    OFFSETS.borderFromPrimary.dC,    OFFSETS.borderFromPrimary.dH);

  // Accent-gruppe (anchor = accent)
  const accent = formatOklch(accentOklch);

  // Destructive-gruppe (anchor = destructive, egen logik)
  const destructive            = formatOklch(destructiveOklch);
  const destructiveForeground  = applyOffset(destructiveOklch, OFFSETS.destructiveFgFromDestructive.dL, OFFSETS.destructiveFgFromDestructive.dC, OFFSETS.destructiveFgFromDestructive.dH);

  return {
    background,
    card,
    foreground,
    primary,
    primaryForeground,
    muted,
    mutedForeground,
    accent,
    accentForeground,
    border,
    destructive,
    destructiveForeground,
  };
}

// ─── Offentlige funktioner (API uændret) ──────────────────────────────────────

const SCHEME_MODES = ["analogic", "complement", "analogic-complement", "triad"] as const;

/**
 * Generate a random palette by:
 * 1. Fetching a random color from The Color API
 * 2. Using that as seed for a randomly chosen scheme mode
 */
export async function generateRandomPalette(): Promise<string[]> {
  const randomRes = await fetch("https://www.thecolorapi.com/random?format=json");
  if (!randomRes.ok) throw new Error("Kunne ikke hente tilfældig farve");

  const randomData = await randomRes.json() as { hex: { clean: string } };
  const seedHex = randomData.hex.clean;

  const mode = SCHEME_MODES[Math.floor(Math.random() * SCHEME_MODES.length)];
  return generatePaletteFromColor(`#${seedHex}`, mode);
}

/**
 * Generate a palette from a seed color using The Color API
 */
export async function generatePaletteFromColor(
  hex: string,
  scheme: "analogic" | "complement" | "analogic-complement" | "triad" = "analogic-complement",
): Promise<string[]> {
  const clean = hex.replace("#", "");
  const url = `https://www.thecolorapi.com/scheme?hex=${clean}&mode=${scheme}&count=5&format=json`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Kunne ikke hente palette fra The Color API");

  const data = await response.json() as {
    colors: { hex: { value: string } }[];
  };

  return data.colors.map((c) => c.hex.value);
}

/**
 * Convert an array of hex colors to ThemeColors
 */
export function paletteToThemeColors(hexColors: string[]): ThemeColors {
  const rgbColors = hexColors.slice(0, 5).map(hexToRgb);
  while (rgbColors.length < 5) rgbColors.push(rgbColors[rgbColors.length - 1]);
  return mapPaletteToTheme(rgbColors);
}
