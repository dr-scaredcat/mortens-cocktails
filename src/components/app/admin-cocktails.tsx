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
import { Plus, Pencil, Trash2, X, ImageDown, GripVertical, ArrowDownAZ, Star, Upload, Download, Search } from "lucide-react";
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
import { getCocktailSort, setCocktailSort, type SortMode } from "@/lib/sort-settings.functions";
import { compressImage } from "@/lib/image-utils";
import { AdminImage } from "@/components/app/admin-image";

type Item = { _id: string; name: string; amount: string; unit: string };

let _itemSeq = 0;
const newId = () => `it_${++_itemSeq}_${Date.now()}`;

/** Konvertér en mængde-streng (f.eks. fra databasen "1.5") til visning med komma ("1,5") */
function toCommaDisplay(val: string): string {
  return val.replace(".", ",");
}

/** Konvertér komma-streng til tal for API-kald */
function amountToNumber(val: string): number | null {
  if (val === "") return null;
  return Number(val.replace(",", "."));
}

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

// ── Eksport-dialog ────────────────────────────────────────────────────────────
type ExportFormat = "csv" | "txt";
type ExportContent = "names" | "with-ingredients";

function ExportDialog({
  open,
  onOpenChange,
  cocktails,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cocktails: CocktailWithDetails[];
}) {
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [content, setContent] = useState<ExportContent>("names");

  function formatIngredient(i: CocktailWithDetails["ingredients"][0]): string {
    if (i.amount == null && !i.unit) return i.name;
    const scaled = i.amount != null
      ? Number(i.amount).toString().replace(".", ",")
      : null;
    const parts = [i.name, scaled, i.unit].filter(Boolean);
    // Format: "Gin – 4 cl"
    return i.amount != null || i.unit
      ? `${i.name} – ${[scaled, i.unit].filter(Boolean).join(" ")}`
      : i.name;
  }

  function generateTxt(): string {
    const sorted = [...cocktails].sort((a, b) => a.name.localeCompare(b.name, "da"));
    if (content === "names") {
      return sorted.map((c) => c.name).join("\n");
    }
    return sorted
      .map((c) => {
        const lines = [c.name];
        for (const ing of c.ingredients) {
          lines.push(`  ${formatIngredient(ing)}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");
  }

  function generateCsv(): string {
    const sorted = [...cocktails].sort((a, b) => a.name.localeCompare(b.name, "da"));
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel

    if (content === "names") {
      const rows = [["Cocktail"], ...sorted.map((c) => [c.name])];
      return BOM + rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\n");
    }

    // Med ingredienser: én linje per ingrediens, cocktailnavn gentages
    const rows = [["Cocktail", "Ingrediens", "Mængde", "Enhed"]];
    for (const c of sorted) {
      if (c.ingredients.length === 0) {
        rows.push([c.name, "", "", ""]);
      } else {
        for (const ing of c.ingredients) {
          const amount = ing.amount != null ? String(ing.amount).replace(".", ",") : "";
          rows.push([c.name, ing.name, amount, ing.unit ?? ""]);
        }
      }
    }
    return BOM + rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\n");
  }

  function handleExport() {
    const isCSV = format === "csv";
    const data = isCSV ? generateCsv() : generateTxt();
    const mimeType = isCSV ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;";
    const fileName = isCSV ? "cocktails.csv" : "cocktails.txt";

    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onOpenChange(false);
    toast.success(`${cocktails.length} cocktails eksporteret som ${fileName}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eksportér cocktailliste</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Alle {cocktails.length} cocktails inkluderes, uanset om de er på menuen.
          </p>

          {/* Indhold */}
          <div className="space-y-2">
            <Label>Indhold</Label>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-content"
                  value="names"
                  checked={content === "names"}
                  onChange={() => setContent("names")}
                  className="accent-primary"
                />
                Kun cocktailnavn
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-content"
                  value="with-ingredients"
                  checked={content === "with-ingredients"}
                  onChange={() => setContent("with-ingredients")}
                  className="accent-primary"
                />
                Navn + ingredienser inkl. mængde
              </label>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-format"
                  value="txt"
                  checked={format === "txt"}
                  onChange={() => setFormat("txt")}
                  className="accent-primary"
                />
                Ren tekst (.txt)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-format"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="accent-primary"
                />
                CSV — åbner i Excel/Sheets (.csv)
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Eksportér
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
          <AdminImage src={cocktail.image_url} alt={cocktail.name} className="h-full w-full" />
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
  const fetchSort = useServerFn(getCocktailSort);
  const saveSort = useServerFn(setCocktailSort);

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
  const { data: sortData } = useQuery({ queryKey: ["cocktails-sort"], queryFn: () => fetchSort() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [localOrder, setLocalOrder] = useState<CocktailWithDetails[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Lokalt valg vinder over serverens, så knappen reagerer med det samme.
  const [sortChoice, setSortChoice] = useState<SortMode | null>(null);
  const sortMode: SortMode = sortChoice ?? sortData?.mode ?? "manual";

  // Fuld liste sorteret efter det valgte princip. "manual" = serverens
  // position-rækkefølge; alpha/rating beregnes her, så de overlever genindlæsning
  // uafhængigt af position-kolonnen.
  const sortedList = useMemo(() => {
    const list = (cocktails as CocktailWithDetails[] | undefined) ?? [];
    if (sortMode === "alpha") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "da"));
    }
    if (sortMode === "rating") {
      return [...list].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    }
    return list;
  }, [cocktails, sortMode]);

  // localOrder giver øjeblikkelig feedback under træk-og-slip.
  const orderedList = localOrder ?? sortedList;

  const query = search.trim().toLowerCase();
  const visibleList = query
    ? orderedList.filter((c) => c.name.toLowerCase().includes(query))
    : orderedList;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveM = useMutation({
    mutationFn: (payload: Parameters<typeof save>[0]["data"]) => save({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      setOpen(false);
      toast.success(form.id ? "Cocktail gemt" : "Cocktail oprettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      toast.success("Cocktail slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backfillM = useMutation({
    mutationFn: () => backfill({ data: undefined }),
    onSuccess: (r) => toast.success(`Opdaterede ${r.updated} billeder. ${r.missing} mangler stadig.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const resetRatingM = useMutation({
    mutationFn: (id: string) => resetRating({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cocktails"] });
      toast.success("Rating nulstillet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: ids }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSortM = useMutation({
    mutationFn: (mode: SortMode) => saveSort({ data: { mode } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cocktails-sort"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedList.findIndex((c) => c.id === active.id);
    const newIndex = orderedList.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedList, oldIndex, newIndex);
    setLocalOrder(next);
    reorderM.mutate(next.map((c) => c.id));
    // Træk-og-slip definerer en manuel rækkefølge — lås princippet til "manual".
    setSortChoice("manual");
    saveSortM.mutate("manual");
  }

  function sortAlpha() {
    setSortChoice("alpha");
    setLocalOrder(null);
    saveSortM.mutate("alpha");
  }

  function sortByRating() {
    setSortChoice("rating");
    setLocalOrder(null);
    saveSortM.mutate("rating");
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
        amount: i.amount == null ? "" : toCommaDisplay(String(i.amount)),
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
          amount: amountToNumber(i.amount),
          unit: i.unit || null,
        })),
    };
    if (!payload.name) return toast.error("Navn mangler");
    if (payload.ingredients.length === 0) return toast.error("Tilføj mindst én ingrediens");
    saveM.mutate(payload);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <Button
          variant="outline"
          onClick={() => setExportOpen(true)}
        >
          <Download className="mr-1 h-4 w-4" />
          Eksportér liste
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Ny cocktail
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
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

      {/* Søgning + sortering */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg efter cocktail..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={sortMode === "alpha" ? "default" : "outline"}
            size="sm"
            onClick={sortAlpha}
            disabled={saveSortM.isPending}
          >
            <ArrowDownAZ className="mr-1 h-4 w-4" />
            Sortér A-Z
          </Button>
          <Button
            variant={sortMode === "rating" ? "default" : "outline"}
            size="sm"
            onClick={sortByRating}
            disabled={saveSortM.isPending}
          >
            <Star className="mr-1 h-4 w-4" />
            Sortér efter rating
          </Button>
          {query && (
            <span className="text-xs text-muted-foreground">
              Træk-og-slip er slået fra mens du søger
            </span>
          )}
        </div>
      </div>

      {visibleList.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-3 py-4 text-sm text-muted-foreground">
          {query ? "Ingen cocktails matcher søgningen." : "Ingen cocktails endnu."}
        </p>
      ) : query ? (
        <div className="flex flex-col gap-3">
          {visibleList.map((c) => (
            <Card
              key={c.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted sm:h-16 sm:w-16">
                {c.image_url && (
                  <AdminImage src={c.image_url} alt={c.name} className="h-full w-full" />
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
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={orderedList.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {orderedList.map((c) => (
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
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        cocktails={(cocktails as CocktailWithDetails[] | undefined) ?? []}
      />
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
      form.tags.includes(t)
        ? form.tags.filter((x) => x !== t)
        : [...form.tags, t],
    );

  function setItem(i: number, p: Partial<Item>) {
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.ingredients.findIndex((i) => i._id === active.id);
    const newIndex = form.ingredients.findIndex((i) => i._id === over.id);
    patch("ingredients", arrayMove(form.ingredients, oldIndex, newIndex));
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchImage = useServerFn(fetchCocktailDbImage);
  const [fetchingImg, setFetchingImg] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  async function handleFetchImage() {
    if (!form.name.trim()) return toast.error("Indtast cocktailnavn først");
    setFetchingImg(true);
    try {
      const r = await fetchImage({ data: { name: form.name.trim() } });
      if (r.image) patch("image_url", r.image);
      else toast.error("Ingen billede fundet på CocktailDB");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFetchingImg(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Kun billedfiler er tilladt"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Filen er for stor — maks 10 MB"); return; }
    setUploadingImg(true);
    try {
      const compressed = await compressImage(file);
      // Bevar .png (og dermed gennemsigtighed) hvis compressImage returnerede en PNG.
      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const fileName = `cocktail_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("cocktail-images")
        .upload(fileName, compressed, { upsert: false, contentType: compressed.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("cocktail-images").getPublicUrl(fileName);
      patch("image_url", urlData.publicUrl);
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
      {/* Navn */}
      <div>
        <Label>Navn</Label>
        <Input value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Cocktailnavn" />
      </div>

      {/* Beskrivelse */}
      <div>
        <Label>Beskrivelse</Label>
        <Textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={2} placeholder="Kort beskrivelse..." />
      </div>

      {/* Billede */}
      <div>
        <Label>Billede-URL</Label>
        <div className="flex gap-2">
          <Input value={form.image_url} onChange={(e) => patch("image_url", e.target.value)} placeholder="https://..." />
          <Button type="button" variant="outline" size="sm" onClick={handleFetchImage} disabled={fetchingImg}>
            <ImageDown className="mr-1 h-4 w-4" />
            {fetchingImg ? "Henter…" : "CocktailDB"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}>
            <Upload className="mr-1 h-4 w-4" />
            {uploadingImg ? "Uploader…" : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
        {form.image_url && (
          <div className="relative mt-2">
            <AdminImage src={form.image_url} alt="Preview" className="h-32 w-full rounded" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 opacity-90"
              onClick={() => patch("image_url", "")}
              aria-label="Fjern billede"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Glas */}
      <div>
        <Label>Glas</Label>
        <Input list="glass-names" value={form.glass} onChange={(e) => patch("glass", e.target.value)} placeholder="f.eks. Martini-glas" />
        <datalist id="glass-names">
          {glassNames.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>

      {/* Pynt */}
      <div>
        <Label>Pynt</Label>
        <Input list="garnish-names" value={form.garnish} onChange={(e) => patch("garnish", e.target.value)} placeholder="f.eks. Citronskive" />
        <datalist id="garnish-names">
          {garnishNames.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>

      {/* Tags */}
      {tagNames.length > 0 && (
        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1 pt-1">
            {tagNames.map((t) => (
              <Badge
                key={t}
                variant={form.tags.includes(t) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(t)}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ingredienser */}
      <div>
        <Label>Ingredienser</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={form.ingredients.map((i) => i._id)} strategy={verticalListSortingStrategy}>
            <div className="mt-1 flex flex-col gap-2">
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

      {/* Fremgangsmåde */}
      <div>
        <Label>Fremgangsmåde</Label>
        <Textarea
          value={form.instructions}
          onChange={(e) => patch("instructions", e.target.value)}
          rows={4}
          placeholder="Beskriv hvordan cocktailen laves..."
        />
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

  function sanitizeAmount(raw: string): string {
    let val = raw.replace(/[^0-9.,]/g, "");
    val = val.replace(/\./g, ",");
    const parts = val.split(",");
    if (parts.length > 2) val = parts[0] + "," + parts.slice(1).join("");
    return val;
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Træk for at ændre rækkefølge"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        list="ingredient-names"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Ingrediens"
        className="flex-1"
      />
      <datalist id="ingredient-names">
        {ingredientNames.map((n) => <option key={n} value={n} />)}
      </datalist>
      <Input
        value={item.amount}
        onChange={(e) => onChange({ amount: sanitizeAmount(e.target.value) })}
        placeholder="Mængde"
        className="w-20"
      />
      <Select value={item.unit} onValueChange={(v) => onChange({ unit: v })}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
