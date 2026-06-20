import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTags } from "@/lib/cocktails.functions";

export function TagFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const fetchTags = useServerFn(listTags);
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(tags ?? []).map((t) => {
        const tag = t.name;
        const active = selected.includes(tag);
        return (
          <button key={tag} type="button" onClick={() => onToggle(tag)}>
            <Badge
              variant={active ? "default" : "outline"}
              className={active ? "bg-primary text-primary-foreground" : ""}
            >
              {tag}
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