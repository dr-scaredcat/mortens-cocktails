import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIngredients, listCategories, type IngredientRow } from "@/lib/cocktails.functions";
import {
  upsertIngredient,
  deleteIngredient,
  deleteUnusedIngredients,
  setIngredientAvailable,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Dialog: vælg hvilke ubrugte ingredienser der skal slettes ───────────────
function DeleteUnusedDialog({
  open,
  onOpenChange,
  unusedIngredients,
  categories,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unusedIngredients: IngredientRow[];
  categories: string[];
  onConfirm: (ids: string[]) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Nulstil valg når dialogen åbnes
  useEffect(() => {
    if (open) {
      setSelected(new Set(unusedIngredients.map((i) => i.id)));
    }
  }, [open, unusedIngredients]);

  const allSelected = selected.size === unusedIngredients.length && unusedIngredients.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unusedIngredients.map((i) => i.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Gruppér ubrugte ingredienser efter kategori
  const grouped = useMemo(() => {
    const map = new Map<string, IngredientRow[]>();
    for (const cat of categories) map.set(cat, []);
    if (!map.has("Andet")) map.set("Andet", []);
    for (const i of unusedIngredients) {
      const bucket = map.get(i.category) ?? map.get("Andet")!;
      bucket.push(i);
    }
    // Fjern tomme kategorier
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [unusedIngredients, categories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Slet ubrugte ingredienser</DialogTitle>
        </DialogHeader>

        {unusedIngredients.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ingen ubrugte ingredienser fundet.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Disse ingredienser indgår ikke i nogen cocktail. Markér dem du vil slette.
            </p>

            {/* Vælg alle */}
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <label htmlFor="select-all" className="cursor-pointer text-sm font-medium">
                Vælg alle ({unusedIngredients.length})
              </label>
            </div>

            {/* Grupperet liste */}
            <div className="space-y-4">
              {grouped.map(([cat, items]) => (
                <section key={cat}>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    {cat}
                  </h4>
                  <ul className="space-y-1">
                    {items.map((ing) => (
                      <li key={ing.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`del-ing-${ing.id}`}
                          checked={selected.has(ing.id)}
                          onCheckedChange={() => toggle(ing.id)}
                        />
                        <label
                          htmlFor={`del-ing-${ing.id}`}
                          className="cursor-pointer text-sm"
                        >
                          {ing.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          {unusedIngredients.length > 0 && (
            <Button
              variant="destructive"
              disabled={selected.size === 0 || isPending}
              onClick={() => onConfirm(Array.from(selected))}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {isPending
                ? "Sletter…"
                : selected.size === unusedIngredients.length
                  ? "Slet alle"
                  : `Slet (${selected.size})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminIngredients() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listIngredients);
  const fetchCats = useServerFn(listCategories);
  const upsert = useServerFn(upsertIngredient);
  const del = useServerFn(deleteIngredient);
  const delUnused = useServerFn(deleteUnusedIngredients);
  const setAvail = useServerFn(setIngredientAvailable);

  const { data } = useQuery({ queryKey: ["ingredients"], queryFn: () => fetchList() });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });
  const catNames = (categories ?? []).map((c) => c.name);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [deleteUnusedOpen, setDeleteUnusedOpen] = useState(false);

  useEffect(() => {
    if (!category && catNames.length > 0) setCategory(catNames[0]);
  }, [category, catNames]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ingredients"] });
    qc.invalidateQueries({ queryKey: ["cocktails"] });
  };

  const addM = useMutation({
    mutationFn: (v: { name: string; category: string }) =>
      upsert({ data: { name: v.name, category: v.category, available: false } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Ingrediens tilføjet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editM = useMutation({
    mutationFn: (v: { id: string; name: string; category: string; available: boolean }) =>
      upsert({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Slet specifikt udvalgte ubrugte ingredienser én ad gangen
  const delSelectedUnusedM = useMutation({
    mutationFn: async (ids: string[]) => {
      let deleted = 0;
      for (const id of ids) {
        await del({ data: { id } });
        deleted++;
      }
      return { deleted };
    },
    onSuccess: (res) => {
      invalidate();
      setDeleteUnusedOpen(false);
      toast.success(
        res.deleted === 0
          ? "Ingen ingredienser slettet"
          : `${res.deleted} ingrediens${res.deleted === 1 ? "" : "er"} slettet`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availM = useMutation({
    mutationFn: (v: { id: string; available: boolean }) => setAvail({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, IngredientRow[]>();
    for (const c of catNames) map.set(c, []);
    if (!map.has("Andet")) map.set("Andet", []);
    for (const i of data ?? []) (map.get(i.category) ?? map.get("Andet")!).push(i);
    return Array.from(map.entries());
  }, [data, categories]);

  // Find alle ubrugte ingredienser (dem der ikke er knyttet til nogen cocktail)
  // Vi bruger det faktum at deleteUnusedIngredients returnerer antallet —
  // men vi har ikke listen. Vi finder dem via cocktail-data i cache eller
  // viser alle ingredienser og lader serveren afvise dem der er i brug.
  // Enklere: hent fra query-cache hvilke ingredient_ids der bruges i cocktails,
  // og filtrér ingredienslisten.
  const unusedIngredients = useMemo(() => {
    const cocktails = qc.getQueryData<{ ingredients: { ingredient_id: string }[] }[]>(["cocktails"]) ?? [];
    const usedIds = new Set<string>();
    for (const c of cocktails) {
      for (const i of c.ingredients ?? []) {
        usedIds.add(i.ingredient_id);
      }
    }
    return (data ?? []).filter((i) => !usedIds.has(i.id));
  }, [data, qc]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-medium">Tilføj ingrediens</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="fx Gin"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catNames.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => name.trim() && addM.mutate({ name: name.trim(), category })}
            disabled={addM.isPending}
          >
            Tilføj
          </Button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteUnusedOpen(true)}
          disabled={delSelectedUnusedM.isPending}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Slet ubrugte ingredienser
        </Button>
      </div>

      {grouped.map(([cat, items]) =>
        items.length === 0 ? null : (
          <section key={cat}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
              {cat}
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((ing) => (
                <li key={ing.id} className="flex items-center gap-2 px-3 py-2">
                  {editingId === ing.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catNames.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          editM.mutate({
                            id: ing.id,
                            name: editName.trim(),
                            category: editCategory,
                            available: ing.available,
                          })
                        }
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Checkbox
                        checked={ing.available}
                        onCheckedChange={(v) =>
                          availM.mutate({ id: ing.id, available: !v })
                        }
                      />
                      <span className="flex-1">{ing.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(ing.id);
                          setEditName(ing.name);
                          setEditCategory(ing.category);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Slet ${ing.name}?`)) delM.mutate(ing.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      <DeleteUnusedDialog
        open={deleteUnusedOpen}
        onOpenChange={setDeleteUnusedOpen}
        unusedIngredients={unusedIngredients}
        categories={catNames}
        onConfirm={(ids) => delSelectedUnusedM.mutate(ids)}
        isPending={delSelectedUnusedM.isPending}
      />
    </div>
  );
}
