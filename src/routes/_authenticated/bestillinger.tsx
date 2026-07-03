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
import { Check, Trash2, RotateCcw, X } from "lucide-react";
import {
  deleteAllOrders,
  deleteOrder,
  listOrders,
  setOrderStatus,
  type OrderRow,
} from "@/lib/orders.functions";
import { logOrder } from "@/lib/stats.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/bestillinger")({
  head: () => ({ meta: [{ title: "Bestillinger — Aston's Bar" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const removeOrder = useServerFn(deleteOrder);
  const removeAll = useServerFn(deleteAllOrders);
  const writeLog = useServerFn(logOrder);
  const qc = useQueryClient();

  // Er realtime-kanalen aktiv? Når den er, kan vi nøjes med langsommere polling
  // som sikkerhedsnet (60 s). Falder realtime ud, går vi tilbage til 30 s.
  const [realtimeReady, setRealtimeReady] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: realtimeReady ? 60_000 : 30_000,
    refetchOnWindowFocus: true,
    // Bestillinger skal altid være friske — overstyrer det globale staleTime.
    staleTime: 0,
  });

  // ── Realtime: lyt efter ændringer på cocktail_orders ──────────────────────
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
          // CHANNEL_ERROR, TIMED_OUT, CLOSED → stol ikke på realtime; poll hyppigere.
          setRealtimeReady(false);
        }
      });

    return () => {
      setRealtimeReady(false);
      supabase.removeChannel(channel);
    };
  }, [qc]);

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

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const openOrder = (data ?? []).find((o) => o.id === openOrderId) ?? null;
  const openCocktail =
    openOrder && openOrder.kind !== "spirit"
      ? (cocktailsData ?? []).find((c: CocktailWithDetails) => c.id === openOrder.cocktail_id)
      : undefined;
  const openSpirit =
    openOrder && openOrder.kind === "spirit"
      ? (spiritsData ?? []).find((s: SpiritWithDetails) => s.id === openOrder.spirit_id)
      : undefined;

  function canOpen(o: OrderRow) {
    return o.kind === "spirit" ? !!o.spirit_id : !!o.cocktail_id;
  }

  function openCard(o: OrderRow) {
    if (!canOpen(o)) return;
    setOpenOrderId(o.id);
  }

  async function mark(id: string, status: "pending" | "done") {
    // Log til statistik når en bestilling markeres som færdig (flueben)
    if (status === "done") {
      const order = (data ?? []).find((o) => o.id === id);
      if (order) {
        try {
          await writeLog({
            data: {
              originalOrderId: order.id,
              kind: order.kind === "spirit" ? "spirit" : "cocktail",
              cocktailId: order.cocktail_id,
              spiritId: order.spirit_id,
              cocktailName: order.cocktail_name,
              customerName: order.customer_name,
              note: order.note,
              status: "done",
              loggedAt: order.created_at,
              quantity: order.quantity,
            },
          });
        } catch {
          // Log fejl er ikke kritisk — fortsæt med statusopdatering
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

  // Annuller en afventende ordre — sletter UDEN at logge til statistik
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
    if (!confirm("Slet ALLE bestillinger? Dette kan ikke fortrydes.")) return;
    try {
      await removeAll();
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Alle bestillinger er slettet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke slette");
    }
  }

  const orders = data ?? [];
  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 font-serif text-3xl">Bestillinger</h1>
            <p className="text-sm text-muted-foreground">
              Live oversigt over bestillinger fra menukortet.
            </p>
          </div>
          {(data?.length ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="mr-1 h-4 w-4" />
              Slet alle
            </Button>
          )}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : error ? (
          <p className="text-destructive">{(error as Error).message}</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 font-serif text-xl">
                Afventer{" "}
                <Badge className="ml-1 bg-primary/20 text-primary hover:bg-primary/20">
                  {pending.length}
                </Badge>
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
      <Dialog open={!!openOrder} onOpenChange={(o) => !o && setOpenOrderId(null)}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {openSpirit ? (
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

type OrderItemProps = {
  order: {
    id: string;
    kind: string;
    cocktail_id: string | null;
    spirit_id: string | null;
    cocktail_name: string;
    customer_name: string;
    note: string | null;
    created_at: string;
    quantity: number;
  };
  done?: boolean;
  onDone?: () => void;
  onCancel?: () => void; // Annuller — kun på pending, logger IKKE til statistik
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
              <Button size="sm" variant="ghost" onClick={onReopen} aria-label="Genåbn">
                <RotateCcw className="h-4 w-4" />
              </Button>
              {onDelete && (
                <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Slet">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              {onDone && (
                <Button size="sm" variant="ghost" onClick={onDone} aria-label="Markér færdig">
                  <Check className="h-4 w-4" />
                </Button>
              )}
              {onCancel && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  aria-label="Annuller bestilling"
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
