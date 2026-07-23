import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WineFridgeLayout, WineWithDetails, WinePlacement } from "@/lib/wines.functions";
import { WINE_TYPE_ORDER, depthLabel } from "@/lib/wines.functions";

// ── Farvekodning pr. vintype ────────────────────────────────────────────────
type WineTypeStyle = { fill: string; text: string };

const WINE_TYPE_STYLE: Record<string, WineTypeStyle> = {
  "rød":         { fill: "oklch(0.40 0.13 18)",  text: "oklch(0.97 0.02 80)" },
  "hvid":        { fill: "oklch(0.85 0.12 95)",  text: "oklch(0.28 0.05 80)" },
  "rosé":        { fill: "oklch(0.84 0.09 20)",  text: "oklch(0.30 0.06 20)" },
  "mousserende": { fill: "oklch(0.91 0.08 100)", text: "oklch(0.30 0.05 90)" },
  "dessertvin":  { fill: "oklch(0.71 0.13 62)",  text: "oklch(0.26 0.06 60)" },
  "andet":       { fill: "oklch(0.72 0.04 270)",  text: "oklch(0.97 0.01 270)" },
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
  depth: number; // 1 = forrest, 2 = bagerst
  layer: number; // 1 = nederste, 2 = øverste
};

export type WineFridgeMode = "admin-vaelger" | "gæst";

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
  isLag2 = false,
}: {
  label: string;
  wine: WineWithDetails | null;
  isSelected: boolean;
  isHighlighted: boolean;
  blocked: boolean;
  clickable: boolean;
  onClick?: () => void;
  isLag2?: boolean;
}) {
  const typeStyle = wine ? styleForType(wine.wine_type) : null;
  // Lag 2 er lidt mindre end lag 1 — 36px vs 44px
  const sizeClass = isLag2 ? "h-9 w-9" : "h-11 w-11";

  const cls = cn(
    "relative flex shrink-0 items-center justify-center rounded-full text-xs font-medium transition select-none",
    sizeClass,
    wine ? "border" : "border border-dashed border-border text-muted-foreground",
    isSelected && "ring-2 ring-primary",
    isHighlighted && "ring-2 ring-primary",
    blocked && "cursor-not-allowed opacity-60",
    clickable && "cursor-pointer hover:border-primary",
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

// ── Grid-baseret dybde-sektion ──────────────────────────────────────────────
//
// Robust forskydning via CSS Grid med inline custom properties.
//
// Lag 1 har N pladser. Lag 2 har N-1 pladser og skal ligge HALVVEJS
// mellem lag-1-cirklerne. Vi opnår dette ved at definere et grid med
// 2N kolonner af ens bredde (LAG1_PX / 2). Da en lag-1-cirkel er 44px og
// gab er 8px, er en halv enhed (44+8)/2 = 26px.
//
// Lag 1 cirkel i slot X starter i grid-kolonne 2X-1 og slutter i 2X+1
// (dvs. spænder 2 kolonner).
// Lag 2 cirkel i slot X starter i grid-kolonne 2X og slutter i 2X+2
// (dvs. også 2 kolonner, men forskudt én halv enhed).
//
// Dermed er lag-2 cirkel Xs centrum præcis midt imellem lag-1 cirklerne
// X og X+1 — uanset skærmstørrelse og uden at bryde ved scroll.

const LAG1_PX = 44; // h-11 w-11
const LAG2_PX = 36; // h-9 w-9
const GAP_PX = 8;   // gap-2
// Halvkolonnebredde i pixels — bruges som --col-w custom property
const HALF_COL_PX = (LAG1_PX + GAP_PX) / 2; // = 26px

function DepthSection({
  shelfNo,
  slots,         // antal pladser i dette lag/denne dybde
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
  // Lag 2 har slots-1 mulige pladser (øverste)
  // Lag 2 vises kun hvis mindst én plads i lag 2 er besat
  // (enten af den fremhævede vin eller af en anden vin).
  const lag2HasWines = Array.from({ length: Math.max(0, slots - 1) }, (_, i) => i + 1).some(
    (slotNo) => byPosition.has(posKey(shelfNo, slotNo, depth, 2)),
  );
  const lag2Count = lag2HasWines ? Math.max(0, slots - 1) : 0;
  // Grid skal have 2*slots kolonner for lag 1, og lag 2 starter ved kolonne 2
  const gridCols = slots * 2;

  return (
    <div className="overflow-x-auto overflow-y-visible pb-1 pt-1">
      {/*
        Grid: 2*slots kolonner, hver HALF_COL_PX bred.
        Lag 1: cirkel i slot X → grid-column: 2X-1 / span 2
        Lag 2: cirkel i slot X → grid-column: 2X   / span 2
        Gab simuleres ved at cirklerne er 44px/36px mens kolonnepar er 52px brede.
      */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, ${HALF_COL_PX}px)`,
          rowGap: "6px",
          padding: "3px 0",  /* plads til ring-2 (2px) + lidt luft */
        }}
      >
        {/* Lag 2 — øverste, forskudt */}
        {lag2Count > 0 && Array.from({ length: lag2Count }, (_, i) => {
          const slotNo = i + 1;
          const wine = byPosition.get(posKey(shelfNo, slotNo, depth, 2)) ?? null;
          const isSelected = selectedPositions.some(
            (s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 2,
          );
          const isHighlighted = !!wine && wine.id === highlightWineId;
          const isOwnWine = !!wine && wine.id === currentWineId;

          const leftOk =
            !!byPosition.get(posKey(shelfNo, slotNo, depth, 1)) ||
            selectedPositions.some((s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 1);
          const rightOk =
            !!byPosition.get(posKey(shelfNo, slotNo + 1, depth, 1)) ||
            selectedPositions.some((s) => s.shelf === shelfNo && s.slot === slotNo + 1 && s.depth === depth && s.layer === 1);
          const prereqMet = leftOk && rightOk;

          const blocked = isPicker ? (!!wine && !isOwnWine) || !prereqMet : false;
          const clickable = isPicker && !blocked;

          // Lag 2 slot X → grid-column: 2X / span 2
          const colStart = slotNo * 2;

          return (
            <div
              key={slotNo}
              style={{ gridColumn: `${colStart} / span 2`, display: "flex", justifyContent: "center" }}
            >
              <Bottle
                label={String(slotNo)}
                wine={wine}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                blocked={blocked}
                clickable={clickable}
                isLag2
                onClick={clickable ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 2 }) : undefined}
              />
            </div>
          );
        })}

        {/* Lag 2 fylder én grid-row — lag 1 starter i næste row */}
        {/* Vi bruger en tom div der fylder hele bredden som row-separator kun hvis lag2Count > 0 */}
        {lag2Count === 0 && null}

        {/* Lag 1 — nederste */}
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

          // Lag 1 slot X → grid-column: 2X-1 / span 2
          const colStart = slotNo * 2 - 1;

          return (
            <div
              key={slotNo}
              style={{ gridColumn: `${colStart} / span 2`, display: "flex", justifyContent: "center" }}
            >
              <Bottle
                label={String(slotNo)}
                wine={wine}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                blocked={blocked}
                clickable={clickable}
                onClick={clickable ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 1 }) : undefined}
              />
            </div>
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
          <div key={shelfNo} className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Hylde {shelfNo}</p>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground/70">Bagerst</p>
                <DepthSection
                  shelfNo={shelfNo} slots={shelf.slotsBagerst} depth={2}
                  byPosition={byPosition} mode={mode}
                  selectedPositions={selectedPositions}
                  highlightWineId={highlightWineId} currentWineId={currentWineId}
                  onSelectSlot={onSelectSlot}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground/70">Forrest</p>
                <DepthSection
                  shelfNo={shelfNo} slots={shelf.slotsForrest} depth={1}
                  byPosition={byPosition} mode={mode}
                  selectedPositions={selectedPositions}
                  highlightWineId={highlightWineId} currentWineId={currentWineId}
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

// ── Gæstevisning: kun relevante hylder ─────────────────────────────────────
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

  const groups = useMemo(() => {
    const map = new Map<string, { shelf: number; depth: number; placements: WinePlacement[] }>();
    for (const p of wine.placements) {
      const key = `${p.shelf}:${p.depth}`;
      if (!map.has(key)) map.set(key, { shelf: p.shelf, depth: p.depth, placements: [] });
      map.get(key)!.placements.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.shelf - b.shelf || a.depth - b.depth);
  }, [wine.placements]);

  if (groups.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Spørg bartenderen.</p>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((g) => {
        const shelfDef = layout.shelves[g.shelf - 1];
        // Brug korrekt slots-antal afhængigt af dybden
        const slots = g.depth === 1
          ? (shelfDef?.slotsForrest ?? 5)
          : (shelfDef?.slotsBagerst ?? 5);

        return (
          <div key={`${g.shelf}:${g.depth}`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hylde {g.shelf} — {depthLabel(g.depth)}
              {wine.placements.length > 1 && (
                <span className="ml-1 font-normal normal-case">
                  ({g.placements.length} {g.placements.length === 1 ? "flaske" : "flasker"})
                </span>
              )}
            </p>
            <div className="rounded-lg border border-border bg-card p-3">
              <DepthSection
                shelfNo={g.shelf}
                slots={slots}
                depth={g.depth}
                byPosition={byPosition}
                mode="gæst"
                selectedPositions={[]}
                highlightWineId={wine.id}
              />
            </div>
          </div>
        );
      })}
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
            <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: s.fill, borderColor: `color-mix(in oklch, ${s.fill} 75%, var(--foreground))` }} />
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
