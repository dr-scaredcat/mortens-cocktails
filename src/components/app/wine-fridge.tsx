import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WineFridgeLayout, WineWithDetails, WinePlacement } from "@/lib/wines.functions";
import { WINE_TYPE_ORDER, depthLabel } from "@/lib/wines.functions";

// ── Farvekodning pr. vintype ────────────────────────────────────────────────
type WineTypeStyle = { fill: string; text: string };

const WINE_TYPE_STYLE: Record<string, WineTypeStyle> = {
  "rød":        { fill: "oklch(0.40 0.13 18)",  text: "oklch(0.97 0.02 80)" },
  "hvid":       { fill: "oklch(0.85 0.12 95)",  text: "oklch(0.28 0.05 80)" },
  "rosé":       { fill: "oklch(0.84 0.09 20)",  text: "oklch(0.30 0.06 20)" },
  "mousserende":{ fill: "oklch(0.91 0.08 100)", text: "oklch(0.30 0.05 90)" },
  "dessertvin": { fill: "oklch(0.71 0.13 62)",  text: "oklch(0.26 0.06 60)" },
  "hedvin":     { fill: "oklch(0.58 0.13 48)",  text: "oklch(0.97 0.02 80)" },
};

const FALLBACK_STYLE: WineTypeStyle = {
  fill: "var(--muted-foreground)",
  text: "var(--background)",
};

function styleForType(type: string): WineTypeStyle {
  return WINE_TYPE_STYLE[type] ?? FALLBACK_STYLE;
}

// ── Typer ───────────────────────────────────────────────────────────────────
export type FridgePosition = {
  shelf: number;
  slot: number;
  depth: number; // 1 | 2
  layer: number; // 1 | 2
};

export type WineFridgeMode = "admin-vaelger" | "gæst";

// ── Hjælper: opbyg lookup-map ─────────────────────────────────────────────
// Nøgle: "shelf:slot:depth:layer"
function buildPositionMap(wines: WineWithDetails[]): Map<string, WineWithDetails> {
  const map = new Map<string, WineWithDetails>();
  for (const w of wines) {
    for (const p of w.placements) {
      map.set(`${p.shelf}:${p.slot}:${p.depth}:${p.layer}`, w);
    }
  }
  return map;
}

function posKey(shelf: number, slot: number, depth: number, layer: number): string {
  return `${shelf}:${slot}:${depth}:${layer}`;
}

// ── Enkelt pladselement ───────────────────────────────────────────────────
function Bottle({
  label,
  wine,
  isSelected,
  isHighlighted,
  blocked,
  clickable,
  onClick,
  size = "md",
}: {
  label: string;
  wine: WineWithDetails | null;
  isSelected: boolean;
  isHighlighted: boolean;
  blocked: boolean;
  clickable: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const typeStyle = wine ? styleForType(wine.wine_type) : null;
  const isSparkling = wine?.wine_type === "mousserende";
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  const cls = cn(
    "relative flex shrink-0 items-center justify-center rounded-full text-xs font-medium transition select-none",
    dim,
    wine
      ? "border"
      : "border border-dashed border-border text-muted-foreground",
    // Ring uden offset, så den aldrig klippes
    isSelected && "ring-2 ring-primary",
    isHighlighted && "ring-2 ring-primary animate-pulse",
    blocked && "cursor-not-allowed opacity-60",
    clickable && !blocked && "cursor-pointer hover:border-primary",
  );

  const style = typeStyle
    ? {
        backgroundColor: typeStyle.fill,
        color: typeStyle.text,
        borderColor: `color-mix(in oklch, ${typeStyle.fill} 75%, var(--foreground))`,
      }
    : undefined;

  const inner = (
    <>
      <span className="leading-none">{label}</span>
      {isSparkling && (
        <span className="pointer-events-none absolute right-1 top-1 flex gap-[2px]">
          <span className="h-[3px] w-[3px] rounded-full bg-current opacity-70" />
          <span className="h-[3px] w-[3px] rounded-full bg-current opacity-50" />
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div className={cls} style={style} title={wine?.name ?? "ledig"} aria-label={wine?.name ?? "ledig"}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={onClick}
      className={cls}
      style={style}
      title={wine?.name ?? "ledig"}
      aria-label={wine?.name ?? "ledig"}
    >
      {inner}
    </button>
  );
}

// ── Én hylde med to dybder + to lag ─────────────────────────────────────────
// Visuel struktur (set forfra):
//
//   LAG 2 BAGERST:  ● ● ● ● (forskudt halvt slot til højre)
//   LAG 1 BAGERST:  ● ● ● ● ●
//   LAG 2 FORREST:  ● ● ● ● (forskudt halvt slot til højre)
//   LAG 1 FORREST:  ● ● ● ● ●
//
// Forskydning implementeres med en negativ margin-left på lag-2-rækken.

function ShelfRow({
  shelfNo,
  slots,
  depth,
  byPosition,
  mode,
  selectedPositions,
  highlightWineId,
  currentWineId,
  onSelectSlot,
}: {
  shelfNo: number;
  slots: number;
  depth: number;
  byPosition: Map<string, WineWithDetails>;
  mode: WineFridgeMode;
  selectedPositions: FridgePosition[];
  highlightWineId?: string | null;
  currentWineId?: string | null;
  onSelectSlot?: (pos: FridgePosition) => void;
}) {
  const isPicker = mode === "admin-vaelger";
  // Halv flaskebredde i px til forskydning af lag 2 (22px = halvt af h-11/w-11 44px)
  const OFFSET = 22;

  return (
    <div className="space-y-1">
      {/* Lag 2 (øverste) — forskudt halvt slot */}
      <div className="flex items-center overflow-x-auto pb-0.5" style={{ paddingLeft: OFFSET }}>
        <div className="flex gap-2">
          {/* Lag 2 har slots-1 mulige pladser (en flaske hviler på to naboer) */}
          {Array.from({ length: Math.max(0, slots - 1) }, (_, i) => {
            const slotNo = i + 1;
            const wine = byPosition.get(posKey(shelfNo, slotNo, depth, 2)) ?? null;
            const isSelected = selectedPositions.some(
              (s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 2,
            );
            const isHighlighted = !!wine && wine.id === highlightWineId;
            const isOwnWine = !!wine && wine.id === currentWineId;

            // Lag 2 kræver at lag 1 slot X og X+1 begge er besat
            const leftFilled = !!byPosition.get(posKey(shelfNo, slotNo, depth, 1));
            const rightFilled = !!byPosition.get(posKey(shelfNo, slotNo + 1, depth, 1));
            // I picker: tillad valg på tom plads, men kun hvis begge naboer i lag 1 er besat
            // (naboerne kan være den vin vi er ved at placere — vi tjekker mod selectedPositions)
            const leftOk =
              leftFilled ||
              selectedPositions.some(
                (s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 1,
              );
            const rightOk =
              rightFilled ||
              selectedPositions.some(
                (s) => s.shelf === shelfNo && s.slot === slotNo + 1 && s.depth === depth && s.layer === 1,
              );
            const prereqMet = leftOk && rightOk;

            const blocked = isPicker
              ? (!!wine && !isOwnWine) || !prereqMet
              : false;
            const clickable = isPicker && !blocked;

            return (
              <Bottle
                key={slotNo}
                label={String(slotNo)}
                wine={wine}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                blocked={blocked}
                clickable={clickable}
                size="sm"
                onClick={
                  clickable
                    ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 2 })
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Lag 1 (nederste) */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {Array.from({ length: slots }, (_, i) => {
          const slotNo = i + 1;
          const wine = byPosition.get(posKey(shelfNo, slotNo, depth, 1)) ?? null;
          const isSelected = selectedPositions.some(
            (s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 1,
          );
          const isHighlighted = !!wine && wine.id === highlightWineId;
          const isOwnWine = !!wine && wine.id === currentWineId;
          const blocked = isPicker && !!wine && !isOwnWine;
          const clickable = isPicker && !blocked;

          return (
            <Bottle
              key={slotNo}
              label={String(slotNo)}
              wine={wine}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              blocked={blocked}
              clickable={clickable}
              onClick={
                clickable
                  ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 1 })
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Hoved-WineFridge-komponent ───────────────────────────────────────────────
export function WineFridge({
  mode,
  wines,
  layout,
  selectedPositions = [],
  highlightWineId = null,
  currentWineId = null,
  onSelectSlot,
  className,
}: {
  mode: WineFridgeMode;
  wines: WineWithDetails[];
  layout: WineFridgeLayout;
  /** Aktuelt valgte pladser (admin-vælger med quantity > 1). */
  selectedPositions?: FridgePosition[];
  highlightWineId?: string | null;
  currentWineId?: string | null;
  onSelectSlot?: (pos: FridgePosition) => void;
  className?: string;
}) {
  const byPosition = useMemo(() => buildPositionMap(wines), [wines]);

  if (layout.shelves.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Køleskabet har ingen hylder endnu.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {layout.shelves.map((shelf, shelfIdx) => {
        const shelfNo = shelfIdx + 1;
        return (
          <div
            key={shelfNo}
            className="rounded-lg border border-border bg-card p-3"
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Hylde {shelfNo}
            </p>
            <div className="space-y-3">
              {/* Bagerste række */}
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground/70">Bagerst</p>
                <ShelfRow
                  shelfNo={shelfNo}
                  slots={shelf.slots}
                  depth={2}
                  byPosition={byPosition}
                  mode={mode}
                  selectedPositions={selectedPositions}
                  highlightWineId={highlightWineId}
                  currentWineId={currentWineId}
                  onSelectSlot={onSelectSlot}
                />
              </div>
              {/* Forreste række */}
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground/70">Forrest</p>
                <ShelfRow
                  shelfNo={shelfNo}
                  slots={shelf.slots}
                  depth={1}
                  byPosition={byPosition}
                  mode={mode}
                  selectedPositions={selectedPositions}
                  highlightWineId={highlightWineId}
                  currentWineId={currentWineId}
                  onSelectSlot={onSelectSlot}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Gæstevisning: kun de hylder hvor vinen faktisk ligger ───────────────────
// Viser én sektion pr. unik (shelf, depth)-kombination med tekst + grafik.
export function WinePlacementView({
  wine,
  allWines,
  layout,
  className,
}: {
  wine: WineWithDetails;
  allWines: WineWithDetails[];
  layout: WineFridgeLayout;
  className?: string;
}) {
  const byPosition = useMemo(() => buildPositionMap(allWines), [allWines]);

  // Grupper vinens placeringer pr. (shelf, depth)
  const groups = useMemo(() => {
    const map = new Map<string, { shelf: number; depth: number; placements: WinePlacement[] }>();
    for (const p of wine.placements) {
      const key = `${p.shelf}:${p.depth}`;
      if (!map.has(key)) map.set(key, { shelf: p.shelf, depth: p.depth, placements: [] });
      map.get(key)!.placements.push(p);
    }
    // Sorter: hylde stigende, depth 1 (forrest) før 2 (bagerst)
    return Array.from(map.values()).sort(
      (a, b) => a.shelf - b.shelf || a.depth - b.depth,
    );
  }, [wine.placements]);

  if (groups.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Spørg bartenderen.
      </p>
    );
  }

  const shelfDef = (shelfNo: number) =>
    layout.shelves[shelfNo - 1] ?? { slots: 5 };

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((g) => (
        <div key={`${g.shelf}:${g.depth}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hylde {g.shelf} — {depthLabel(g.depth)}
            {wine.placements.length > 1 && (
              <span className="ml-1 font-normal normal-case">
                ({g.placements.length} {g.placements.length === 1 ? "flaske" : "flasker"})
              </span>
            )}
          </p>
          {/* Grafisk hyldevisning — kun lag 1 og lag 2 for denne (shelf, depth) */}
          <div className="space-y-1 rounded-lg border border-border bg-card p-3">
            {/* Lag 2 */}
            {(() => {
              const slots = shelfDef(g.shelf).slots;
              const OFFSET = 22;
              return (
                <div style={{ paddingLeft: OFFSET }}>
                  <div className="flex gap-2">
                    {Array.from({ length: Math.max(0, slots - 1) }, (_, i) => {
                      const slotNo = i + 1;
                      const w = byPosition.get(posKey(g.shelf, slotNo, g.depth, 2)) ?? null;
                      const isHl = !!w && w.id === wine.id;
                      return (
                        <Bottle
                          key={slotNo}
                          label={String(slotNo)}
                          wine={w}
                          isSelected={false}
                          isHighlighted={isHl}
                          blocked={false}
                          clickable={false}
                          size="sm"
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Lag 1 */}
            <div className="flex gap-2">
              {Array.from({ length: shelfDef(g.shelf).slots }, (_, i) => {
                const slotNo = i + 1;
                const w = byPosition.get(posKey(g.shelf, slotNo, g.depth, 1)) ?? null;
                const isHl = !!w && w.id === wine.id;
                return (
                  <Bottle
                    key={slotNo}
                    label={String(slotNo)}
                    wine={w}
                    isSelected={false}
                    isHighlighted={isHl}
                    blocked={false}
                    clickable={false}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Farveforklaring ─────────────────────────────────────────────────────────
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
