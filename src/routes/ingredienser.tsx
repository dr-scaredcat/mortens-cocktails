import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { listIngredients } from "@/lib/cocktails.functions";
import { setIngredientAvailable } from "@/lib/admin.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/hooks/use-session";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";
import { CATEGORIES } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/ingredienser")({
  head: () => ({
    meta: [
      { title: "Ingredienser — Barskab" },
      { name: "description", content: "Marker hvilke ingredienser du har i barskabet." },
    ],
  }),
  component: IngredientsPage,
});

function IngredientsPage() {
  const qc = useQueryClient();
  const { session } = useSession();
  const fetchList = useServerFn(listIngredients);
  const checkAdmin = useServerFn(isAdminFn);
  const setAvail = useServerFn(setIngredientAvailable);

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => fetchList(),
  });
  const { data: admin } = useQuery({
    queryKey: ["isAdmin", session?.user.id ?? null],
    queryFn: () => checkAdmin(),
    enabled: !!session,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof ingredients>();
    for (const cat of CATEGORIES) map.set(cat, [] as any);
    for (const ing of ingredients ?? []) {
      const k = (map.has(ing.category) ? ing.category : "Andet") as string;
      (map.get(k) as any[]).push(ing);
    }
    return Array.from(map.entries()).filter(([, v]) => (v as any[]).length > 0);
  }, [ingredients]);

  const toggle = useMutation({
    mutationFn: (vars: { id: string; available: boolean }) =>
      setAvail({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["cocktails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canEdit = !!admin?.isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Ingredienser</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {canEdit
            ? "Marker hvad du har på lager. Ændringer slår igennem med det samme."
            : "Oversigt over ingredienser. Log ind som admin for at redigere lager."}
        </p>
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                {cat}
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {(items as any[]).map((ing) => (
                  <li key={ing.id} className="flex items-center justify-between px-4 py-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={ing.available}
                        disabled={!canEdit || toggle.isPending}
                        onCheckedChange={(v) =>
                          canEdit &&
                          toggle.mutate({ id: ing.id, available: !!v })
                        }
                      />
                      <span className={ing.available ? "" : "text-muted-foreground"}>
                        {ing.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {grouped.length === 0 && (
            <p className="text-muted-foreground">Ingen ingredienser endnu.</p>
          )}
        </div>
      </main>
    </div>
  );
}