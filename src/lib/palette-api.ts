import { hexToOklch } from "@/lib/color-utils";
import type { ThemeColors } from "@/lib/themes.functions";

export type RgbColor = [number, number, number];

function rgbToHex([r, g, b]: RgbColor): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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

function mapPaletteToTheme(palette: RgbColor[]): ThemeColors {
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));

  const mostSaturatedIdx = sorted.reduce(
    (bestIdx, color, idx) =>
      saturation(color) > saturation(sorted[bestIdx]) ? idx : bestIdx,
    0,
  );

  const darkest = sorted[0];
  const darkMid = sorted[1];
  const mid = sorted[2];
  const lightMid = sorted[3];
  const lightest = sorted[4];

  const primary = sorted[mostSaturatedIdx];
  const primaryForeground = luminance(primary) < 0.4 ? lightest : darkest;

  const destructive = sorted.find(([r, , b]) => r > 150 && r > b * 1.3) ?? darkMid;
  const destructiveForeground = luminance(destructive) < 0.4 ? lightest : darkest;

  const accent = sorted.find((c) => c !== primary && saturation(c) > 0.1) ?? mid;
  const accentForeground = luminance(accent) < 0.4 ? lightest : darkest;

  return {
    background: hexToOklch(rgbToHex(lightest)),
    card: hexToOklch(rgbToHex(lightMid)),
    foreground: hexToOklch(rgbToHex(darkest)),
    primary: hexToOklch(rgbToHex(primary)),
    primaryForeground: hexToOklch(rgbToHex(primaryForeground)),
    muted: hexToOklch(rgbToHex(lightMid)),
    mutedForeground: hexToOklch(rgbToHex(darkMid)),
    accent: hexToOklch(rgbToHex(accent)),
    accentForeground: hexToOklch(rgbToHex(accentForeground)),
    border: hexToOklch(rgbToHex(mid)),
    destructive: hexToOklch(rgbToHex(destructive)),
    destructiveForeground: hexToOklch(rgbToHex(destructiveForeground)),
  };
}

const SCHEME_MODES = ["analogic", "complement", "analogic-complement", "triad"] as const;

/**
 * Generate a random palette by:
 * 1. Fetching a random color from The Color API
 * 2. Using that as seed for a randomly chosen scheme mode
 */
export async function generateRandomPalette(): Promise<string[]> {
  // Step 1: get a random seed color
  const randomRes = await fetch("https://www.thecolorapi.com/random?format=json");
  if (!randomRes.ok) throw new Error("Kunne ikke hente tilfældig farve");

  const randomData = await randomRes.json() as { hex: { clean: string } };
  const seedHex = randomData.hex.clean;

  // Step 2: pick a random scheme mode
  const mode = SCHEME_MODES[Math.floor(Math.random() * SCHEME_MODES.length)];

  // Step 3: generate a scheme from that seed
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
