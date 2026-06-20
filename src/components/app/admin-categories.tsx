import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories } from "@/lib/cocktails.functions";
import { upsertCategory, deleteCategory } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";

export function AdminCategories() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCategories);
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);

  const { data } = useQuery({ queryKey: ["categories"], queryFn: () => fetchList() });

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOld, setEditOld] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const addM = useMutation({
    mutationFn: (n: string) => upsert({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Kategori tilføjet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editM = useMutation({
    mutationFn: (v: { id: string; name: string; oldName: string }) =>
      upsert({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (v: { id: string; name: string }) => del({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 font-medium">Tilføj kategori</h3>
        <div className="flex gap-2">
          <Input
            placeholder="fx Bobler"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={() => name.trim() && addM.mutate(name.trim())} disabled={addM.isPending}>
            Tilføj
          </Button>
        </div>
      </Card>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {(data ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            {editingId === c.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    editM.mutate({ id: c.id, name: editName.trim(), oldName: editOld })
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
                <span className="flex-1">{c.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                    setEditOld(c.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        `Slet "${c.name}"? Ingredienser i denne kategori flyttes til "Andet".`,
                      )
                    )
                      delM.mutate({ id: c.id, name: c.name });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}