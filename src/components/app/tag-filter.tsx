import { TAGS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export function TagFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TAGS.map((tag) => {
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