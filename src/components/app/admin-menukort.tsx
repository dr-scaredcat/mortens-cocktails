import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { setCocktailsOnMenu } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function AdminMenukort() {
  const qc = useQueryClient();
  const fetchCocktails = useServerFn(listCocktails);
  const setOnMenu = useServerFn(setCocktailsOnMenu);

  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });

  const available = useMemo(
    () =>
      ((data ?? []) as CocktailWithDetails[])
        .filter((c) => c.missing.length === 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  const mut = useMutation({
    mutationFn: (payload: { ids: string[]; onMenu: boolean }) =>
      setOnMenu({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string, onMenu: boolean) {
    mut.mutate({ ids: [id], onMenu });
  }
  function selectAll() {
    const ids = available.filter((c) => !c.on_menu).map((c) => c.id);
    if (ids.length === 0) return;
    mut.mutate({ ids, onMenu: true });
  }
  function deselectAll() {
    const ids = available.filter((c) => c.on_menu).map((c) => c.id);
    if (ids.length === 0) return;
    mut.mutate({ ids, onMenu: false });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vælg hvilke af de mulige cocktails der vises for gæsterne på menukortet.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} disabled={mut.isPending}>
          Vælg alle
        </Button>
        <Button variant="outline" size="sm" onClick={deselectAll} disabled={mut.isPending}>
          Fravælg alle
        </Button>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Indlæser...</p>
      ) : available.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Ingen cocktails kan laves lige nu.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {available.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <Checkbox
                id={`menu-${c.id}`}
                checked={c.on_menu}
                onCheckedChange={(v) => toggle(c.id, v === true)}
                disabled={mut.isPending}
              />
              <label htmlFor={`menu-${c.id}`} className="flex-1 cursor-pointer text-sm">
                {c.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}