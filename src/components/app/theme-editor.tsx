import { useState, useCallback } from "react";
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
import { ThemePreview } from "@/components/app/theme-preview";
import type { Theme, ThemeColors } from "@/lib/themes.functions";
import { oklchToHex, hexToOklch, isOklchString } from "@/lib/color-utils";

type ColorGroup = {
  key: keyof ThemeColors;
  label: string;
  description: string;
};

const COLOR_GROUPS: ColorGroup[] = [
  {
    key: "background",
    label: "Baggrund",
    description: "Sidens baggrund",
  },
  {
    key: "card",
    label: "Kort & overflader",
    description: "Kortbaggrund, dropdowns, tooltips",
  },
  {
    key: "foreground",
    label: "Tekst",
    description: "Primær tekst, korttekst",
  },
  {
    key: "primary",
    label: "Primær",
    description: "Knapper, aktive links, badges, focus-ring",
  },
  {
    key: "primaryForeground",
    label: "Primær tekst",
    description: "Tekst oven på primærfarve",
  },
  {
    key: "muted",
    label: "Dæmpet",
    description: "Hover-baggrunde, inputfelter",
  },
  {
    key: "mutedForeground",
    label: "Dæmpet tekst",
    description: "Hjælpetekst og ikoner",
  },
  {
    key: "accent",
    label: "Accent",
    description: "Highlights, sekundære badges, hover-effekter",
  },
  {
    key: "accentForeground",
    label: "Accent tekst",
    description: "Tekst oven på accent-farve",
  },
  {
    key: "border",
    label: "Kant",
    description: "Alle kanter og streger",
  },
  {
    key: "destructive",
    label: "Fejl",
    description: "Slet-knapper og fejlbeskeder",
  },
  {
    key: "destructiveForeground",
    label: "Fejl tekst",
    description: "Tekst oven på fejlfarve",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Theme | null; // null = new theme
  onSave: (theme: Theme) => void;
};

function colorToHex(value: string): string {
  if (isOklchString(value)) return oklchToHex(value);
  if (value.startsWith("#")) return value;
  return "#888888";
}

export function ThemeEditor({ open, onOpenChange, initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "Nyt tema");
  const [colors, setColors] = useState<ThemeColors>(
    initial?.colors ?? {
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
  );

  // Reset when dialog opens with new initial
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (o) {
        setName(initial?.name ?? "Nyt tema");
        setColors(
          initial?.colors ?? {
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
        );
      }
      onOpenChange(o);
    },
    [initial, onOpenChange],
  );

  function handleColorChange(key: keyof ThemeColors, hex: string) {
    const oklch = hexToOklch(hex);
    setColors((prev) => ({ ...prev, [key]: oklch }));
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Rediger tema" : "Nyt tema"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: controls */}
          <div className="space-y-5">
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

            <div className="space-y-3">
              <p className="text-sm font-medium">Farver</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLOR_GROUPS.map((group) => {
                  const currentValue = colors[group.key];
                  const hexValue = colorToHex(currentValue);
                  return (
                    <div key={group.key} className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={hexValue}
                          onChange={(e) =>
                            handleColorChange(group.key, e.target.value)
                          }
                          className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                          title={group.label}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">
                          {group.label}
                        </p>
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

          {/* Right: preview */}
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
