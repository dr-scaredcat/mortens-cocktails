import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTags } from "@/lib/cocktails.functions";
import { upsertTag, deleteTag } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";

export function AdminTags() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listTags);
  const upsert = useServerFn(upsertTag);
  const del = useServerFn(deleteTag);

  const { data } = useQuery({ queryKey: ["tags"], queryFn: () => fetchList() });

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOld, setEditOld] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["cocktails"] });
  };

  const addM = useMutation({
    mutationFn: (n: string) => upsert({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Tag tilføjet");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const editM = useMutation({
    mutationFn: (v: { id: string; name: string; oldName: string }) => upsert({ data: v }),
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
        <h3 className="mb-3 font-medium">Tilføj tag</h3>
        <div className="flex gap-2">
          <Input placeholder="fx jule" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => name.trim() && addM.mutate(name.trim())} disabled={addM.isPending}>
            Tilføj
          </Button>
        </div>
      </Card>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {(data ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-3 py-2">
            {editingId === t.id ? (
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
                    editM.mutate({ id: t.id, name: editName.trim(), oldName: editOld })
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
                <span className="flex-1">{t.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditName(t.name);
                    setEditOld(t.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Slet "${t.name}"? Alle cocktails mister dette tag.`))
                      delM.mutate({ id: t.id, name: t.name });
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