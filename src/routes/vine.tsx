import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Wine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GuestHeader } from "@/components/app/guest-header";
import { OrderButton } from "@/components/app/order-button";
import { CardImage } from "@/components/app/card-image";
import { WinePlacementView, WineFridgeLegend } from "@/components/app/wine-fridge";
import { DrinkWineDialog } from "@/components/app/drink-wine-dialog";
import {
  listWines, getWineFridgeLayout, getWineSelfServe,
  WINE_TYPE_ORDER, DEFAULT_WINE_FRIDGE_LAYOUT,
  type WineWithDetails, type WineFridgeLayout,
} from "@/lib/wines.functions";
import { getOrderingEnabled } from "@/lib/orders.functions";
import { thumbUrl } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vine")({
  head: () => ({
    meta: [
      { title: "Vine — Aston's Bar" },
      { name: "description", content: "Vores vinlager — se hvad der er på køl." },
    ],
  }),
  loader: async ({ context }) => {
    const [wines, layout] = await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["wines"], queryFn: () => listWines() }),
      context.queryClient.ensureQueryData({ queryKey: ["wine-fridge-layout"], queryFn: () => getWineFridgeLayout() }),
    ]);
    return { wines, layout };
  },
  component: VinePage,
});

function formatAbv(abv: number | null): string {
  if (abv === null) return "";
  return abv.toFixed(1).replace(".", ",") + " %";
}
function formatDrinkWindow(from: number | null, to: number | null): string {
  if (!from && !to) return "";
  if (from && to) return `${from}–${to}`;
  if (from) return `fra ${from}`;
  return `til ${to}`;
}

// ── Vinkortet ────────────────────────────────────────────────────────────────
function WineCard({ wine, onOpen, orderingEnabled, selfServe, onDrink }: {
  wine: WineWithDetails;
  onOpen: () => void;
  orderingEnabled: boolean;
  selfServe: boolean;
  onDrink: () => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden border-border/70 bg-card transition hover:border-primary/50">
      <div className="relative aspect-[4/3] w-full shrink-0 cursor-pointer bg-muted" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
        {wine.image_url ? (
          <CardImage src={thumbUrl(wine.image_url, 480) ?? wine.image_url} alt={wine.name} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Wine className="h-12 w-12 opacity-20" />
            <span className="text-xs">Billede mangler</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex cursor-pointer items-start justify-between gap-2" onClick={onOpen}>
          <div className="min-w-0">
            <h3 className="font-serif text-xl leading-tight">
              {wine.name}
              {wine.vintage && <span className="ml-1.5 text-base font-normal text-muted-foreground">{wine.vintage}</span>}
            </h3>
            {wine.producer && <p className="text-sm text-muted-foreground">{wine.producer}</p>}
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">{wine.wine_type}</Badge>
        </div>
        {(wine.country || wine.region) && (
          <p className="cursor-pointer text-sm text-muted-foreground" onClick={onOpen}>{[wine.region, wine.country].filter(Boolean).join(", ")}</p>
        )}
        {wine.grapes && <p className="cursor-pointer text-sm text-muted-foreground" onClick={onOpen}>{wine.grapes}</p>}
        <p className="text-xs text-muted-foreground">{wine.quantity} {wine.quantity === 1 ? "flaske" : "flasker"} på køl</p>
      </div>
      <div className="mt-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {selfServe ? (
          <Button className="w-full" size="sm" variant="outline" onClick={onDrink}>
            Drik
          </Button>
        ) : orderingEnabled ? (
          <OrderButton kind="wine" wineId={wine.id} cocktailName={wine.name} />
        ) : null}
      </div>
    </Card>
  );
}

// ── Detaljedialog-indhold ───────────────────────────────────────────────────
function WineDetailCard({ wine, layout, allWines, orderingEnabled, selfServe, onDrink }: {
  wine: WineWithDetails;
  layout: WineFridgeLayout;
  allWines: WineWithDetails[];
  orderingEnabled: boolean;
  selfServe: boolean;
  onDrink: () => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden border-border/70 bg-card">
      {wine.image_url && (
        <div className="aspect-[4/3] w-full shrink-0 bg-muted">
          <CardImage src={wine.image_url} alt={wine.name} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-5 p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-serif text-2xl leading-tight">
              {wine.name}
              {wine.vintage && <span className="ml-2 text-xl font-normal text-muted-foreground">{wine.vintage}</span>}
            </h2>
            <Badge variant="outline">{wine.wine_type}</Badge>
          </div>
          {wine.producer && <p className="mt-1 text-base text-muted-foreground">{wine.producer}</p>}
          <p className="mt-0.5 text-sm text-muted-foreground">{wine.quantity} {wine.quantity === 1 ? "flaske" : "flasker"} på køl</p>
        </div>
        {wine.description && <p className="text-sm text-foreground/80">{wine.description}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {wine.country && (<><dt className="text-muted-foreground">Land</dt><dd>{wine.country}</dd></>)}
          {wine.region && (<><dt className="text-muted-foreground">Område</dt><dd>{wine.region}</dd></>)}
          {wine.grapes && (<><dt className="text-muted-foreground">Druer</dt><dd>{wine.grapes}</dd></>)}
          {wine.abv !== null && (<><dt className="text-muted-foreground">Alkohol</dt><dd>{formatAbv(wine.abv)}</dd></>)}
          {wine.bottle_size_cl !== 75 && (<><dt className="text-muted-foreground">Flaskestørrelse</dt><dd>{wine.bottle_size_cl} cl</dd></>)}
          {(wine.drink_from || wine.drink_to) && (<><dt className="text-muted-foreground">Drikkevindue</dt><dd>{formatDrinkWindow(wine.drink_from, wine.drink_to)}</dd></>)}
          {wine.serving_temp && (<><dt className="text-muted-foreground">Serveringstemperatur</dt><dd>{wine.serving_temp}</dd></>)}
          {wine.food_pairing && (<><dt className="text-muted-foreground">Passer til</dt><dd>{wine.food_pairing}</dd></>)}
        </dl>
        {wine.tasting_notes && (
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mine smagsnoter</p>
            <p className="text-sm italic leading-relaxed text-foreground/80">{wine.tasting_notes}</p>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">I køleskabet</p>
          <WinePlacementView wine={wine} allWines={allWines} layout={layout} />
          {wine.placements.length > 0 && <WineFridgeLegend className="mt-2" />}
        </div>
        <div data-order-button onClick={(e) => e.stopPropagation()}>
          {selfServe ? (
            <Button className="w-full" onClick={onDrink}>Drik</Button>
          ) : orderingEnabled ? (
            <OrderButton kind="wine" wineId={wine.id} cocktailName={wine.name} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ── Sidans hoved-komponent ──────────────────────────────────────────────────
function VinePage() {
  const { wines: initialWines, layout: initialLayout } = Route.useLoaderData();

  const fetchWines = useServerFn(listWines);
  const { data: winesData } = useQuery({ queryKey: ["wines"], queryFn: () => fetchWines(), initialData: initialWines, staleTime: 1000 * 60 });

  const fetchLayout = useServerFn(getWineFridgeLayout);
  const { data: layoutData } = useQuery({ queryKey: ["wine-fridge-layout"], queryFn: () => fetchLayout(), initialData: initialLayout, staleTime: 1000 * 60 * 5 });

  const fetchOrdering = useServerFn(getOrderingEnabled);
  const { data: orderingData } = useQuery({ queryKey: ["ordering-enabled"], queryFn: () => fetchOrdering(), refetchInterval: 30_000, staleTime: 0 });

  const fetchSelfServe = useServerFn(getWineSelfServe);
  const { data: selfServeData } = useQuery({ queryKey: ["wine-self-serve"], queryFn: () => fetchSelfServe(), refetchInterval: 60_000, staleTime: 0 });

  const allWines = (winesData ?? []) as WineWithDetails[];
  const layout: WineFridgeLayout = (layoutData ?? DEFAULT_WINE_FRIDGE_LAYOUT) as WineFridgeLayout;
  const orderingEnabled = !!orderingData?.enabled;
  const selfServe = !!selfServeData?.enabled;

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drinkWine, setDrinkWine] = useState<WineWithDetails | null>(null);

  const searchPool = useMemo(() => {
    if (!q.trim()) return allWines;
    const s = q.trim().toLowerCase();
    return allWines.filter((w) =>
      w.name.toLowerCase().includes(s) ||
      (w.producer ?? "").toLowerCase().includes(s) ||
      (w.region ?? "").toLowerCase().includes(s) ||
      (w.grapes ?? "").toLowerCase().includes(s),
    );
  }, [allWines, q]);

  const countByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of searchPool) m.set(w.wine_type, (m.get(w.wine_type) ?? 0) + 1);
    return m;
  }, [searchPool]);

  const chipTypes = WINE_TYPE_ORDER.filter((t) => (countByType.get(t) ?? 0) > 0 || selectedTypes.includes(t));

  const matched = useMemo(() =>
    selectedTypes.length === 0 ? searchPool : searchPool.filter((w) => selectedTypes.includes(w.wine_type))
  , [searchPool, selectedTypes]);

  const groups = useMemo(() => {
    const showTypes = selectedTypes.length > 0 ? WINE_TYPE_ORDER.filter((t) => selectedTypes.includes(t)) : WINE_TYPE_ORDER;
    return showTypes
      .map((type) => ({ type, items: matched.filter((w) => w.wine_type === type).sort((a, b) => a.name.localeCompare(b.name, "da")) }))
      .filter((g) => g.items.length > 0);
  }, [matched, selectedTypes]);

  const openWine = allWines.find((w) => w.id === openId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <GuestHeader active="vine" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Vine</h1>
          {!selfServe && orderingEnabled && <p className="text-sm text-muted-foreground">Vælg en vin og tryk Bestil — bartenderen finder den frem.</p>}
          {selfServe && <p className="text-sm text-muted-foreground">Find din vin i køleskabet — tryk Drik for at registrere den.</p>}
        </div>

        <div className="mb-4">
          <Input placeholder="Søg efter navn, producent, område eller drue..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {chipTypes.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedTypes([])}>
              <Badge variant={selectedTypes.length === 0 ? "default" : "outline"} className={selectedTypes.length === 0 ? "bg-primary text-primary-foreground" : ""}>Alle</Badge>
            </button>
            {chipTypes.map((t) => {
              const active = selectedTypes.includes(t);
              return (
                <button key={t} type="button" onClick={() => setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}>
                  <Badge variant={active ? "default" : "outline"} className={active ? "bg-primary text-primary-foreground" : ""}>
                    {t} <span className={active ? "opacity-75" : "text-muted-foreground"}>({countByType.get(t) ?? 0})</span>
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {allWines.length === 0 ? (
          <p className="text-muted-foreground">Der er ingen vine i lageret lige nu.</p>
        ) : matched.length === 0 ? (
          <p className="text-muted-foreground">Ingen vine matcher din søgning.</p>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.type}>
                <h2 className="mb-3 font-serif text-xl text-primary">{g.type}</h2>
                <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((w) => (
                    <WineCard key={w.id} wine={w}
                      onOpen={() => setOpenId(w.id)}
                      orderingEnabled={orderingEnabled}
                      selfServe={selfServe}
                      onDrink={() => setDrinkWine(w)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Detaljedialog */}
        <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {openWine && (
                <>
                  <DialogPrimitive.Title className="sr-only">{openWine.name}</DialogPrimitive.Title>
                  <div className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                    onClick={(e) => { if ((e.target as HTMLElement).closest("[data-order-button]")) return; setOpenId(null); }}>
                    <WineDetailCard
                      wine={openWine} layout={layout} allWines={allWines}
                      orderingEnabled={orderingEnabled} selfServe={selfServe}
                      onDrink={() => { setOpenId(null); setDrinkWine(openWine); }}
                    />
                  </div>
                </>
              )}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>

        {/* Drik-dialog */}
        <DrinkWineDialog
          open={!!drinkWine} wine={drinkWine}
          allWines={allWines} layout={layout}
          requireSelfServe logAction="gæst-drukket"
          onClose={() => setDrinkWine(null)}
        />
      </main>
    </div>
  );
}
