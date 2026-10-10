import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SiteHeader } from "@/components/app/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { CocktailCard } from "@/components/app/cocktail-card";
import { SpiritCard } from "@/components/app/spirit-card";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { listSpirits, type SpiritWithDetails } from "@/lib/spirits.functions";
import {
  listWines,
  getWineFridgeLayout,
  DEFAULT_WINE_FRIDGE_LAYOUT,
  type WineWithDetails,
  type WineFridgeLayout,
} from "@/lib/wines.functions";
import { WineFridge, WineFridgeLegend } from "@/components/app/wine-fridge";
import { CardImage } from "@/components/app/card-image";
import { Check, Trash2, RotateCcw, X, Wine } from "lucide-react";
import {
  deleteAllOrders,
  deleteOrder,
  listOrders,
  setOrderStatus,
  type OrderRow,
} from "@/lib/orders.functions";
import { logOrder, logOrdersBulk } from "@/lib/stats.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/bestillinger")({
  head: () => ({ meta: [{ title: "Bestillinger — Aston's Bar" }] }),
  component: OrdersPage,
});

// ── Minimalvist kort til vin-bestillinger i dialogen ─────────────────────
function WineOrderCard({
  wine,
  layout,
  allWines,
}: {
  wine: WineWithDetails;
  layout: WineFridgeLayout;
  allWines: WineWithDetails[];
}) {
  const isPlaced = wine.shelf !== null && wine.slot !== null;
  return (
    <Card className="flex flex-col overflow-hidden border-border/70 bg-card">
      {wine.image_url && (
        <div className="aspect-[4/3] w-full shrink-0 bg-muted">
          <CardImage src={wine.image_url} alt={wine.name} />
        </div>
      )}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-serif text-2xl">
            {wine.name}
            {wine.vintage && (
              <span className="ml-2 text-xl font-normal text-muted-foreground">{wine.vintage}</span>
            )}
          </h2>
          {wine.producer && <p className="text-sm text-muted-foreground">{wine.producer}</p>}
          <Badge variant="outline" className="mt-1 text-xs">{wine.wine_type}</Badge>
        </div>
        {wine.tasting_notes && (
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mine smagsnoter
            </p>
            <p className="text-sm italic text-foreground/80 leading-relaxed">{wine.tasting_notes}</p>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            I køleskabet
          </p>
          {isPlaced ? (
            <div className="space-y-2">
              <WineFridge mode="gæst" wines={allWines} layout={layout} highlightWineId={wine.id} />
              <WineFridgeLegend />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ikke placeret endnu.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Én bestillingsrække ───────────────────────────────────────────────────
type OrderItemProps = {
  order: OrderRow;
  done?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  onReopen?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
};

function OrderItem({ order, done, onDone, onCancel, onReopen, onDelete, onOpen }: OrderItemProps) {
  const time = new Date(order.created_at).toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const isSpirit = order.kind === "spirit";
  const isWine = order.kind === "wine";

  return (
    <Card
      className={`p-3 ${done ? "opacity-70" : ""} ${onOpen ? "cursor-pointer" : ""}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-lg">{order.cocktail_name}</span>
            {isSpirit && (
              <Badge variant="outline" className="text-xs">
                Spiritus
              </Badge>
            )}
            {isWine && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Wine className="h-3 w-3" />
                Vin
              </Badge>
            )}
            {order.quantity > 1 && (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/20">
                ×{order.quantity}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">til {order.customer_name}</span>
          </div>
          {order.note && <p className="mt-1 text-sm text-foreground/80">"{order.note}"</p>}
          <p className="mt-1 text-xs text-muted-foreground">{time}</p>
        </div>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          {done ? (
            <>
              {onReopen && (
                <Button size="icon" variant="ghost" onClick={onReopen} aria-label="Genåbn">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Slet">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              {onCancel && (
                <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Annuller">
                  <X className="h-4 w-4" />
                </Button>
              )}
              {onDone && (
                <Button size="icon" variant="ghost" onClick={onDone} aria-label="Markér færdig">
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Siden ─────────────────────────────────────────────────────────────────
function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const removeOrder = useServerFn(deleteOrder);
  const removeAll = useServerFn(deleteAllOrders);
  const writeLog = useServerFn(logOrder);
  const writeBulkLog = useServerFn(logOrdersBulk);
  const qc = useQueryClient();

  const [realtimeReady, setRealtimeReady] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: realtimeReady ? 60_000 : 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // ── Realtime: lyt efter ændringer på cocktail_orders ──────────────────
  useEffect(() => {
    const channel = supabase
      .channel("cocktail_orders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeReady(true);
          qc.invalidateQueries({ queryKey: ["orders"] });
        } else {
          setRealtimeReady(false);
        }
      });

    return () => {
      setRealtimeReady(false);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Data til detaljedialog
  const fetchCocktails = useServerFn(listCocktails);
  const { data: cocktailsData } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const fetchSpirits = useServerFn(listSpirits);
  const { data: spiritsData } = useQuery({
    queryKey: ["spirits"],
    queryFn: () => fetchSpirits(),
  });
  const fetchWines = useServerFn(listWines);
  const { data: winesData } = useQuery({
    queryKey: ["wines"],
    queryFn: () => fetchWines(),
  });
  const fetchLayout = useServerFn(getWineFridgeLayout);
  const { data: layoutData } = useQuery({
    queryKey: ["wine-fridge-layout"],
    queryFn: () => fetchLayout(),
  });

  const allWines = (winesData ?? []) as WineWithDetails[];
  const layout: WineFridgeLayout = (layoutData ?? DEFAULT_WINE_FRIDGE_LAYOUT) as WineFridgeLayout;

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const openOrder = (data ?? []).find((o) => o.id === openOrderId) ?? null;

  const openCocktail =
    openOrder && openOrder.kind === "cocktail"
      ? (cocktailsData ?? []).find((c: CocktailWithDetails) => c.id === openOrder.cocktail_id)
      : undefined;
  const openSpirit =
    openOrder && openOrder.kind === "spirit"
      ? (spiritsData ?? []).find((s: SpiritWithDetails) => s.id === openOrder.spirit_id)
      : undefined;
  const openWine =
    openOrder && openOrder.kind === "wine"
      ? allWines.find((w) => w.id === openOrder.wine_id)
      : undefined;

  function canOpen(o: OrderRow) {
    if (o.kind === "spirit") return !!o.spirit_id;
    if (o.kind === "wine") return !!o.wine_id;
    return !!o.cocktail_id;
  }

  function openCard(o: OrderRow) {
    if (!canOpen(o)) return;
    setOpenOrderId(o.id);
  }

  async function mark(id: string, status: "pending" | "done") {
    if (status === "done") {
      const order = (data ?? []).find((o) => o.id === id);
      if (order) {
        try {
          await writeLog({
            data: {
              originalOrderId: order.id,
              kind: (order.kind === "spirit" || order.kind === "wine")
                ? order.kind
                : "cocktail",
              cocktailId: order.cocktail_id,
              spiritId: order.spirit_id,
              wineId: order.wine_id,
              cocktailName: order.cocktail_name,
              customerName: order.customer_name,
              note: order.note,
              status: "done",
              loggedAt: order.created_at,
              quantity: order.quantity,
            },
          });
        } catch {
          // Log-fejl er ikke kritisk — fortsæt med statusopdatering
        }
      }
    }
    try {
      await updateStatus({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opdatere");
    }
  }

  async function cancel(id: string) {
    if (!confirm("Annuller denne bestilling?")) return;
    try {
      await removeOrder({ data: { id } });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Bestilling annulleret");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke annullere");
    }
  }

  async function remove(id: string) {
    if (!confirm("Slet denne bestilling?")) return;
    try {
      await removeOrder({ data: { id } });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke slette");
    }
  }

  async function clearAll() {
    if (!confirm("Slet alle bestillinger? Dette kan ikke fortrydes.")) return;
    const orders = data ?? [];
    if (orders.length > 0) {
      try {
        await writeBulkLog({
          data: {
            orders: orders.map((o) => ({
              originalOrderId: o.id,
              kind: (o.kind === "spirit" || o.kind === "wine") ? o.kind : "cocktail",
              cocktailId: o.cocktail_id,
              spiritId: o.spirit_id,
              wineId: o.wine_id,
              cocktailName: o.cocktail_name,
              customerName: o.customer_name,
              note: o.note,
              status: o.status,
              loggedAt: o.created_at,
              quantity: o.quantity,
            })),
          },
        });
      } catch {
        // Log-fejl er ikke kritisk
      }
    }
    try {
      await removeAll();
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Alle bestillinger slettet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke slette alle");
    }
  }

  const pending = (data ?? []).filter((o) => o.status === "pending");
  const done = (data ?? []).filter((o) => o.status === "done");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl">Bestillinger</h1>
          {(data ?? []).length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="mr-1 h-4 w-4" />
              Ryd alle
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : error ? (
          <p className="text-destructive">Kunne ikke hente bestillinger.</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 font-serif text-xl">
                Afventende
                {pending.length > 0 && (
                  <span className="ml-2 text-base text-muted-foreground">({pending.length})</span>
                )}
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen nye bestillinger.</p>
              ) : (
                <ul className="space-y-2">
                  {pending.map((o) => (
                    <OrderItem
                      key={o.id}
                      order={o}
                      onDone={() => mark(o.id, "done")}
                      onCancel={() => cancel(o.id)}
                      onOpen={canOpen(o) ? () => openCard(o) : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
            {done.length > 0 && (
              <section>
                <h2 className="mb-2 font-serif text-xl text-muted-foreground">Færdige</h2>
                <ul className="space-y-2">
                  {done.map((o) => (
                    <OrderItem
                      key={o.id}
                      order={o}
                      done
                      onReopen={() => mark(o.id, "pending")}
                      onDelete={() => remove(o.id)}
                      onOpen={canOpen(o) ? () => openCard(o) : undefined}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Detaljedialog */}
      <Dialog open={!!openOrder} onOpenChange={(o) => !o && setOpenOrderId(null)}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {openWine ? (
              <>
                <DialogPrimitive.Title className="sr-only">
                  {openWine.name}
                </DialogPrimitive.Title>
                <div
                  className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                  onClick={() => setOpenOrderId(null)}
                >
                  <WineOrderCard wine={openWine} layout={layout} allWines={allWines} />
                </div>
              </>
            ) : openSpirit ? (
              <>
                <DialogPrimitive.Title className="sr-only">
                  {openSpirit.name}
                </DialogPrimitive.Title>
                <div
                  className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                  onClick={() => setOpenOrderId(null)}
                >
                  <SpiritCard spirit={openSpirit} />
                </div>
              </>
            ) : openCocktail ? (
              <>
                <DialogPrimitive.Title className="sr-only">
                  {openCocktail.name}
                </DialogPrimitive.Title>
                <div
                  className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                  onClick={() => setOpenOrderId(null)}
                >
                  <CocktailCard
                    key={`${openOrder?.id}-${openOrder?.quantity}`}
                    cocktail={openCocktail}
                    showAvailabilityBadge={false}
                    showMultiplier
                    initialMultiplier={openOrder?.quantity ?? 1}
                  />
                </div>
              </>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
