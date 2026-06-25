import { hexToOklch } from "@/lib/color-utils";
import type { ThemeColors } from "@/lib/themes.functions";

export type RgbColor = [number, number, number];

// Convert RGB [r,g,b] to hex string
function rgbToHex([r, g, b]: RgbColor): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Convert hex to RGB
function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

// Calculate relative luminance (0 = dark, 1 = light)
function luminance([r, g, b]: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Calculate saturation (0 = grey, 1 = vivid)
function saturation([r, g, b]: RgbColor): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/**
 * Map 5 palette colors (sorted dark→light by luminance) to 12 theme groups.
 *
 * Index 0 = darkest, index 4 = lightest
 * [dark, dark-mid, mid, light-mid, lightest]
 */
function mapPaletteToTheme(palette: RgbColor[]): ThemeColors {
  // Sort by luminance ascending (darkest first)
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));

  // Find the most saturated color to use as primary
  const mostSaturatedIdx = sorted.reduce(
    (bestIdx, color, idx) =>
      saturation(color) > saturation(sorted[bestIdx]) ? idx : bestIdx,
    0,
  );

  // Assign roles based on luminance position
  const darkest = sorted[0];
  const darkMid = sorted[1];
  const mid = sorted[2];
  const lightMid = sorted[3];
  const lightest = sorted[4];

  // Primary: most saturated color
  const primary = sorted[mostSaturatedIdx];

  // Primary foreground: if primary is dark use lightest, else darkest
  const primaryForeground = luminance(primary) < 0.4 ? lightest : darkest;

  // Destructive: pick a warm/reddish tone if available, else use darkMid
  const destructive = sorted.find(([r, , b]) => r > 150 && r > b * 1.3) ?? darkMid;
  const destructiveForeground = luminance(destructive) < 0.4 ? lightest : darkest;

  // Accent: the color most different from primary
  const accent =
    sorted.find((c) => c !== primary && saturation(c) > 0.1) ?? mid;
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

/**
 * Generate a random UI-optimized palette using Colormind
 * Returns 5 hex colors
 */
export async function generateRandomPalette(): Promise<string[]> {
  const response = await fetch("http://colormind.io/api/", {
    method: "POST",
    body: JSON.stringify({ model: "ui" }),
  });

  if (!response.ok) throw new Error("Kunne ikke hente palette fra Colormind");

  const data = await response.json() as { result: RgbColor[] };
  return data.result.map(rgbToHex);
}

/**
 * Generate a palette from a seed color using The Color API
 * scheme: "analogic" | "complement" | "analogic-complement" | "triad"
 * Returns 5 hex colors
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
  // Pad to 5 if fewer colors
  while (rgbColors.length < 5) rgbColors.push(rgbColors[rgbColors.length - 1]);
  return mapPaletteToTheme(rgbColors);
}
