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

// ── Dimensioner ─────────────────────────────────────────────────────────────
// Lag 1: 44px (w-11), lag 2: 36px (w-9). Gap mellem cirkler: 8px (gap-2).
// Forskydning lag 2: centerlinjen skal ligge halvvejs mellem to lag-1-centre.
// Lag 1 center-til-center afstand: 44 + 8 = 52px.
// Lag 2 offset fra venstre kant af lag 1: (52 / 2) - (36 / 2) = 26 - 18 = 8px.
// Men vi vil have LAG 2's VENSTREKANT til at starte 26px inde i lag 1's første cirkel,
// dvs. marginLeft = 26px (halvt af lag-1-pitch).
const LAG1_SIZE = 44; // px, svarende til w-11
const LAG2_SIZE = 36; // px, svarende til w-9
const GAP = 8;        // px, svarende til gap-2
const PITCH = LAG1_SIZE + GAP; // 52px — center-til-center afstand i lag 1
// Lag 2 cirkel 1's centrum skal ligge ved x = PITCH/2 = 26px fra lag 1 cirkel 1's centrum.
// Lag 2 cirkel 1's venstrekant: 26 - LAG2_SIZE/2 = 26 - 18 = 8px.
// Men vi lægger lag 2 i en container med padding-left = PITCH/2 - LAG2_SIZE/2 = 8px
// og bruger samme gap (8px) som lag 1. Dermed:
//   lag2[0] centrum = 8 + 18 = 26px ✓
//   lag2[1] centrum = 8 + 18 + 52 = 78px = 26 + 52 ✓ (halvvejs mellem lag1[1] og lag1[2])
const LAG2_OFFSET = PITCH / 2 - LAG2_SIZE / 2; // = 8px

// ── Typer ───────────────────────────────────────────────────────────────────
export type FridgePosition = {
  shelf: number;
  slot: number;
  depth: number;
  layer: number;
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
  const isSparkling = wine?.wine_type === "mousserende";
  // Lag 2 er lidt mindre end lag 1
  const sizeClass = isLag2 ? "h-9 w-9" : "h-11 w-11";

  const cls = cn(
    "relative flex shrink-0 items-center justify-center rounded-full text-xs font-medium transition select-none",
    sizeClass,
    wine ? "border" : "border border-dashed border-border text-muted-foreground",
    // Ingen ring-offset — undgår at ringen klippes af overflow-hidden
    isSelected && "ring-2 ring-primary",
    isHighlighted && "ring-2 ring-primary animate-pulse",
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

// ── Én dybde-sektion (forrest ELLER bagerst) med lag 1 + lag 2 ─────────────
function DepthSection({
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

  return (
    <div className="space-y-1">
      {/* Lag 2 — øverste, forskudt præcist halvt pitch til højre */}
      {slots > 1 && (
        <div className="overflow-x-auto pb-0.5">
          <div
            className="flex"
            style={{
              paddingLeft: LAG2_OFFSET,
              gap: GAP,
            }}
          >
            {Array.from({ length: slots - 1 }, (_, i) => {
              const slotNo = i + 1;
              const wine = byPosition.get(posKey(shelfNo, slotNo, depth, 2)) ?? null;
              const isSelected = selectedPositions.some(
                (s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 2,
              );
              const isHighlighted = !!wine && wine.id === highlightWineId;
              const isOwnWine = !!wine && wine.id === currentWineId;

              // Tjek forudsætning: lag 1 slot X og X+1 begge besat (inkl. valgte pladser)
              const leftOk =
                !!byPosition.get(posKey(shelfNo, slotNo, depth, 1)) ||
                selectedPositions.some((s) => s.shelf === shelfNo && s.slot === slotNo && s.depth === depth && s.layer === 1);
              const rightOk =
                !!byPosition.get(posKey(shelfNo, slotNo + 1, depth, 1)) ||
                selectedPositions.some((s) => s.shelf === shelfNo && s.slot === slotNo + 1 && s.depth === depth && s.layer === 1);
              const prereqMet = leftOk && rightOk;

              const blocked = isPicker ? (!!wine && !isOwnWine) || !prereqMet : false;
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
                  isLag2
                  onClick={clickable ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 2 }) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Lag 1 — nederste */}
      <div className="overflow-x-auto pb-0.5">
        <div className="flex" style={{ gap: GAP }}>
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
                onClick={clickable ? () => onSelectSlot?.({ shelf: shelfNo, slot: slotNo, depth, layer: 1 }) : undefined}
              />
            );
          })}
        </div>
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
                  shelfNo={shelfNo} slots={shelf.slots} depth={2}
                  byPosition={byPosition} mode={mode}
                  selectedPositions={selectedPositions}
                  highlightWineId={highlightWineId} currentWineId={currentWineId}
                  onSelectSlot={onSelectSlot}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground/70">Forrest</p>
                <DepthSection
                  shelfNo={shelfNo} slots={shelf.slots} depth={1}
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
        const slots = layout.shelves[g.shelf - 1]?.slots ?? 5;
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
            <div className="space-y-1 rounded-lg border border-border bg-card p-3">
              {/* Lag 2 */}
              {slots > 1 && (
                <div className="overflow-x-auto pb-0.5">
                  <div className="flex" style={{ paddingLeft: LAG2_OFFSET, gap: GAP }}>
                    {Array.from({ length: slots - 1 }, (_, i) => {
                      const slotNo = i + 1;
                      const w = byPosition.get(posKey(g.shelf, slotNo, g.depth, 2)) ?? null;
                      return (
                        <Bottle key={slotNo} label={String(slotNo)} wine={w}
                          isSelected={false} isHighlighted={!!w && w.id === wine.id}
                          blocked={false} clickable={false} isLag2 />
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Lag 1 */}
              <div className="overflow-x-auto pb-0.5">
                <div className="flex" style={{ gap: GAP }}>
                  {Array.from({ length: slots }, (_, i) => {
                    const slotNo = i + 1;
                    const w = byPosition.get(posKey(g.shelf, slotNo, g.depth, 1)) ?? null;
                    return (
                      <Bottle key={slotNo} label={String(slotNo)} wine={w}
                        isSelected={false} isHighlighted={!!w && w.id === wine.id}
                        blocked={false} clickable={false} />
                    );
                  })}
                </div>
              </div>
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
