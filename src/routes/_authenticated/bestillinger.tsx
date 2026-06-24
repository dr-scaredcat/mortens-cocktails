import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SiteHeader } from "@/components/app/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { CocktailCard } from "@/components/app/cocktail-card";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { Check, Trash2, RotateCcw } from "lucide-react";
import {
  deleteAllOrders,
  deleteOrder,
  listOrders,
  setOrderStatus,
} from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/bestillinger")({
  head: () => ({ meta: [{ title: "Bestillinger — Barskab" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const updateStatus = useServerFn(setOrderStatus);
  const removeOrder = useServerFn(deleteOrder);
  const removeAll = useServerFn(deleteAllOrders);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    refetchInterval: 10_000,
  });
  const fetchCocktails = useServerFn(listCocktails);
  const { data: cocktailsData } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const [openCocktailId, setOpenCocktailId] = useState<string | null>(null);
  const openCocktail = (cocktailsData ?? []).find(
    (c: CocktailWithDetails) => c.id === openCocktailId,
  );

  async function mark(id: string, status: "pending" | "done") {
    try {
      await updateStatus({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opdatere");
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
                      onDelete={() => remove(o.id)}
                      onOpen={
                        o.cocktail_id ? () => setOpenCocktailId(o.cocktail_id) : undefined
                      }
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
                      onOpen={
                        o.cocktail_id ? () => setOpenCocktailId(o.cocktail_id) : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
      <Dialog
        open={!!openCocktailId}
        onOpenChange={(o) => !o && setOpenCocktailId(null)}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {openCocktail ? (
              <>
                <DialogPrimitive.Title className="sr-only">
                  {openCocktail.name}
                </DialogPrimitive.Title>
                <div
                  className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                  onClick={() => setOpenCocktailId(null)}
                >
                  <CocktailCard cocktail={openCocktail} showAvailabilityBadge={false} />
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
    cocktail_id: string | null;
    cocktail_name: string;
    customer_name: string;
    note: string | null;
    created_at: string;
  };
  done?: boolean;
  onDone?: () => void;
  onReopen?: () => void;
  onDelete: () => void;
  onOpen?: () => void;
};

function OrderItem({ order, done, onDone, onReopen, onDelete, onOpen }: OrderItemProps) {
  const time = new Date(order.created_at).toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return (
    <Card
      className={`p-3 ${done ? "opacity-70" : ""} ${onOpen ? "cursor-pointer" : ""}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-serif text-lg">{order.cocktail_name}</span>
            <span className="text-sm text-muted-foreground">til {order.customer_name}</span>
          </div>
          {order.note && (
            <p className="mt-1 text-sm text-foreground/80">“{order.note}”</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{time}</p>
        </div>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          {done ? (
            <Button size="sm" variant="ghost" onClick={onReopen} aria-label="Genåbn">
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onDone} aria-label="Markér færdig">
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Slet">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}