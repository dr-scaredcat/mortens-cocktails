/**
 * DrinkWineDialog — delt komponent til "drik en flaske"-flowet.
 *
 * Viser vinens placeringer grafisk og lader brugeren vælge hvilken flaske
 * der tages. Bruges i:
 *   - Admin vinliste (bartender-knap)
 *   - Bestillingssiden (markér ordre færdig)
 *   - Gæstesiden (self-serve "Drik"-knap)
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WinePlacementView, WineFridgeLegend } from "@/components/app/wine-fridge";
import {
  drinkWine,
  type WineWithDetails,
  type WineFridgeLayout,
  type WinePlacement,
  depthLabel,
} from "@/lib/wines.functions";

export function DrinkWineDialog({
  open,
  wine,
  allWines,
  layout,
  requireSelfServe = false,
  logAction = "drukket",
  onClose,
  onSuccess,
}: {
  open: boolean;
  wine: WineWithDetails | null;
  allWines: WineWithDetails[];
  layout: WineFridgeLayout;
  /** Sæt true fra gæstevisning — serveren validerer at self-serve er aktiveret */
  requireSelfServe?: boolean;
  /** Logges i order_log.customer_name som kontekst */
  logAction?: string;
  onClose: () => void;
  /** Kaldes efter vellykket sletning */
  onSuccess?: () => void;
}) {
  const drink = useServerFn(drinkWine);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<WinePlacement | null>(null);
  const [busy, setBusy] = useState(false);

  if (!wine) return null;

  const placements = wine.placements;

  async function confirm() {
    if (!wine) return;
    const pl = placements.length === 1 ? placements[0] : selected;
    if (!pl) { toast.error("Vælg hvilken flaske du tager"); return; }

    setBusy(true);
    try {
      await drink({
        data: {
          placementId: pl.id,
          wineId: wine.id,
          wineName: wine.name,
          logAction,
          requireSelfServe,
        },
      });
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["wines-all"] });
      toast.success(`${wine.name} er markeret som drukket`);
      setSelected(null);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    setSelected(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {wine.name}
            {wine.vintage ? ` ${wine.vintage}` : ""}
          </DialogTitle>
          <DialogDescription>
            {placements.length === 1
              ? "Bekræft at du tager flasken fra den viste placering."
              : `Vælg hvilken af de ${placements.length} flasker du tager.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Grafisk visning af placeringer */}
          <WinePlacementView wine={wine} allWines={allWines} layout={layout} />
          <WineFridgeLegend />

          {/* Vælg specifik placering hvis der er flere */}
          {placements.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Hvilken flaske tager du?</p>
              <div className="flex flex-col gap-2">
                {placements.map((p) => {
                  const isChosen = selected?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                        isChosen
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      Hylde {p.shelf} — {depthLabel(p.depth)}, plads {p.slot}
                      {p.layer === 2 ? ", øverste lag" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            Annullér
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || (placements.length > 1 && !selected)}
          >
            {busy ? "Registrerer…" : "Bekræft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
