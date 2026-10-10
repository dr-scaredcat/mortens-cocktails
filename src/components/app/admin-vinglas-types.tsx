import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGlassTypes, type GlassType } from "@/lib/vinglas.functions";
import { upsertGlassType, deleteGlassType } from "@/lib/vinglas-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, GlassWater } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { AdminImage } from "@/components/app/admin-image";

// ── Formular-hjælpere ──────────────────────────────────────────────────────
function intOrNull(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() && Number.isFinite(n) ? Math.round(n) : null;
}

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: "",
    imageUrl: "",
    quantityOwned: "",
  };
}
type GlassForm = ReturnType<typeof emptyForm>;

// ── Glastype-række ───────────────────────────────────────────────────────
function GlassRow({ glass, onEdit, onDelete }: {
  glass: GlassType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
        {glass.image_url ? (
          <AdminImage src={glass.image_url} alt={glass.name} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <GlassWater className="h-6 w-6 opacity-30" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{glass.name}</p>
        {typeof glass.quantity_owned === "number" && (
          <p className="text-xs text-muted-foreground">{glass.quantity_owned} i samlingen</p>
        )}
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
export function AdminVinglasTypes() {
  const qc = useQueryClient();
  const fetchGlassTypes = useServerFn(listGlassTypes);
  const save = useServerFn(upsertGlassType);
  const del = useServerFn(deleteGlassType);

  const { data } = useQuery({ queryKey: ["glass-types"], queryFn: () => fetchGlassTypes() });
  const list = (data ?? []) as GlassType[];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GlassForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<GlassType | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = <K extends keyof GlassForm>(key: K, val: GlassForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["glass-types"] });
    qc.invalidateQueries({ queryKey: ["grape-glass-mapping"] });
  };

  const saveM = useMutation({
    mutationFn: (f: GlassForm) => save({ data: {
      id: f.id,
      name: f.name.trim(),
      imageUrl: f.imageUrl.trim() || null,
      quantityOwned: intOrNull(f.quantityOwned),
    }}),
    onSuccess: () => { setOpen(false); invalidate(); toast.success(form.id ? "Glastypen er gemt" : "Glastypen er oprettet"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { setDeleteTarget(null); invalidate(); toast.success("Glastypen er slettet"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fejl"),
  });

  function openNew() { setForm(emptyForm()); setOpen(true); }

  function openEdit(g: GlassType) {
    setForm({
      id: g.id,
      name: g.name,
      imageUrl: g.image_url ?? "",
      quantityOwned: g.quantity_owned !== null && g.quantity_owned !== undefined ? String(g.quantity_owned) : "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return toast.error("Navn mangler");
    saveM.mutate(form);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Kun billedfiler er tilladt"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Filen er for stor — maks 10 MB"); return; }
    setUploadingImg(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const fileName = `glass_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("cocktail-images")
        .upload(fileName, compressed, { upsert: false, contentType: compressed.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("cocktail-images").getPublicUrl(fileName);
      patch("imageUrl", urlData.publicUrl);
      toast.success("Billede uploadet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Ny glastype</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Redigér glastype" : "Ny glastype"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Navn *</Label>
                <Input value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="fx Bordeaux Grand Cru" />
              </div>
              <div>
                <Label>Antal i samlingen</Label>
                <Input value={form.quantityOwned} onChange={(e) => patch("quantityOwned", e.target.value)} inputMode="numeric" placeholder="fx 6" />
              </div>
              <div>
                <Label>Billede (URL)</Label>
                <div className="flex gap-2">
                  <Input value={form.imageUrl} onChange={(e) => patch("imageUrl", e.target.value)} placeholder="https://..." />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}>
                    <Upload className="mr-1 h-4 w-4" />{uploadingImg ? "Uploader…" : "Upload"}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
                {form.imageUrl && (
                  <div className="relative mt-2">
                    <AdminImage src={form.imageUrl} alt="Preview" className="h-32 w-full rounded" />
                    <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7 opacity-90" onClick={() => patch("imageUrl", "")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annullér</Button>
              <Button onClick={submit} disabled={saveM.isPending}>{saveM.isPending ? "Gemmer…" : "Gem"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Ingen glastyper endnu — opret den første med "Ny glastype".
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((g) => (
            <GlassRow key={g.id} glass={g} onEdit={() => openEdit(g)} onDelete={() => setDeleteTarget(g)} />
          ))}
        </div>
      )}

      {/* Sletningsdialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Slet glastype</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette <strong>{deleteTarget?.name}</strong>? Alle drue/vin-opslag der peger på denne glastype bliver også slettet.
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
