import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WineFridgeLayout, WineWithDetails } from "@/lib/wines.functions";
import { WINE_TYPE_ORDER } from "@/lib/wines.functions";

/**
 * Visuel gengivelse af vinkøleskabet set forfra.
 *
 * Komponenten deles mellem admin (pladsvælger i redigér-dialogen og
 * live-preview i layout-editoren) og gæstevisningen (fremhævning af én
 * bestemt vins plads). Derfor er den bevidst "dum": den ejer ingen data og
 * henter intet selv — alt kommer ind via props.
 *
 * Farverne for vintyper er samlet ét sted nedenfor og skrevet i oklch, samme
 * farverum som resten af temaet. De er data-farver (som recharts-serierne i
 * statistik-fanen) og findes derfor ikke som semantiske tema-variabler; alt
 * andet — kanter, baggrunde, fremhævning — bruger tema-variablerne.
 */

// ── Farver pr. vintype ─────────────────────────────────────────────────────
// `fill` er flaskebunden set forfra, `text` er pladsnummeret ovenpå.
type WineTypeStyle = { fill: string; text: string };

const WINE_TYPE_STYLE: Record<string, WineTypeStyle> = {
  // Dyb bordeaux
  "rød": { fill: "oklch(0.40 0.13 18)", text: "oklch(0.97 0.02 80)" },
  // Gylden
  "hvid": { fill: "oklch(0.85 0.12 95)", text: "oklch(0.28 0.05 80)" },
  // Lys rosa
  "rosé": { fill: "oklch(0.84 0.09 20)", text: "oklch(0.30 0.06 20)" },
  // Lys gylden (får desuden bobler, se nedenfor)
  "mousserende": { fill: "oklch(0.91 0.08 100)", text: "oklch(0.30 0.05 90)" },
  // Rav
  "dessertvin": { fill: "oklch(0.71 0.13 62)", text: "oklch(0.26 0.06 60)" },
  // Mørkere rav
  "hedvin": { fill: "oklch(0.58 0.13 48)", text: "oklch(0.97 0.02 80)" },
};

/** Ukendt/ugyldig vintype — falder tilbage til en neutral tema-tone. */
const FALLBACK_STYLE: WineTypeStyle = {
  fill: "var(--muted-foreground)",
  text: "var(--background)",
};

function styleForType(type: string): WineTypeStyle {
  return WINE_TYPE_STYLE[type] ?? FALLBACK_STYLE;
}

export type FridgePosition = { shelf: number; slot: number };

export type WineFridgeMode = "admin-vaelger" | "gæst";

export function WineFridge({
  mode,
  wines,
  layout,
  selected = null,
  highlightWineId = null,
  currentWineId = null,
  onSelectSlot,
  className,
}: {
  /** "admin-vælger": ledige pladser kan klikkes. "gæst": ren visning. */
  mode: WineFridgeMode;
  wines: WineWithDetails[];
  layout: WineFridgeLayout;
  /** Den plads der aktuelt er valgt (vises med ring). */
  selected?: FridgePosition | null;
  /** Gæst-mode: fremhæv denne vins plads. */
  highlightWineId?: string | null;
  /** Admin-mode: den vin der redigeres — dens egen plads er ikke spærret. */
  currentWineId?: string | null;
  /** Kaldes når en plads vælges i admin-vælger-mode. */
  onSelectSlot?: (pos: FridgePosition) => void;
  className?: string;
}) {
  // Opslag fra "hylde:plads" til vin, så vi ikke gennemløber hele listen
  // for hver enkelt plads.
  const byPosition = useMemo(() => {
    const map = new Map<string, WineWithDetails>();
    for (const w of wines) {
      if (w.shelf !== null && w.slot !== null) {
        map.set(`${w.shelf}:${w.slot}`, w);
      }
    }
    return map;
  }, [wines]);

  const isPicker = mode === "admin-vaelger";

  if (layout.shelves.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Køleskabet har ingen hylder endnu.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {layout.shelves.map((shelf, shelfIdx) => {
        const shelfNo = shelfIdx + 1;
        return (
          <div
            key={shelfNo}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
          >
            <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
              Hylde {shelfNo}
            </span>
            {/* Vandret scroll hvis hylden har flere pladser end der er plads til. */}
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
              {Array.from({ length: shelf.slots }, (_, slotIdx) => {
                const slotNo = slotIdx + 1;
                const wine = byPosition.get(`${shelfNo}:${slotNo}`) ?? null;
                const isSelected =
                  selected?.shelf === shelfNo && selected?.slot === slotNo;
                const isHighlighted =
                  !!wine && !!highlightWineId && wine.id === highlightWineId;
                const isOwnWine =
                  !!wine && !!currentWineId && wine.id === currentWineId;

                // I vælger-mode er optagne pladser spærret — undtagen den vin
                // der redigeres lige nu, som gerne må blive liggende.
                const blocked = isPicker && !!wine && !isOwnWine;
                const clickable = isPicker && !blocked;

                const typeStyle = wine ? styleForType(wine.wine_type) : null;
                const isSparkling = wine?.wine_type === "mousserende";

                const label = wine
                  ? `Hylde ${shelfNo}, plads ${slotNo} — ${wine.name}${
                      wine.vintage ? ` (${wine.vintage})` : ""
                    }`
                  : `Hylde ${shelfNo}, plads ${slotNo} — ledig`;

                const common = cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-medium transition",
                  wine ? "border" : "border border-dashed border-border text-muted-foreground",
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  blocked && "cursor-not-allowed opacity-70",
                  clickable && "cursor-pointer hover:border-primary",
                );

                const inlineStyle = typeStyle
                  ? {
                      backgroundColor: typeStyle.fill,
                      color: typeStyle.text,
                      borderColor: `color-mix(in oklch, ${typeStyle.fill} 75%, var(--foreground))`,
                    }
                  : undefined;

                const inner = (
                  <>
                    <span>{slotNo}</span>
                    {/* Bobler markerer mousserende vin. */}
                    {isSparkling && (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 flex gap-[2px]">
                        <span className="h-[3px] w-[3px] rounded-full bg-current opacity-70" />
                        <span className="h-[3px] w-[3px] rounded-full bg-current opacity-50" />
                      </span>
                    )}
                  </>
                );

                // Gæst-mode: ren visning, ingen knapper.
                if (!isPicker) {
                  return (
                    <div
                      key={slotNo}
                      className={common}
                      style={inlineStyle}
                      title={label}
                      aria-label={label}
                    >
                      {inner}
                    </div>
                  );
                }

                return (
                  <button
                    key={slotNo}
                    type="button"
                    disabled={blocked}
                    onClick={() => onSelectSlot?.({ shelf: shelfNo, slot: slotNo })}
                    className={common}
                    style={inlineStyle}
                    title={label}
                    aria-label={label}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Lille farveforklaring til vintyperne. Bruges under køleskabet i admin, så
 * farvekoderne kan aflæses uden at gætte.
 */
export function WineFridgeLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {WINE_TYPE_ORDER.map((type) => {
        const s = styleForType(type);
        return (
          <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-3 w-3 rounded-full border"
              style={{
                backgroundColor: s.fill,
                borderColor: `color-mix(in oklch, ${s.fill} 75%, var(--foreground))`,
              }}
            />
            {type}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-3 w-3 rounded-full border border-dashed border-border" />
        ledig
      </span>
    </div>
  );
}
