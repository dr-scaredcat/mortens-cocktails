import { useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, X, ImageDown, GripVertical } from "lucide-react";
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

  const saveM = useMutation({
    mutationFn: (payload: any) => save({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["glasses"] });
      qc.invalidateQueries({ queryKey: ["garnishes"] });
      setOpen(false);
      toast.success("Gemt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      toast.success("Slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backfillM = useMutation({
    mutationFn: () => backfill(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      toast.success(
        `Opdateret ${r.updated} cocktails${r.missing ? ` (${r.missing} ikke fundet)` : ""}`,
      );
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

  const sorted = useMemo(
    () => [...(cocktails ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [cocktails],
  );

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
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((c) => (
          <Card
            key={c.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted sm:h-16 sm:w-16">
              {c.image_url && (
                <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.ingredients.map((i) => i.name).join(", ")}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Slet ${c.name}?`)) delM.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
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
  const fetchImg = useServerFn(fetchCocktailDbImage);
  const [fetchingImg, setFetchingImg] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function pullImage() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Indtast et navn først");
      return;
    }
    setFetchingImg(true);
    try {
      const r = await fetchImg({ data: { name } });
      if (!r.image) {
        toast.error("Intet billede fundet på TheCocktailDB");
      } else {
        setForm({ ...form, image_url: r.image });
        toast.success("Billede hentet");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFetchingImg(false);
    }
  }

  function patch<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
  }

  function setItem(idx: number, p: Partial<Item>) {
    const next = form.ingredients.map((it, i) => (i === idx ? { ...it, ...p } : it));
    setForm({ ...form, ingredients: next });
  }

  function addItem() {
    setForm({
      ...form,
      ingredients: [...form.ingredients, { _id: newId(), name: "", amount: "", unit: "ml" }],
    });
  }

  function removeItem(idx: number) {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  }

  function toggleTag(t: string) {
    const next = form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t];
    setForm({ ...form, tags: next });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = form.ingredients.findIndex((it) => it._id === active.id);
    const newIdx = form.ingredients.findIndex((it) => it._id === over.id);
    setForm({ ...form, ingredients: arrayMove(form.ingredients, oldIdx, newIdx) });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Navn</Label>
        <Input value={form.name} onChange={(e) => patch("name", e.target.value)} />
      </div>
      <div>
        <Label>Beskrivelse</Label>
        <Textarea
          value={form.description}
          onChange={(e) => patch("description", e.target.value)}
          rows={2}
        />
      </div>
      <div>
        <Label>Billede-URL</Label>
        <div className="flex gap-2">
          <Input
            value={form.image_url}
            onChange={(e) => patch("image_url", e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={pullImage} disabled={fetchingImg}>
            {fetchingImg ? "Henter…" : "Hent"}
          </Button>
        </div>
        {form.image_url && (
          <img
            src={form.image_url}
            alt=""
            className="mt-2 h-24 w-24 rounded object-cover"
          />
        )}
      </div>

      {/* Glas og pynt med autocomplete */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Glas</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Nye glastyper tilføjes automatisk.
          </p>
          <Input
            list="glass-names"
            placeholder="fx Martini-glas"
            value={form.glass}
            onChange={(e) => patch("glass", e.target.value)}
          />
          <datalist id="glass-names">
            {glassNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>Pynt</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Nye pynttyper tilføjes automatisk.
          </p>
          <Input
            list="garnish-names"
            placeholder="fx Limeskive"
            value={form.garnish}
            onChange={(e) => patch("garnish", e.target.value)}
          />
          <datalist id="garnish-names">
            {garnishNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <Label>Fremgangsmåde</Label>
        <Textarea
          value={form.instructions}
          onChange={(e) => patch("instructions", e.target.value)}
          rows={4}
        />
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
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={form.ingredients.map((it) => it._id)}
              strategy={verticalListSortingStrategy}
            >
              {form.ingredients.map((it, i) => (
                <SortableIngredient
                  key={it._id}
                  item={it}
                  onChange={(p) => setItem(i, p)}
                  onRemove={() => removeItem(i)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <datalist id="ingredient-names">
            {ingredientNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> Tilføj ingrediens
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableIngredient({
  item,
  onChange,
  onRemove,
}: {
  item: Item;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 rounded-md bg-background sm:gap-2"
    >
      <button
        type="button"
        className="touch-none cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
        aria-label="Træk for at flytte"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        list="ingredient-names"
        placeholder="Ingrediens"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="min-w-0 flex-1"
      />
      <Input
        type="number"
        step="0.1"
        placeholder="Mængde"
        value={item.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        className="w-16 sm:w-24"
      />
      <Select value={item.unit} onValueChange={(v) => onChange({ unit: v })}>
        <SelectTrigger className="w-20 sm:w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={onRemove} type="button">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
