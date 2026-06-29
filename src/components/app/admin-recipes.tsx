import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecipes, listIngredients } from "@/lib/cocktails.functions";
import { saveRecipe, deleteRecipe } from "@/lib/recipes.functions";
import type { RecipeWithDetails } from "@/lib/cocktails.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNITS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Upload, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type IngItem = { _id: string; name: string; amount: string; unit: string };
type ImgItem = { _id: string; url: string };

let _seq = 0;
const newId = () => `it_${++_seq}_${Date.now()}`;

/** Konvertér decimal-punktum (fra databasen) til komma for visning */
function toCommaDisplay(val: string): string {
  return val.replace(".", ",");
}

/** Konvertér komma-streng til tal for API-kald */
function amountToNumber(val: string): number | null {
  if (!val) return null;
  return parseFloat(val.replace(",", "."));
}

/** Håndter input i mængde-felt: tillad kun cifre + ét komma, konvertér punktum til komma */
function sanitizeAmountInput(raw: string): string {
  let val = raw.replace(/[^0-9.,]/g, "");
  val = val.replace(/\./g, ",");
  const parts = val.split(",");
  if (parts.length > 2) {
    val = parts[0] + "," + parts.slice(1).join("");
  }
  return val;
}

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: "",
    description: "",
    instructions: "",
    images: [] as ImgItem[],
    ingredients: [{ _id: newId(), name: "", amount: "", unit: "ml" }] as IngItem[],
  };
}

function ImageCarousel({
  images,
  onRemove,
}: {
  images: ImgItem[];
  onRemove: (id: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const safe = Math.min(idx, images.length - 1);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
      <img src={images[safe].url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={() => onRemove(images[safe]._id)}
        className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive hover:bg-background"
        aria-label="Fjern billede"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === safe ? "bg-foreground" : "bg-foreground/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminRecipes() {
  const qc = useQueryClient();
  const fetchRecipes = useServerFn(listRecipes);
  const fetchIngs = useServerFn(listIngredients);
  const save = useServerFn(saveRecipe);
  const del = useServerFn(deleteRecipe);

  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => fetchRecipes(),
  });
  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => fetchIngs(),
  });

  const ingNames = (ingredients ?? []).map((i) => i.name).sort((a, b) => a.localeCompare(b, "da"));

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patch<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function openNew() {
    setForm(emptyForm());
    setUrlInput("");
    setOpen(true);
  }

  function openEdit(r: RecipeWithDetails) {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      instructions: r.instructions ?? "",
      images: r.images.map((img) => ({ _id: newId(), url: img.url })),
      ingredients: r.ingredients.length
        ? r.ingredients.map((i) => ({
            _id: newId(),
            name: i.name,
            // Konvertér decimal-punktum fra databasen til komma for visning
            amount: i.amount != null ? toCommaDisplay(String(i.amount)) : "",
            unit: i.unit ?? "ml",
          }))
        : [{ _id: newId(), name: "", amount: "", unit: "ml" }],
    });
    setUrlInput("");
    setOpen(true);
  }

  function addImageUrl() {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { toast.error("Ugyldig URL"); return; }
    patch("images", [...form.images, { _id: newId(), url }]);
    setUrlInput("");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Kun billedfiler er tilladt"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Filen er for stor — maks 10 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `recipe_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("cocktail-images")
        .upload(fileName, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("cocktail-images").getPublicUrl(fileName);
      patch("images", [...form.images, { _id: newId(), url: urlData.publicUrl }]);
      toast.success("Billede uploadet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    patch("images", form.images.filter((img) => img._id !== id));
  }

  function setItem(i: number, p: Partial<IngItem>) {
    const next = [...form.ingredients];
    next[i] = { ...next[i], ...p };
    patch("ingredients", next);
  }
  function addItem() {
    patch("ingredients", [...form.ingredients, { _id: newId(), name: "", amount: "", unit: "ml" }]);
  }
  function removeItem(i: number) {
    patch("ingredients", form.ingredients.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Navn er påkrævet"); return; }
    setSaving(true);
    try {
      await save({
        data: {
          id: form.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          instructions: form.instructions.trim() || null,
          images: form.images.map((img, i) => ({ url: img.url, position: i })),
          ingredients: form.ingredients
            .filter((it) => it.name.trim())
            .map((it) => ({
              name: it.name.trim(),
              amount: amountToNumber(it.amount),
              unit: it.unit || null,
            })),
        },
      });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      setOpen(false);
      toast.success(form.id ? "Opskrift gemt" : "Opskrift oprettet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Opskrift slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDelete(r: RecipeWithDetails) {
    if (!confirm(`Slet "${r.name}"?`)) return;
    delMut.mutate(r.id);
  }

  const recipeQuery = search.trim().toLowerCase();
  const visibleRecipes = ((recipes ?? []) as RecipeWithDetails[])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "da"))
    .filter((r) => (recipeQuery ? r.name.toLowerCase().includes(recipeQuery) : true));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Ny opskrift
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg efter opskrift..."
          className="pl-9"
        />
      </div>

      {visibleRecipes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {recipeQuery ? "Ingen opskrifter matcher søgningen." : "Ingen opskrifter endnu."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleRecipes.map((r) => (
              <Card key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                  {r.images[0] && (
                    <img src={r.images[0].url} alt={r.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.ingredients.map((i) => i.name).join(", ")}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(r)} disabled={delMut.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Rediger opskrift" : "Ny opskrift"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Navn */}
            <div>
              <Label>Navn</Label>
              <Input value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Opskriftsnavn" />
            </div>

            {/* Beskrivelse */}
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={2} placeholder="Kort beskrivelse..." />
            </div>

            {/* Billeder */}
            <div>
              <Label>Billeder</Label>
              <ImageCarousel images={form.images} onRemove={removeImage} />
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Billede-URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
                />
                <Button type="button" variant="outline" onClick={addImageUrl}>Tilføj</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {uploading ? "Uploader…" : "Upload"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
              {form.images.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{form.images.length} billede{form.images.length !== 1 ? "r" : ""}</p>
              )}
            </div>

            {/* Ingredienser */}
            <div>
              <Label>Ingredienser</Label>
              <div className="mt-1 space-y-2">
                {form.ingredients.map((it, i) => (
                  <div key={it._id} className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Ingrediens"
                        value={it.name}
                        onChange={(e) => setItem(i, { name: e.target.value })}
                        list={`ings-recipe-${i}`}
                      />
                      <datalist id={`ings-recipe-${i}`}>
                        {ingNames.map((n) => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Mængde"
                      className="w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={it.amount}
                      onChange={(e) => setItem(i, { amount: sanitizeAmountInput(e.target.value) })}
                    />
                    <Select value={it.unit} onValueChange={(v) => setItem(i, { unit: v })}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)} disabled={form.ingredients.length === 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Tilføj ingrediens
                </Button>
              </div>
            </div>

            {/* Fremgangsmåde */}
            <div>
              <Label>Fremgangsmåde</Label>
              <Textarea value={form.instructions} onChange={(e) => patch("instructions", e.target.value)} rows={6} placeholder="Trin-for-trin instruktioner..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuller</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Gemmer…" : form.id ? "Gem ændringer" : "Opret opskrift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
