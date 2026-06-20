import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CocktailWithDetails } from "@/lib/cocktails.functions";
import { Wine } from "lucide-react";
import { RatingStars } from "@/components/app/rating-stars";

function fmt(amount: number | null, unit: string | null) {
  if (amount == null) return unit ?? "";
  const a = Number(amount);
  const n = Number.isInteger(a) ? a.toString() : a.toString();
  return unit ? `${n} ${unit}` : n;
}

export function CocktailCard({ cocktail }: { cocktail: CocktailWithDetails }) {
  const missing = cocktail.missing.length;
  return (
    <Card className="overflow-hidden border-border/70 bg-card">
      <div className="aspect-[4/3] w-full bg-muted">
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
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-xl leading-tight">{cocktail.name}</h3>
          {missing === 0 ? (
            <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Klar</Badge>
          ) : (
            <Badge variant="secondary">
              Mangler {missing}
            </Badge>
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
              <span className="tabular-nums">{fmt(i.amount, i.unit)}</span>
            </li>
          ))}
        </ul>
        {missing > 0 && (
          <p className="text-xs text-accent">
            Mangler: {cocktail.missing.join(", ")}
          </p>
        )}
        {(cocktail.glass || cocktail.garnish) && (
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
        {cocktail.instructions && (
          <p className="whitespace-pre-line border-t border-border pt-2 text-sm text-foreground/80">
            {cocktail.instructions}
          </p>
        )}
      </div>
    </Card>
  );
}