import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, ArrowDownAZ, Star, Share2, Check } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { CocktailCard } from "@/components/app/cocktail-card";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { OrderButton } from "@/components/app/order-button";
import {
  getOrderingEnabled,
  getSiteName,
  DEFAULT_SITE_NAME,
  getLogoSize,
  DEFAULT_LOGO_SIZE,
  getLogoType,
  DEFAULT_LOGO_TYPE,
} from "@/lib/orders.functions";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/menukort")({
  head: () => ({
    meta: [
      { title: "Cocktail menu — Barskab" },
      { name: "description", content: "Cocktails du kan lave lige nu." },
    ],
  }),
  component: MenukortPage,
});

type SortMode = "alpha" | "rating";

// ── Minimal header kun til gæster — ingen navigation ────────────────────────
function MenukortHeader() {
  const fetchSiteName = useServerFn(getSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const fetchLogoType = useServerFn(getLogoType);

  const { data: siteNameData } = useQuery({
    queryKey: ["site-name"],
    queryFn: () => fetchSiteName(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: logoSizeData } = useQuery({
    queryKey: ["logo-size"],
    queryFn: () => fetchLogoSize(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: logoTypeData } = useQuery({
    queryKey: ["logo-type"],
    queryFn: () => fetchLogoType(),
    staleTime: 1000 * 60 * 5,
  });

  const siteName = siteNameData?.name ?? DEFAULT_SITE_NAME;
  const logoSize = logoSizeData?.size ?? DEFAULT_LOGO_SIZE;
  const logoType = logoTypeData?.type ?? DEFAULT_LOGO_TYPE;
  const textSize = Math.round(logoSize / 2);

  return (
    <header className="border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 font-serif tracking-tight">
        <SiteLogo type={logoType} size={logoSize} className="shrink-0 text-primary" />
        <span className="leading-none" style={{ fontSize: textSize }}>
          {siteName}
        </span>
      </div>
    </header>
  );
}

// ── Share-knap komponent ─────────────────────────────────────────────────────
function ShareButton({ cocktail }: { cocktail: CocktailWithDetails }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const ingLines = cocktail.ingredients
      .map((i) => {
        const amt = i.amount != null ? `${i.amount}${i.unit ? ` ${i.unit}` : ""}` : i.unit ?? "";
        return amt ? `• ${amt} ${i.name}` : `• ${i.name}`;
      })
      .join("\n");

    const parts: string[] = [`🍹 ${cocktail.name}`];
    if (cocktail.description) parts.push(cocktail.description);
    parts.push("", "Ingredienser:", ingLines);
    if (cocktail.glass) parts.push("", `Glas: ${cocktail.glass}`);
    if (cocktail.garnish) parts.push(`Pynt: ${cocktail.garnish}`);
    if (cocktail.instructions) parts.push("", "Fremgangsmåde:", cocktail.instructions);

    const text = parts.join("\n");
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: cocktail.name, text, url });
        return;
      } catch {
        // fald tilbage til clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link kopieret til udklipsholderen");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere link");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        handleShare();
      }}
      className="gap-1.5"
      aria-label="Del opskrift"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Kopieret!" : "Del"}
    </Button>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function MenukortPage() {
  const fetchCocktails = useServerFn(listCocktails);
  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const fetchOrdering = useServerFn(getOrderingEnabled);
  const { data: orderingData } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchOrdering(),
    refetchInterval: 30_000,
  });
  const orderingEnabled = !!orderingData?.enabled;

  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");

  const filtered = useMemo(() => {
    const list = (data ?? []) as CocktailWithDetails[];
    let f = list.filter((c) => c.missing.length === 0 && c.on_menu !== false);
    if (tags.length > 0) f = f.filter((c) => tags.every((t) => c.tags.includes(t)));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      f = f.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.ingredients.some((i) => i.name.toLowerCase().includes(s)) ||
          c.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    if (sortMode === "rating") {
      return [...f].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    }
    return [...f].sort((a, b) => a.name.localeCompare(b.name, "da"));
  }, [data, tags, q, sortMode]);

  return (
    <div className="min-h-screen bg-background">
      <MenukortHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Cocktail menu</h1>
          {orderingEnabled && (
            <p className="text-sm text-muted-foreground">
              Vælg en cocktail og tryk Bestil — bartenderen får besked.
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="mb-5 w-full"
          onClick={() => {
            if (filtered.length === 0) return;
            const random = filtered[Math.floor(Math.random() * filtered.length)];
            setOpenId(random.id);
          }}
        >
          <Shuffle className="h-4 w-4" />
          Overrask mig
        </Button>

        <div className="mb-5 space-y-3">
          <Input
            placeholder="Søg efter navn eller ingrediens..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <TagFilter
            selected={tags}
            onToggle={(t) =>
              setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
            }
            onClear={() => setTags([])}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("alpha")}
              className={cn(sortMode === "alpha" && "border-primary/60 bg-primary/10 text-primary")}
            >
              <ArrowDownAZ className="mr-1 h-4 w-4" />
              A-Z
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("rating")}
              className={cn(sortMode === "rating" && "border-primary/60 bg-primary/10 text-primary")}
            >
              <Star className="mr-1 h-4 w-4" />
              Bedst vurderet
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            Ingen cocktails kan laves lige nu.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CocktailCard
                key={c.id}
                cocktail={c}
                showAvailabilityBadge={false}
                compact
                onClick={() => setOpenId(c.id)}
                footerSlot={
                  orderingEnabled ? (
                    <OrderButton cocktailId={c.id} cocktailName={c.name} />
                  ) : null
                }
              />
            ))}
          </div>
        )}

        <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {(() => {
                const c = filtered.find((x) => x.id === openId);
                if (!c) return null;
                return (
                  <>
                    <DialogPrimitive.Title className="sr-only">{c.name}</DialogPrimitive.Title>
                    <div
                      className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-order-button]")) return;
                        if ((e.target as HTMLElement).closest("[data-share-button]")) return;
                        setOpenId(null);
                      }}
                    >
                      <CocktailCard
                        cocktail={c}
                        showAvailabilityBadge={false}
                        footerSlot={
                          <div
                            className="flex flex-wrap gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div data-share-button>
                              <ShareButton cocktail={c} />
                            </div>
                            {orderingEnabled && (
                              <div data-order-button className="flex-1">
                                <OrderButton cocktailId={c.id} cocktailName={c.name} />
                              </div>
                            )}
                          </div>
                        }
                      />
                    </div>
                  </>
                );
              })()}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </main>
    </div>
  );
}
