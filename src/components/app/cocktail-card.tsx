import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CocktailWithDetails } from "@/lib/cocktails.functions";
import { Wine } from "lucide-react";
import { RatingStars } from "@/components/app/rating-stars";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PRESETS = [1, 2, 3, 4];
const MAX_MULTIPLIER = 99;

function fmt(amount: number | null, unit: string | null, multiplier = 1) {
  if (amount == null) return unit ?? "";
  // Afrund til 3 decimaler for at undgå flydende-komma-støj, fjern så nuller.
  const scaled = Number((Number(amount) * multiplier).toFixed(3));
  // Brug komma som decimaltegn i visningen
  const n = Number.isInteger(scaled) ? scaled.toString() : scaled.toString().replace(".", ",");
  return unit ? `${n} ${unit}` : n;
}

export function CocktailCard({
  cocktail,
  showAvailabilityBadge = true,
  compact = false,
  footerSlot,
  onClick,
  showMultiplier = false,
  initialMultiplier = 1,
}: {
  cocktail: CocktailWithDetails;
  showAvailabilityBadge?: boolean;
  compact?: boolean;
  footerSlot?: ReactNode;
  onClick?: () => void;
  /** Vis 1×/2×/3×/4×-vælger der skalerer ingrediensmængderne (kun bartender-visning) */
  showMultiplier?: boolean;
  /** Startværdi for multiplieren (fx antallet fra en bestilling) */
  initialMultiplier?: number;
}) {
  const safeInitial = Number.isFinite(initialMultiplier) && initialMultiplier >= 1 ? initialMultiplier : 1;
  const [multiplier, setMultiplier] = useState(safeInitial);
  const [customText, setCustomText] = useState(PRESETS.includes(safeInitial) ? "" : String(safeInitial));

  const missing = cocktail.missing.length;
  const clickable = !!onClick;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-border/70 bg-card",
        clickable && "cursor-pointer transition hover:border-primary/50",
      )}
    >
      <div
        className={cn("aspect-[4/3] w-full bg-muted", clickable && "cursor-pointer")}
        onClick={onClick}
        role={clickable ? "button" : undefined}
      >
        {cocktail.image_url ? (
          <img
            src={cocktail.image_url}
            alt={cocktail.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Wine className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div
          className={cn("flex items-start justify-between gap-2", clickable && "cursor-pointer")}
          onClick={onClick}
        >
          <h3 className="font-serif text-xl leading-tight">{cocktail.name}</h3>
          {showAvailabilityBadge && (
            missing === 0 ? (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Klar</Badge>
            ) : (
              <Badge variant="secondary">Mangler {missing}</Badge>
            )
          )}
        </div>
        {cocktail.description && (
          <p className="text-sm text-muted-foreground">{cocktail.description}</p>
        )}
        <RatingStars
          cocktailId={cocktail.id}
          avg={cocktail.avg_rating}
          count={cocktail.rating_count}
        />
        {cocktail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cocktail.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Multiplier — kun i bartender-visning (showMultiplier) */}
        {showMultiplier && !compact && (
          <div
            className="flex flex-wrap items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-medium text-muted-foreground">Antal:</span>
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setMultiplier(n);
                  setCustomText("");
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-sm transition",
                  multiplier === n && customText === ""
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                ×{n}
              </button>
            ))}
            <Input
              type="text"
              inputMode="numeric"
              value={customText}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setCustomText(raw);
                if (raw === "") {
                  setMultiplier(1);
                  return;
                }
                const v = parseInt(raw, 10);
                if (Number.isFinite(v) && v >= 1) setMultiplier(Math.min(v, MAX_MULTIPLIER));
              }}
              placeholder="Andet"
              aria-label="Andet antal"
              className="h-8 w-16"
            />
          </div>
        )}

        {compact ? (
          <p className="text-sm text-foreground/90">
            {cocktail.ingredients.map((i) => i.name).join(", ")}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {cocktail.ingredients.map((i) => (
              <li
                key={i.ingredient_id}
                className={
                  i.available
                    ? "flex justify-between text-foreground/90"
                    : "flex justify-between text-muted-foreground line-through"
                }
              >
                <span>{i.name}</span>
                <span className="tabular-nums">
                  {fmt(i.amount, i.unit, showMultiplier ? multiplier : 1)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {missing > 0 && (
          <p className="text-xs text-accent">
            Mangler: {cocktail.missing.join(", ")}
          </p>
        )}
        {!compact && (cocktail.glass || cocktail.garnish) && (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {cocktail.glass && (
              <div>
                <div className="font-medium text-foreground/70">Glas</div>
                <div>{cocktail.glass}</div>
              </div>
            )}
            {cocktail.garnish && (
              <div>
                <div className="font-medium text-foreground/70">Pynt</div>
                <div>{cocktail.garnish}</div>
              </div>
            )}
          </div>
        )}
        {!compact && cocktail.instructions && (
          <p className="whitespace-pre-line border-t border-border pt-2 text-sm text-foreground/80">
            {cocktail.instructions}
          </p>
        )}
        {footerSlot && <div className="mt-auto pt-1">{footerSlot}</div>}
      </div>
    </Card>
  );
}
