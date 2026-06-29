import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTags } from "@/lib/cocktails.functions";

export function TagFilter({
  selected,
  onToggle,
  onClear,
  tagCounts,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  /** Valgfri: antal elementer pr. tag i den nuværende filtrerede liste */
  tagCounts?: Map<string, number>;
}) {
  const fetchTags = useServerFn(listTags);
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(tags ?? []).map((t) => {
        const tag = t.name;
        const active = selected.includes(tag);
        const count = tagCounts?.get(tag) ?? null;
        return (
          <button key={tag} type="button" onClick={() => onToggle(tag)}>
            <Badge
              variant={active ? "default" : "outline"}
              className={active ? "bg-primary text-primary-foreground" : ""}
            >
              {tag}
              {tagCounts !== undefined && (
                <span className={active ? "ml-1 opacity-75" : "ml-1 text-muted-foreground"}>
                  {count ?? 0}
                </span>
              )}
            </Badge>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ryd
        </button>
      )}
    </div>
  );
}
