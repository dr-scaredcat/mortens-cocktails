import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyRatings, rateCocktail } from "@/lib/cocktails.functions";
import { useRaterId } from "@/hooks/use-rater-id";
import { toast } from "sonner";

export function RatingStars({
  cocktailId,
  avg,
  count,
}: {
  cocktailId: string;
  avg: number | null;
  count: number;
}) {
  const raterId = useRaterId();
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyRatings);
  const rate = useServerFn(rateCocktail);
  const [hover, setHover] = useState(0);

  const { data: mine } = useQuery({
    queryKey: ["my-ratings", raterId],
    queryFn: () => fetchMine({ data: { raterId: raterId! } }),
    enabled: !!raterId,
  });
  const myRating = mine?.find((r) => r.cocktail_id === cocktailId)?.rating ?? 0;

  const m = useMutation({
    mutationFn: (rating: number) =>
      rate({ data: { cocktailId, raterId: raterId!, rating } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      qc.invalidateQueries({ queryKey: ["my-ratings", raterId] });
      toast.success("Tak for din vurdering");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const display = hover || myRating;

  return (
    <div className="flex items-center gap-2">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} stjerner`}
              disabled={!raterId || m.isPending}
              onMouseEnter={() => setHover(n)}
              onClick={() => m.mutate(n)}
              className="p-0.5 transition-transform hover:scale-110 disabled:opacity-60"
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  filled
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {avg != null ? `${avg.toFixed(1)} (${count})` : "Ingen vurderinger"}
      </span>
    </div>
  );
}