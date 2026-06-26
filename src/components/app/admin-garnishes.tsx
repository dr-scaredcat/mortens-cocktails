import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGarnishes } from "@/lib/cocktails.functions";
import { upsertGarnish, deleteGarnish } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";

export function AdminGarnishes() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listGarnishes);
  const upsert = useServerFn(upsertGarnish);
  const del = useServerFn(deleteGarnish);

  const { data } = useQuery({ queryKey: ["garnishes"], queryFn: () => fetchList() });

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOld, setEditOld] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["garnishes"] });
    qc.invalidateQueries({ queryKey: ["cocktails"] });
  };

  const addM = useMutation({
    mutationFn: (n: string) => upsert({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Pynt tilføjet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editM = useMutation({
    mutationFn: (v: { id: string; name: string; oldName: string }) => upsert({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Pynt opdateret");
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
        <h3 className="mb-3 font-medium">Tilføj pynt</h3>
        <div className="flex gap-2">
          <Input
            placeholder="fx Limeskive"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && addM.mutate(name.trim())}
          />
          <Button
            onClick={() => name.trim() && addM.mutate(name.trim())}
            disabled={addM.isPending}
          >
            Tilføj
          </Button>
        </div>
      </Card>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {(data ?? []).length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            Ingen pynt endnu — tilføj en ovenfor.
          </li>
        )}
        {(data ?? []).map((g) => (
          <li key={g.id} className="flex items-center gap-2 px-3 py-2">
            {editingId === g.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      editM.mutate({ id: g.id, name: editName.trim(), oldName: editOld });
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    editM.mutate({ id: g.id, name: editName.trim(), oldName: editOld })
                  }
                  disabled={editM.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1">{g.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(g.id);
                    setEditName(g.name);
                    setEditOld(g.name);
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
                        `Slet "${g.name}"? Cocktails der bruger denne pynt vil miste pynttypen.`,
                      )
                    )
                      delM.mutate({ id: g.id, name: g.name });
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
