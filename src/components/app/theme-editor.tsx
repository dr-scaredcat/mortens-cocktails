import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemePreview } from "@/components/app/theme-preview";
import type { Theme, ThemeColors } from "@/lib/themes.functions";
import { oklchToHex, hexToOklch, isOklchString } from "@/lib/color-utils";
import {
  generateRandomPalette,
  generatePaletteFromColor,
  paletteToThemeColors,
} from "@/lib/palette-api";
import { Shuffle, Wand2, Loader2 } from "lucide-react";

type ColorGroup = {
  key: keyof ThemeColors;
  label: string;
  description: string;
};

const COLOR_GROUPS: ColorGroup[] = [
  { key: "background", label: "Baggrund", description: "Sidens baggrund" },
  { key: "card", label: "Kort & overflader", description: "Kortbaggrund, dropdowns, tooltips" },
  { key: "foreground", label: "Tekst", description: "Primær tekst, korttekst" },
  { key: "primary", label: "Primær", description: "Knapper, aktive links, badges, focus-ring" },
  { key: "primaryForeground", label: "Primær tekst", description: "Tekst oven på primærfarve" },
  { key: "muted", label: "Dæmpet", description: "Hover-baggrunde, inputfelter" },
  { key: "mutedForeground", label: "Dæmpet tekst", description: "Hjælpetekst og ikoner" },
  { key: "accent", label: "Accent", description: "Highlights, sekundære badges, hover-effekter" },
  { key: "accentForeground", label: "Accent tekst", description: "Tekst oven på accent-farve" },
  { key: "border", label: "Kant", description: "Alle kanter og streger" },
  { key: "destructive", label: "Fejl", description: "Slet-knapper og fejlbeskeder" },
  { key: "destructiveForeground", label: "Fejl tekst", description: "Tekst oven på fejlfarve" },
];

type SchemeMode = "analogic" | "complement" | "analogic-complement" | "triad";

const SCHEME_LABELS: Record<SchemeMode, string> = {
  analogic: "Analogt",
  complement: "Komplementær",
  "analogic-complement": "Analogt + komplementær",
  triad: "Triade",
};

const DEFAULT_COLORS: ThemeColors = {
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
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Theme | null;
  onSave: (theme: Theme) => void;
};

function colorToHex(value: string): string {
  if (isOklchString(value)) return oklchToHex(value);
  if (value.startsWith("#")) return value;
  return "#888888";
}

export function ThemeEditor({ open, onOpenChange, initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "Nyt tema");
  const [colors, setColors] = useState<ThemeColors>(initial?.colors ?? DEFAULT_COLORS);

  // Palette generator state
  const [generatedPalette, setGeneratedPalette] = useState<string[]>([]);
  const [seedColor, setSeedColor] = useState("#c94a3a");
  const [schemeMode, setSchemeMode] = useState<SchemeMode>("analogic-complement");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Reset state whenever the dialog opens — using the current `initial` prop
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "Nyt tema");
      setColors(initial?.colors ?? DEFAULT_COLORS);
      setGeneratedPalette([]);
      setGenerateError(null);
    }
  }, [open, initial]);

  function handleColorChange(key: keyof ThemeColors, hex: string) {
    setColors((prev) => ({ ...prev, [key]: hexToOklch(hex) }));
  }

  function handleSave() {
    const theme: Theme = {
      id: initial?.id ?? `custom-${Date.now()}`,
      name: name.trim() || "Nyt tema",
      colors,
      isBuiltIn: initial?.isBuiltIn,
    };
    onSave(theme);
  }

  async function handleRandomPalette() {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const palette = await generateRandomPalette();
      setGeneratedPalette(palette);
    } catch {
      setGenerateError("Kunne ikke hente tilfældig palette. Prøv igen.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleColorPalette() {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const palette = await generatePaletteFromColor(seedColor, schemeMode);
      setGeneratedPalette(palette);
    } catch {
      setGenerateError("Kunne ikke hente palette. Prøv igen.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleApplyPalette() {
    if (generatedPalette.length === 0) return;
    setColors(paletteToThemeColors(generatedPalette));
    setGeneratedPalette([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Rediger tema" : "Nyt tema"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: controls */}
          <div className="space-y-5">
            {/* Theme name */}
            <div>
              <Label htmlFor="theme-name">Temanavn</Label>
              <Input
                id="theme-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="fx Mit tema"
                className="mt-1"
              />
            </div>

            {/* Palette generator */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="text-sm font-medium">Generer palette</p>

              {/* Random */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRandomPalette}
                  disabled={isGenerating}
                  className="shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Tilfældig
                </Button>
                <span className="text-xs text-muted-foreground">
                  Genererer en tilfældig farvepalette
                </span>
              </div>

              {/* From seed color */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Fra startfarve</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={seedColor}
                    onChange={(e) => setSeedColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                    title="Vælg startfarve"
                  />
                  <Select
                    value={schemeMode}
                    onValueChange={(v) => setSchemeMode(v as SchemeMode)}
                  >
                    <SelectTrigger className="h-9 w-48 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SCHEME_LABELS) as [SchemeMode, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleColorPalette}
                    disabled={isGenerating}
                    className="shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Generer
                  </Button>
                </div>
              </div>

              {/* Error */}
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}

              {/* Generated palette preview + apply */}
              {generatedPalette.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Genereret palette</p>
                  <div className="flex gap-1.5">
                    {generatedPalette.map((hex, i) => (
                      <div
                        key={i}
                        className="h-8 flex-1 rounded-md border border-border"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyPalette}
                    className="w-full"
                  >
                    Anvend palette
                  </Button>
                </div>
              )}
            </div>

            {/* Color pickers */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Farver</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLOR_GROUPS.map((group) => {
                  const hexValue = colorToHex(colors[group.key]);
                  return (
                    <div key={group.key} className="flex items-center gap-3">
                      <input
                        type="color"
                        value={hexValue}
                        onChange={(e) => handleColorChange(group.key, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                        title={group.label}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">{group.label}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Forhåndsvisning</p>
            <div className="sticky top-4">
              <ThemePreview colors={colors} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button onClick={handleSave}>Gem tema</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
