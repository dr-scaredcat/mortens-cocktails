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
  getTextSize,
  DEFAULT_TEXT_SIZE,
  getLogoGap,
  DEFAULT_LOGO_GAP,
  getLogoAlign,
  DEFAULT_LOGO_ALIGN,
  getLogoType,
  DEFAULT_LOGO_TYPE,
} from "@/lib/orders.functions";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/menukort")({
  head: () => ({
    meta: [
      { title: "Aston's Bar - Menukort" },
      { name: "description", content: "Cocktails der kan laves lige nu." },
    ],
  }),
  component: MenukortPage,
});

type SortMode = "alpha" | "rating";

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

// ── Minimal header kun til gæster — ingen navigation ────────────────────────
function MenukortHeader() {
  const fetchSiteName = useServerFn(getSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const fetchTextSize = useServerFn(getTextSize);
  const fetchLogoGap = useServerFn(getLogoGap);
  const fetchLogoAlign = useServerFn(getLogoAlign);
  const fetchLogoType = useServerFn(getLogoType);

  const stale = { staleTime: 1000 * 60 * 5 };
  const { data: siteNameData } = useQuery({ queryKey: ["site-name"], queryFn: () => fetchSiteName(), ...stale });
  const { data: logoSizeData } = useQuery({ queryKey: ["logo-size"], queryFn: () => fetchLogoSize(), ...stale });
  const { data: textSizeData } = useQuery({ queryKey: ["text-size"], queryFn: () => fetchTextSize(), ...stale });
  const { data: logoGapData } = useQuery({ queryKey: ["logo-gap"], queryFn: () => fetchLogoGap(), ...stale });
  const { data: logoAlignData } = useQuery({ queryKey: ["logo-align"], queryFn: () => fetchLogoAlign(), ...stale });
  const { data: logoTypeData } = useQuery({ queryKey: ["logo-type"], queryFn: () => fetchLogoType(), ...stale });

  const siteName = siteNameData?.name ?? DEFAULT_SITE_NAME;
  const logoSize = logoSizeData?.size ?? DEFAULT_LOGO_SIZE;
  const textSize = textSizeData?.size ?? DEFAULT_TEXT_SIZE;
  const logoGap = logoGapData?.gap ?? DEFAULT_LOGO_GAP;
  const logoAlign = logoAlignData?.align ?? DEFAULT_LOGO_ALIGN;
  const logoType = logoTypeData?.type ?? DEFAULT_LOGO_TYPE;

  return (
    <header className="border-b border-border bg-background px-4 py-4">
      <div
        className={cn("flex mx-auto max-w-5xl", alignClass[logoAlign as keyof typeof alignClass] ?? "items-center")}
        style={{ gap: `${logoGap}px` }}
      >
        <SiteLogo size={logoSize} type={logoType} className="shrink-0 text-primary" />
        <span className="font-serif text-foreground" style={{ fontSize: `${textSize}px` }}>{siteName}</span>
      </div>
    </header>
  );
}

function ShareButton({ cocktail }: { cocktail: CocktailWithDetails }) {
  const [copied, setCopied] = useState(false);
  async function handleShare() {
    const text = `${cocktail.name}\n\n${cocktail.ingredients.map((i) => `${i.name}${i.amount ? ` – ${i.amount}${i.unit ? " " + i.unit : ""}` : ""}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere");
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleShare} data-share-button>
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
          <h1 className="font-serif text-3xl tracking-tight">Menukort</h1>
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
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "cocktail" : "cocktails"}
            </p>
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
          </>
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
