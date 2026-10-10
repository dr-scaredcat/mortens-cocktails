import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listGrapeGlassMapping, listGlassTypes,
  type GrapeGlassMapping, type GlassType,
} from "@/lib/vinglas.functions";
import { upsertGrapeMapping, deleteGrapeMapping } from "@/lib/vinglas-admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

// ── Formular-hjælpere ──────────────────────────────────────────────────────
function emptyForm() {
  return {
    id: undefined as string | undefined,
    wineName: "",
    glassId: "",
  };
}
type MappingForm = ReturnType<typeof emptyForm>;

// ── Opslags-række ───────────────────────────────────────────────────────
function MappingRow({ item, onEdit, onDelete }: {
  item: GrapeGlassMapping;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.wine_name}</p>
        <p className="text-xs text-muted-foreground">{item.glass?.name ?? "Ukendt glas"}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Redigér">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Slet">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// ── Hovedkomponent ─────────────────────────────────────────────────────────
export function AdminVinglasMapping() {
  const qc = useQueryClient();
  const fetchMapping = useServerFn(listGrapeGlassMapping);
  const fetchGlassTypes = useServerFn(listGlassTypes);
  const save = useServerFn(upsertGrapeMapping);
  const del = useServerFn(deleteGrapeMapping);

  const { data: mappingData } = useQuery({ queryKey: ["grape-glass-mapping"], queryFn: () => fetchMapping() });
  const { data: glassTypesData } = useQuery({ queryKey: ["glass-types"], queryFn: () => fetchGlassTypes() });

  const mapping = (mappingData ?? []) as GrapeGlassMapping[];
  const glassTypes = (glassTypesData ?? []) as GlassType[];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MappingForm>(emptyForm());
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GrapeGlassMapping | null>(null);

  const patch = <K extends keyof MappingForm>(key: K, val: MappingForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const query = search.trim().toLowerCase();
  const visibleList = useMemo(() => {
    const base = !query ? mapping : mapping.filter((m) =>
      m.wine_name.toLowerCase().includes(query) ||
      (m.glass?.name ?? "").toLowerCase().includes(query)
    );
    return [...base].sort((a, b) => a.wine_name.localeCompare(b.wine_name, "da"));
  }, [mapping, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["grape-glass-mapping"] });

  const saveM = useMutation({
    mutationFn: (f: MappingForm) => save({ data: {
      id: f.id,
      wineName: f.wineName.trim(),
      glassId: f.glassId,
    }}),
    onSuccess: () => { setOpen(false); invalidate(); toast.success(form.id ? "Opslaget er gemt" : "Opslaget er oprettet"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { setDeleteTarget(null); invalidate(); toast.success("Opslaget er slettet"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fejl"),
  });

  function openNew() { setForm(emptyForm()); setOpen(true); }

  function openEdit(m: GrapeGlassMapping) {
    setForm({ id: m.id, wineName: m.wine_name, glassId: m.glass_id });
    setOpen(true);
  }

  function submit() {
    if (!form.wineName.trim()) return toast.error("Vin/drue-navn mangler");
    if (!form.glassId) return toast.error("Vælg en glastype");
    saveM.mutate(form);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nyt opslag</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Redigér opslag" : "Nyt opslag"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Drue/vin-navn *</Label>
                <Input value={form.wineName} onChange={(e) => patch("wineName", e.target.value)} placeholder="fx Sauvignon Blanc" />
              </div>
              <div>
                <Label>Glastype *</Label>
                <Select value={form.glassId} onValueChange={(v) => patch("glassId", v)}>
                  <SelectTrigger><SelectValue placeholder="Vælg glastype" /></SelectTrigger>
                  <SelectContent>
                    {glassTypes.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annullér</Button>
              <Button onClick={submit} disabled={saveM.isPending}>{saveM.isPending ? "Gemmer…" : "Gem"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søg efter drue, vin eller glastype..." className="pl-9" />
      </div>

      <p className="text-xs text-muted-foreground">{visibleList.length} opslag</p>

      {visibleList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          {query ? "Ingen opslag matcher søgningen." : 'Ingen opslag endnu — opret det første med "Nyt opslag".'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleList.map((m) => (
            <MappingRow key={m.id} item={m} onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
          ))}
        </div>
      )}

      {/* Sletningsdialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Slet opslag</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette opslaget for <strong>{deleteTarget?.wine_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={delM.isPending}>Annullér</Button>
            <Button variant="destructive" onClick={() => deleteTarget && delM.mutate(deleteTarget.id)} disabled={delM.isPending}>
              {delM.isPending ? "Sletter…" : "Slet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
