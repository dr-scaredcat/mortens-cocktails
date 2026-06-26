import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCocktails,
  listIngredients,
  listGlasses,
  listGarnishes,
  type CocktailWithDetails,
} from "@/lib/cocktails.functions";
import {
  saveCocktail,
  deleteCocktail,
  fetchCocktailDbImage,
  backfillCocktailImages,
  resetCocktailRating,
  reorderCocktails,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { listTags } from "@/lib/cocktails.functions";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ImageDown, GripVertical, ArrowDownAZ, Star, Upload } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";

type Item = { _id: string; name: string; amount: string; unit: string };

let _itemSeq = 0;
const newId = () => `it_${++_itemSeq}_${Date.now()}`;

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: "",
    description: "",
    image_url: "",
    glass: "",
    garnish: "",
    instructions: "",
    tags: [] as string[],
    ingredients: [{ _id: newId(), name: "", amount: "", unit: "ml" }] as Item[],
  };
}

// ---- Sortable cocktail row in the admin list ----
function SortableCocktailRow({
  cocktail,
  onEdit,
  onDelete,
}: {
  cocktail: CocktailWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cocktail.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Træk for at ændre rækkefølge"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted sm:h-16 sm:w-16">
        {cocktail.image_url && (
          <img src={cocktail.image_url} alt={cocktail.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{cocktail.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {cocktail.ingredients.map((i) => i.name).join(", ")}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function AdminCocktails() {
  const qc = useQueryClient();
  const fetchCocktails = useServerFn(listCocktails);
  const fetchIngs = useServerFn(listIngredients);
  const fetchTags = useServerFn(listTags);
  const fetchGlasses = useServerFn(listGlasses);
  const fetchGarnishes = useServerFn(listGarnishes);
  const save = useServerFn(saveCocktail);
  const del = useServerFn(deleteCocktail);
  const backfill = useServerFn(backfillCocktailImages);
  const resetRating = useServerFn(resetCocktailRating);
  const reorder = useServerFn(reorderCocktails);

  const { data: cocktails } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => fetchIngs(),
  });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: () => fetchTags() });
  const { data: glasses } = useQuery({ queryKey: ["glasses"], queryFn: () => fetchGlasses() });
  const { data: garnishes } = useQuery({ queryKey: ["garnishes"], queryFn: () => fetchGarnishes() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [localOrder, setLocalOrder] = useState<CocktailWithDetails[] | null>(null);

  const displayList = localOrder ?? (cocktails as CocktailWithDetails[] | undefined) ?? [];

  const saveM = useMutation({
    mutationFn: (payload: Parameters<typeof save>[0]["data"]) => save({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      setOpen(false);
      setLocalOrder(null);
      toast.success("Cocktail gemt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      setLocalOrder(null);
      toast.success("Cocktail slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backfillM = useMutation({
    mutationFn: () => backfill(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      toast.success(`Opdateret ${r.updated} cocktail(s). ${r.missing} ikke fundet.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetRatingM = useMutation({
    mutationFn: (id: string) => resetRating({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      qc.invalidateQueries({ queryKey: ["my-ratings"] });
      toast.success("Rating nulstillet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayList.findIndex((c) => c.id === active.id);
    const newIndex = displayList.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(displayList, oldIndex, newIndex);
    setLocalOrder(reordered);
    reorderM.mutate(reordered.map((c) => c.id));
  }

  function sortAlpha() {
    const sorted = [...displayList].sort((a, b) => a.name.localeCompare(b.name, "da"));
    setLocalOrder(sorted);
    reorderM.mutate(sorted.map((c) => c.id));
  }

  function sortByRating() {
    const sorted = [...displayList].sort(
      (a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
    );
    setLocalOrder(sorted);
    reorderM.mutate(sorted.map((c) => c.id));
  }

  function openNew() {
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(c: CocktailWithDetails) {
    setForm({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      image_url: c.image_url ?? "",
      glass: c.glass ?? "",
      garnish: c.garnish ?? "",
      instructions: c.instructions ?? "",
      tags: c.tags,
      ingredients: c.ingredients.map((i) => ({
        _id: newId(),
        name: i.name,
        amount: i.amount == null ? "" : String(i.amount),
        unit: i.unit ?? "",
      })),
    });
    setOpen(true);
  }

  function submit() {
    const payload = {
      id: form.id,
      name: form.name.trim(),
      description: form.description || null,
      image_url: form.image_url || null,
      glass: form.glass || null,
      garnish: form.garnish || null,
      instructions: form.instructions || null,
      tags: form.tags,
      ingredients: form.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          amount: i.amount === "" ? null : Number(i.amount),
          unit: i.unit || null,
        })),
    };
    if (!payload.name) return toast.error("Navn mangler");
    if (payload.ingredients.length === 0) return toast.error("Tilføj mindst én ingrediens");
    saveM.mutate(payload);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => backfillM.mutate()}
          disabled={backfillM.isPending}
        >
          <ImageDown className="mr-1 h-4 w-4" />
          {backfillM.isPending ? "Henter…" : "Hent manglende billeder"}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Ny cocktail
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Rediger cocktail" : "Ny cocktail"}</DialogTitle>
            </DialogHeader>
            <CocktailForm
              form={form}
              setForm={setForm}
              ingredientNames={(ingredients ?? []).map((i) => i.name)}
              tagNames={(tags ?? []).map((t) => t.name)}
              glassNames={(glasses ?? []).map((g) => g.name)}
              garnishNames={(garnishes ?? []).map((g) => g.name)}
            />
            <DialogFooter>
              {form.id && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Nulstil alle vurderinger for ${form.name}?`)) {
                      resetRatingM.mutate(form.id!);
                    }
                  }}
                  disabled={resetRatingM.isPending}
                  className="mr-auto"
                >
                  Nulstil rating
                </Button>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annullér
              </Button>
              <Button onClick={submit} disabled={saveM.isPending}>
                Gem
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={sortAlpha}
          disabled={reorderM.isPending}
        >
          <ArrowDownAZ className="mr-1 h-4 w-4" />
          Sortér A-Z
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={sortByRating}
          disabled={reorderM.isPending}
        >
          <Star className="mr-1 h-4 w-4" />
          Sortér efter rating
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={displayList.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {displayList.map((c) => (
              <SortableCocktailRow
                key={c.id}
                cocktail={c}
                onEdit={() => openEdit(c)}
                onDelete={() => {
                  if (confirm(`Slet ${c.name}?`)) delM.mutate(c.id);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CocktailForm({
  form,
  setForm,
  ingredientNames,
  tagNames,
  glassNames,
  garnishNames,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: (f: ReturnType<typeof emptyForm>) => void;
  ingredientNames: string[];
  tagNames: string[];
  glassNames: string[];
  garnishNames: string[];
}) {
  const patch = (key: keyof ReturnType<typeof emptyForm>, val: any) =>
    setForm({ ...form, [key]: val });

  const toggleTag = (t: string) =>
    patch(
      "tags",
      form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t],
    );

  const setItem = (i: number, p: Partial<Item>) => {
    const next = [...form.ingredients];
    next[i] = { ...next[i], ...p };
    patch("ingredients", next);
  };
  const addItem = () =>
    patch("ingredients", [...form.ingredients, { _id: newId(), name: "", amount: "", unit: "ml" }]);
  const removeItem = (i: number) =>
    patch("ingredients", form.ingredients.filter((_, idx) => idx !== i));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.ingredients.findIndex((it) => it._id === active.id);
    const newIndex = form.ingredients.findIndex((it) => it._id === over.id);
    patch("ingredients", arrayMove(form.ingredients, oldIndex, newIndex));
  }

  const fetchImg = useServerFn(fetchCocktailDbImage);
  const imgM = useMutation({
    mutationFn: () => fetchImg({ data: { name: form.name.trim() } }),
    onSuccess: (r) => { if (r.image) patch("image_url", r.image); else toast.error("Intet billede fundet"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Billede-upload til Supabase Storage
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validér filtype
    if (!file.type.startsWith("image/")) {
      toast.error("Kun billedfiler er tilladt (jpg, png, webp osv.)");
      return;
    }

    // Maks 10 MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen er for stor — maks 10 MB");
      return;
    }

    setUploading(true);
    try {
      // Unikt filnavn baseret på timestamp
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `cocktail_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("cocktail-images")
        .upload(fileName, file, { upsert: false, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("cocktail-images")
        .getPublicUrl(fileName);

      patch("image_url", urlData.publicUrl);
      toast.success("Billede uploadet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setUploading(false);
      // Nulstil input så samme fil kan vælges igen
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Navn</Label>
        <Input value={form.name} onChange={(e) => patch("name", e.target.value)} />
      </div>
      <div>
        <Label>Beskrivelse</Label>
        <Textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={2} />
      </div>

      {/* Billede */}
      <div>
        <Label>Billede</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {/* Upload fra fil */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {uploading ? "Uploader…" : "Upload billede"}
          </Button>

          {/* Hent fra CocktailDB */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => imgM.mutate()}
            disabled={imgM.isPending || !form.name.trim()}
          >
            {imgM.isPending ? "Henter…" : "Hent fra CocktailDB"}
          </Button>
        </div>

        {/* URL-felt */}
        <Input
          className="mt-2"
          value={form.image_url}
          onChange={(e) => patch("image_url", e.target.value)}
          placeholder="eller indsæt billed-URL direkte…"
        />

        {/* Preview */}
        {form.image_url && (
          <div className="mt-2 relative inline-block">
            <img src={form.image_url} alt="" className="h-24 w-24 rounded object-cover" />
            <button
              type="button"
              onClick={() => patch("image_url", "")}
              className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              title="Fjern billede"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Glas</Label>
          <p className="mb-1 text-xs text-muted-foreground">Nye glastyper tilføjes automatisk.</p>
          <Input
            list="glass-names"
            placeholder="fx Martini-glas"
            value={form.glass}
            onChange={(e) => patch("glass", e.target.value)}
          />
          <datalist id="glass-names">
            {glassNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <Label>Pynt</Label>
          <p className="mb-1 text-xs text-muted-foreground">Nye pynttyper tilføjes automatisk.</p>
          <Input
            list="garnish-names"
            placeholder="fx Limeskive"
            value={form.garnish}
            onChange={(e) => patch("garnish", e.target.value)}
          />
          <datalist id="garnish-names">
            {garnishNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      </div>

      <div>
        <Label>Fremgangsmåde</Label>
        <Textarea value={form.instructions} onChange={(e) => patch("instructions", e.target.value)} rows={4} />
      </div>

      <div>
        <Label>Tags</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {tagNames.map((t) => {
            const active = form.tags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t)}>
                <Badge variant={active ? "default" : "outline"}>{t}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Ingredienser</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Skriv navn på ingrediens. Nye navne tilføjes automatisk til biblioteket.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={form.ingredients.map((i) => i._id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {form.ingredients.map((item, idx) => (
                <SortableIngredientRow
                  key={item._id}
                  item={item}
                  ingredientNames={ingredientNames}
                  onChange={(p) => setItem(idx, p)}
                  onRemove={() => removeItem(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addItem}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Tilføj ingrediens
        </Button>
      </div>
    </div>
  );
}

function SortableIngredientRow({
  item,
  ingredientNames,
  onChange,
  onRemove,
}: {
  item: Item;
  ingredientNames: string[];
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_minmax(0,1fr)_5rem_6rem_auto] items-center gap-1.5"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div>
        <Input
          list="ingredient-names"
          placeholder="Ingrediens"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <datalist id="ingredient-names">
          {ingredientNames.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>
      <Input
        type="number"
        placeholder="Mængde"
        value={item.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        min={0}
      />
      <Select value={item.unit} onValueChange={(v) => onChange({ unit: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Enhed" />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
