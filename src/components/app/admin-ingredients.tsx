import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIngredients, type IngredientRow } from "@/lib/cocktails.functions";
import {
  upsertIngredient,
  deleteIngredient,
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
import { CATEGORIES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";

export function AdminIngredients() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listIngredients);
  const upsert = useServerFn(upsertIngredient);
  const del = useServerFn(deleteIngredient);
  const setAvail = useServerFn(setIngredientAvailable);

  const { data } = useQuery({ queryKey: ["ingredients"], queryFn: () => fetchList() });

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Spiritus");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");

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

  const availM = useMutation({
    mutationFn: (v: { id: string; available: boolean }) => setAvail({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, IngredientRow[]>();
    for (const c of CATEGORIES) map.set(c, []);
    for (const i of data ?? []) (map.get(i.category) ?? map.get("Andet")!).push(i);
    return Array.from(map.entries());
  }, [data]);

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
              {CATEGORIES.map((c) => (
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
                          {CATEGORIES.map((c) => (
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
                          availM.mutate({ id: ing.id, available: !!v })
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
    </div>
  );
}