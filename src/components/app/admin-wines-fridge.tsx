/**
 * AdminWinesFridge — indstillinger for vinkøleskabet.
 * Sub-fane under "Vine" i admin.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllWines,
  getWineFridgeLayout,
  getWineSelfServe,
  DEFAULT_WINE_FRIDGE_LAYOUT,
  type WineWithDetails,
  type WineFridgeLayout,
} from "@/lib/wines.functions";
import { saveWineFridgeLayout, setWineSelfServe } from "@/lib/wines-admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";
import { WineFridge, WineFridgeLegend } from "@/components/app/wine-fridge";

const MAX_SHELVES = 15;
const MAX_SLOTS = 20;

export function AdminWinesFridge() {
  const qc = useQueryClient();
  const fetchWines = useServerFn(listAllWines);
  const fetchLayout = useServerFn(getWineFridgeLayout);
  const fetchSelfServe = useServerFn(getWineSelfServe);
  const saveFridge = useServerFn(saveWineFridgeLayout);
  const setSelfServe = useServerFn(setWineSelfServe);

  const { data: winesData } = useQuery({ queryKey: ["wines-all"], queryFn: () => fetchWines() });
  const { data: layoutData } = useQuery({ queryKey: ["wine-fridge-layout"], queryFn: () => fetchLayout() });
  const { data: selfServeData } = useQuery({ queryKey: ["wine-self-serve"], queryFn: () => fetchSelfServe() });

  const allWines = (winesData ?? []) as WineWithDetails[];
  const serverLayout: WineFridgeLayout = layoutData ?? DEFAULT_WINE_FRIDGE_LAYOUT;
  const selfServeEnabled = selfServeData?.enabled ?? false;

  const [draft, setDraft] = useState<WineFridgeLayout>(serverLayout);
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => { setDraft(serverLayout); }, [layoutData]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(serverLayout);

  const selfServeM = useMutation({
    mutationFn: (enabled: boolean) => setSelfServe({ data: { enabled } }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["wine-self-serve"] });
      toast.success(enabled ? "Gæster kan nu selv markere vine som drukket" : "Selv-betjening er slået fra");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fejl"),
  });

  function addShelf() {
    if (draft.shelves.length >= MAX_SHELVES) return;
    const last = draft.shelves[draft.shelves.length - 1] ?? { slotsForrest: 5, slotsBagerst: 5 };
    setDraft({ shelves: [...draft.shelves, { slotsForrest: last.slotsForrest, slotsBagerst: last.slotsBagerst }] });
  }

  function removeShelf() {
    if (draft.shelves.length <= 1) return;
    setDraft({ shelves: draft.shelves.slice(0, -1) });
  }

  function changeSlots(index: number, field: "slotsForrest" | "slotsBagerst", delta: number) {
    setDraft({
      shelves: draft.shelves.map((s, i) =>
        i !== index ? s : { ...s, [field]: Math.min(MAX_SLOTS, Math.max(1, s[field] + delta)) },
      ),
    });
  }

  async function handleSaveLayout() {
    setSavingLayout(true);
    try {
      const result = await saveFridge({ data: draft });
      qc.invalidateQueries({ queryKey: ["wine-fridge-layout"] });
      qc.invalidateQueries({ queryKey: ["wines-all"] });
      qc.invalidateQueries({ queryKey: ["wines"] });
      if (result.affectedWines.length > 0) {
        toast.warning(`Layout gemt. Disse vine mistede placeringer: ${result.affectedWines.join(", ")}`);
      } else {
        toast.success("Køleskabets layout er gemt");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSavingLayout(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Self-serve toggle */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Gæster kan selv markere vin som drukket</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Når dette er slået til, vises en "Drik"-knap på vinkortet i stedet for bestillingsknappen.
              Gæsten ser køleskabsplaceringen og bekræfter at de tager flasken.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={selfServeEnabled}
            onClick={() => selfServeM.mutate(!selfServeEnabled)}
            disabled={selfServeM.isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selfServeEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                selfServeEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Layout-editor */}
      <Card className="space-y-4 p-4">
        <div>
          <p className="font-medium">Køleskabslayout</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Justér antal hylder og pladser pr. hylde. Vine der falder udenfor det nye layout mister deres placering.
          </p>
        </div>

        <div className="space-y-3">
          {draft.shelves.map((shelf, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Hylde {i + 1}</p>
              <div className="space-y-2">
                {(["forrest", "bagerst"] as const).map((side) => {
                  const field = side === "forrest" ? "slotsForrest" : "slotsBagerst";
                  const val = shelf[field];
                  return (
                    <div key={side} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground capitalize">{side}</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                          onClick={() => changeSlots(i, field, -1)} disabled={val <= 1}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-16 text-center text-sm tabular-nums">
                          {val} {val === 1 ? "plads" : "pladser"}
                        </span>
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7"
                          onClick={() => changeSlots(i, field, 1)} disabled={val >= MAX_SLOTS}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addShelf} disabled={draft.shelves.length >= MAX_SHELVES}>
            <Plus className="mr-1 h-4 w-4" /> Tilføj hylde
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={removeShelf} disabled={draft.shelves.length <= 1}>
            <Minus className="mr-1 h-4 w-4" /> Fjern nederste hylde
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Forhåndsvisning</Label>
          <WineFridge mode="gæst" wines={allWines} layout={draft} selectedPositions={[]} />
          <WineFridgeLegend />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSaveLayout} disabled={savingLayout || !dirty}>
            {savingLayout ? "Gemmer…" : "Gem layout"}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(serverLayout)} disabled={savingLayout}>
              Fortryd ændringer
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
