/**
 * WineFridgeManager — omrokering af vinkøleskabet og "drik fra skabet" (admin).
 *
 * - Tryk på en flaske i skabet for at vælge den. Tryk derefter på en ledig plads
 *   for at flytte den, eller på en optaget plads for at bytte plads (med bekræftelse).
 * - "Uden plads": flasker der ligger på lager uden en plads i skabet. Vælg en vin
 *   og tryk på en ledig plads for at placere en flaske ad gangen.
 * - Tøm hylde / vintype / kategori / hele skabet sender flaskerne til "Uden plads"
 *   — de fjernes aldrig fra lageret.
 * - Valgt flaske kan markeres som drukket direkte herfra.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassWater, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  WineFridge, WineFridgeLegend, findPlacementAt, styleForType, type FridgePosition,
} from "@/components/app/wine-fridge";
import { DrinkWineDialog } from "@/components/app/drink-wine-dialog";
import {
  listWineStyles, computeUnplaceTargets, depthLabel, WINE_TYPE_ORDER,
  type WineWithDetails, type WineFridgeLayout, type WinePlacement,
  type UnplaceScope, type ScopedPlacement, type WineStyle,
} from "@/lib/wines.functions";
import {
  unplaceBottles, placeUnplacedBottle, moveOrSwapBottle, deletePlacement,
} from "@/lib/wines-admin.functions";

// Vælg-værdi for "uden kategori" (Radix Select tillader ikke tom streng)
const NO_STYLE = "__none__";

type Selection =
  | { kind: "placed"; placementId: string }
  | { kind: "unplaced"; wineId: string }
  | null;

function posLabel(p: { shelf: number; slot: number; depth: number; layer: number }): string {
  return `Hylde ${p.shelf} · ${depthLabel(p.depth)} · plads ${p.slot}${p.layer === 2 ? " · øverste lag" : ""}`;
}

function wineLabel(w: WineWithDetails): string {
  return `${w.name}${w.vintage ? ` ${w.vintage}` : ""}`;
}

function scopeTitle(scope: UnplaceScope, styles: WineStyle[]): string {
  switch (scope.scope) {
    case "all": return "Tøm hele skabet";
    case "shelf": return `Tøm hylde ${scope.shelf}`;
    case "type": return `Tøm vintype "${scope.wineType}"`;
    case "style": {
      if (scope.styleId === null) return "Tøm vine uden kategori";
      return `Tøm kategorien "${styles.find((s) => s.id === scope.styleId)?.style ?? scope.styleId}"`;
    }
  }
}

export function WineFridgeManager({ wines, layout }: { wines: WineWithDetails[]; layout: WineFridgeLayout }) {
  const qc = useQueryClient();
  const unplace = useServerFn(unplaceBottles);
  const place = useServerFn(placeUnplacedBottle);
  const move = useServerFn(moveOrSwapBottle);
  const unplaceOne = useServerFn(deletePlacement);
  const fetchStyles = useServerFn(listWineStyles);

  const { data: styles } = useQuery({ queryKey: ["wine-styles"], queryFn: () => fetchStyles(), staleTime: 60 * 60_000 });
  const styleList = (styles ?? []) as WineStyle[];

  const [sel, setSel] = useState<Selection>(null);
  const [busy, setBusy] = useState(false);
  const [swap, setSwap] = useState<{ aId: string; bId: string } | null>(null);
  const [emptyScope, setEmptyScope] = useState<UnplaceScope | null>(null);
  const [drinkTarget, setDrinkTarget] = useState<{ wine: WineWithDetails; placementId: string } | null>(null);
  const [shelfPick, setShelfPick] = useState("");
  const [typePick, setTypePick] = useState("");
  const [stylePick, setStylePick] = useState("");

  // ── Afledte data ──────────────────────────────────────────────────────────
  const placementIndex = useMemo(() => {
    const m = new Map<string, { wine: WineWithDetails; placement: WinePlacement }>();
    for (const w of wines) for (const p of w.placements) m.set(p.id, { wine: w, placement: p });
    return m;
  }, [wines]);

  const unplacedWines = useMemo(() => wines.filter((w) => w.unplaced_count > 0), [wines]);
  const totalUnplaced = unplacedWines.reduce((sum, w) => sum + w.unplaced_count, 0);

  const scopedPlacements = useMemo<ScopedPlacement[]>(
    () => wines.flatMap((w) => w.placements.map((p) => ({ ...p, wine_type: w.wine_type, style_id: w.style_id }))),
    [wines],
  );

  // Valget er kun gyldigt, så længe flasken/vinen stadig findes i data
  const selPlaced = sel?.kind === "placed" ? placementIndex.get(sel.placementId) ?? null : null;
  const selUnplacedWine = sel?.kind === "unplaced"
    ? wines.find((w) => w.id === sel.wineId && w.unplaced_count > 0) ?? null
    : null;

  const selectedPositions: FridgePosition[] = selPlaced
    ? [{ shelf: selPlaced.placement.shelf, slot: selPlaced.placement.slot, depth: selPlaced.placement.depth, layer: selPlaced.placement.layer }]
    : [];

  const swapA = swap ? placementIndex.get(swap.aId) ?? null : null;
  const swapB = swap ? placementIndex.get(swap.bId) ?? null : null;

  const preview = emptyScope ? computeUnplaceTargets(scopedPlacements, emptyScope) : null;

  const shelfCount = layout.shelves.length;

  // ── Fælles kørsel af en server-handling ──────────────────────────────────
  async function run(action: () => Promise<unknown>, successMsg: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["wines-all"] }),
        qc.invalidateQueries({ queryKey: ["wines"] }),
      ]);
      toast.success(successMsg);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fejl");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ── Tryk på en plads i skabet ────────────────────────────────────────────
  async function handleSlot(pos: FridgePosition) {
    if (busy) return;
    const occ = findPlacementAt(wines, pos);

    // Intet valgt: vælg flasken, hvis der er en
    if (!sel || (!selPlaced && !selUnplacedWine)) {
      if (occ) setSel({ kind: "placed", placementId: occ.placement.id });
      else toast.info('Vælg først en flaske i skabet eller en vin under "Uden plads"');
      return;
    }

    // Uplaceret flaske valgt: kræver en ledig plads
    if (selUnplacedWine) {
      if (occ) { toast.error("Pladsen er optaget — vælg en ledig plads"); return; }
      // Vinen forbliver valgt, så man kan placere flere flasker i træk
      await run(() => place({ data: { wineId: selUnplacedWine.id, ...pos } }), `${selUnplacedWine.name} er placeret`);
      return;
    }

    // Placeret flaske valgt
    if (selPlaced) {
      if (occ && occ.placement.id === selPlaced.placement.id) { setSel(null); return; }
      if (occ) { setSwap({ aId: selPlaced.placement.id, bId: occ.placement.id }); return; }
      const ok = await run(
        () => move({ data: { placementId: selPlaced.placement.id, ...pos } }),
        "Flasken er flyttet",
      );
      if (ok) setSel(null);
    }
  }

  async function confirmSwap() {
    if (!swapA || !swapB) return;
    const target = swapB.placement;
    const ok = await run(
      () => move({ data: {
        placementId: swapA.placement.id,
        shelf: target.shelf, slot: target.slot, depth: target.depth, layer: target.layer,
      } }),
      "Flaskerne har byttet plads",
    );
    setSwap(null);
    if (ok) setSel(null);
  }

  async function confirmEmpty() {
    if (!emptyScope) return;
    const scope = emptyScope;
    const ok = await run(async () => {
      const res = await unplace({ data: scope });
      toast.message(`${res.moved} ${res.moved === 1 ? "flaske" : "flasker"} er nu uden plads`);
    }, "Skabet er tømt for det valgte");
    setEmptyScope(null);
    if (ok) setSel(null);
  }

  async function unplaceSelected() {
    if (!selPlaced) return;
    const ok = await run(() => unplaceOne({ data: { id: selPlaced.placement.id } }), "Flasken er gjort uden plads");
    if (ok) setSel(null);
  }

  return (
    <div className="space-y-5">
      {/* ── Tøm-funktioner ─────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Tøm til "Uden plads"</p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1">
            <Label className="text-xs">Hylde</Label>
            <Select value={shelfPick} onValueChange={setShelfPick}>
              <SelectTrigger><SelectValue placeholder="Vælg hylde" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: shelfCount }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Hylde {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" disabled={!shelfPick || busy}
            onClick={() => setEmptyScope({ scope: "shelf", shelf: Number(shelfPick) })}>
            Tøm hylde
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1">
            <Label className="text-xs">Vintype</Label>
            <Select value={typePick} onValueChange={setTypePick}>
              <SelectTrigger><SelectValue placeholder="Vælg vintype" /></SelectTrigger>
              <SelectContent>
                {WINE_TYPE_ORDER.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" disabled={!typePick || busy}
            onClick={() => setEmptyScope({ scope: "type", wineType: typePick })}>
            Tøm vintype
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1">
            <Label className="text-xs">Kategori</Label>
            <Select value={stylePick} onValueChange={setStylePick}>
              <SelectTrigger><SelectValue placeholder="Vælg kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STYLE}>Uden kategori</SelectItem>
                {styleList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.style} · {s.bar_type ?? "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" disabled={!stylePick || busy}
            onClick={() => setEmptyScope({ scope: "style", styleId: stylePick === NO_STYLE ? null : stylePick })}>
            Tøm kategori
          </Button>
        </div>

        <Button type="button" variant="outline" className="w-full text-destructive" disabled={busy}
          onClick={() => setEmptyScope({ scope: "all" })}>
          Tøm hele skabet
        </Button>
      </div>

      {/* ── Uden plads ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Uden plads <span className="font-normal text-muted-foreground">({totalUnplaced} {totalUnplaced === 1 ? "flaske" : "flasker"})</span>
        </p>
        {unplacedWines.length === 0 ? (
          <p className="text-xs text-muted-foreground">Alle flasker har en plads i skabet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unplacedWines.map((w) => {
              const active = selUnplacedWine?.id === w.id;
              const s = styleForType(w.wine_type);
              return (
                <button
                  key={w.id} type="button" disabled={busy}
                  onClick={() => setSel(active ? null : { kind: "unplaced", wineId: w.id })}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: s.fill, borderColor: `color-mix(in oklch, ${s.fill} 75%, var(--foreground))` }} />
                  <span>{wineLabel(w)}</span>
                  <span className="tabular-nums text-muted-foreground">×{w.unplaced_count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Handlingslinje for valgt flaske / vin ──────────────────────── */}
      {selUnplacedWine && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <span>
            Placér <strong>{wineLabel(selUnplacedWine)}</strong> ({selUnplacedWine.unplaced_count} uden plads) — tryk på en ledig plads i skabet.
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSel(null)}>
            <X className="mr-1 h-4 w-4" /> Afbryd
          </Button>
        </div>
      )}
      {selPlaced && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <p>
            Valgt: <strong>{wineLabel(selPlaced.wine)}</strong> — {posLabel(selPlaced.placement)}.
            Tryk på en ledig plads for at flytte den, eller på en anden flaske for at bytte plads.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy}
              onClick={() => setDrinkTarget({ wine: selPlaced.wine, placementId: selPlaced.placement.id })}>
              <GlassWater className="mr-1 h-4 w-4" /> Drik
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={unplaceSelected}>
              Gør uden plads
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSel(null)}>
              <X className="mr-1 h-4 w-4" /> Afbryd
            </Button>
          </div>
        </div>
      )}

      {/* ── Skabet ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <WineFridge
          mode="admin-flyt" wines={wines} layout={layout}
          selectedPositions={selectedPositions}
          onSelectSlot={handleSlot}
        />
        <WineFridgeLegend />
      </div>

      {/* ── Bekræft tøm ────────────────────────────────────────────────── */}
      <Dialog open={!!emptyScope} onOpenChange={(v) => !v && !busy && setEmptyScope(null)}>
        <DialogContent className="sm:max-w-sm" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{emptyScope ? scopeTitle(emptyScope, styleList) : ""}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {preview && preview.directCount === 0 ? (
                  <p>Der er ingen flasker i skabet, der passer til valget.</p>
                ) : (
                  <>
                    <p>
                      <strong>{preview?.ids.length ?? 0}</strong> {(preview?.ids.length ?? 0) === 1 ? "flaske" : "flasker"} flyttes
                      til "Uden plads". De fjernes ikke fra lageret.
                    </p>
                    {preview && preview.extraCount > 0 && (
                      <p>
                        {preview.extraCount} af dem ligger i øverste lag ovenpå de tømte flasker og følger derfor med,
                        selvom de ikke hører til valget.
                      </p>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmptyScope(null)} disabled={busy}>Annullér</Button>
            <Button variant="destructive" onClick={confirmEmpty} disabled={busy || !preview || preview.directCount === 0}>
              {busy ? "Tømmer…" : "Tøm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bekræft bytte ──────────────────────────────────────────────── */}
      <Dialog open={!!swap} onOpenChange={(v) => !v && !busy && setSwap(null)}>
        <DialogContent className="sm:max-w-sm" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Byt plads?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {swapA && swapB && (
                  <>
                    <p><strong>{wineLabel(swapA.wine)}</strong><br />{posLabel(swapA.placement)}</p>
                    <p className="text-center">⇅</p>
                    <p><strong>{wineLabel(swapB.wine)}</strong><br />{posLabel(swapB.placement)}</p>
                    <p>De to flasker bytter plads.</p>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSwap(null)} disabled={busy}>Annullér</Button>
            <Button onClick={confirmSwap} disabled={busy || !swapA || !swapB}>
              {busy ? "Bytter…" : "Byt plads"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Drik fra skabet ────────────────────────────────────────────── */}
      <DrinkWineDialog
        open={!!drinkTarget} wine={drinkTarget?.wine ?? null}
        allWines={wines} layout={layout}
        logAction="admin-drukket"
        placementId={drinkTarget?.placementId}
        onClose={() => setDrinkTarget(null)}
        onSuccess={() => setSel(null)}
      />
    </div>
  );
}
