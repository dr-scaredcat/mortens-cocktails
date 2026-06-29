import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSpirits, listSpiritTypes, type SpiritWithDetails } from "@/lib/spirits.functions";
import {
  upsertSpirit,
  deleteSpirit,
  reorderSpirits,
  resetSpiritRating,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, ArrowDownAZ, Star, Upload, Search } from "lucide-react";
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
import { getSpiritSort, setSpiritSort, type SortMode } from "@/lib/sort-settings.functions";

const NO_TYPE = "__none__";

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: "",
    description: "",
    image_url: "",
    spiritType: "",
  };
}

function SortableSpiritRow({
  spirit,
  onEdit,
  onDelete,
}: {
  spirit: SpiritWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spirit.id,
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
        {spirit.image_url && (
          <img src={spirit.image_url} alt={spirit.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{spirit.name}</span>
          {!spirit.available && (
            <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
              ikke tilgængelig
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {spirit.spirit_type ?? "Ingen type"}
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

export function AdminSpirits() {
  const qc = useQueryClient();
  const fetchSpirits = useServerFn(listSpirits);
  const fetchTypes = useServerFn(listSpiritTypes);
  const save = useServerFn(upsertSpirit);
  const del = useServerFn(deleteSpirit);
  const reorder = useServerFn(reorderSpirits);
  const resetRating = useServerFn(resetSpiritRating);
  const fetchSort = useServerFn(getSpiritSort);
  const saveSort = useServerFn(setSpiritSort);

  const { data: spirits } = useQuery({ queryKey: ["spirits"], queryFn: () => fetchSpirits() });
  const { data: types } = useQuery({ queryKey: ["spirit-types"], queryFn: () => fetchTypes() });
  const { data: sortData } = useQuery({ queryKey: ["spirits-sort"], queryFn: () => fetchSort() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [localOrder, setLocalOrder] = useState<SpiritWithDetails[] | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sortChoice, setSortChoice] = useState<SortMode | null>(null);
  const sortMode: SortMode = sortChoice ?? sortData?.mode ?? "manual";

  // alpha/rating beregnes klientside; manual = serverens position-rækkefølge.
  const sortedList = useMemo(() => {
    const list = (spirits as SpiritWithDetails[] | undefined) ?? [];
    if (sortMode === "alpha") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "da"));
    }
    if (sortMode === "rating") {
      return [...list].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    }
    return list;
  }, [spirits, sortMode]);

  const orderedList = localOrder ?? sortedList;

  const query = search.trim().toLowerCase();
  const visibleList = query
    ? orderedList.filter((s) => s.name.toLowerCase().includes(query))
    : orderedList;

  const invalidate = () => {
    setLocalOrder(null);
    qc.invalidateQueries({ queryKey: ["spirits"] });
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const saveM = useMutation({
    mutationFn: (payload: ReturnType<typeof emptyForm>) =>
      save({
        data: {
          id: payload.id,
          name: payload.name.trim(),
          description: payload.description.trim() || null,
          image_url: payload.image_url || null,
          spiritType: payload.spiritType || null,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      invalidate();
      toast.success(form.id ? "Spiritus gemt" : "Spiritus oprettet");
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

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      setLocalOrder(null);
      toast.error(e.message);
    },
  });

  const saveSortM = useMutation({
    mutationFn: (mode: SortMode) => saveSort({ data: { mode } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spirits-sort"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const resetRatingM = useMutation({
    mutationFn: (id: string) => resetRating({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spirits"] });
      toast.success("Rating nulstillet");
    },
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
    const oldIndex = orderedList.findIndex((s) => s.id === active.id);
    const newIndex = orderedList.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(orderedList, oldIndex, newIndex);
    setLocalOrder(reordered);
    reorderM.mutate(reordered.map((s) => s.id));
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

  function openEdit(s: SpiritWithDetails) {
    setForm({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      image_url: s.image_url ?? "",
      spiritType: s.spirit_type ?? "",
    });
    setOpen(true);
  }

  const patch = (key: keyof ReturnType<typeof emptyForm>, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  function submit() {
    if (!form.name.trim()) return toast.error("Navn mangler");
    saveM.mutate(form);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Kun billedfiler er tilladt");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen er for stor — maks 10 MB");
      return;
    }
    setUploadingImg(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `spirit_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("cocktail-images")
        .upload(fileName, file, { upsert: false, contentType: file.type });
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

  const typeNames = (types ?? []).map((t) => t.name);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Ny spiritus
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{form.id ? "Rediger spiritus" : "Ny spiritus"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Navn */}
              <div>
                <Label>Navn</Label>
                <Input
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="fx Tanqueray London Dry Gin"
                />
              </div>

              {/* Beskrivelse */}
              <div>
                <Label>Beskrivelse</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => patch("description", e.target.value)}
                  rows={3}
                  placeholder="Kort beskrivelse..."
                />
              </div>

              {/* Billede */}
              <div>
                <Label>Billede-URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.image_url}
                    onChange={(e) => patch("image_url", e.target.value)}
                    placeholder="https://..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {uploadingImg ? "Uploader…" : "Upload"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="mt-2 h-32 w-full rounded object-cover"
                  />
                )}
              </div>

              {/* Spiritus type */}
              <div>
                <Label>Spiritus type</Label>
                <Select
                  value={form.spiritType || NO_TYPE}
                  onValueChange={(v) => patch("spiritType", v === NO_TYPE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TYPE}>Ingen type</SelectItem>
                    {typeNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeNames.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ingen typer endnu — opret dem under "Spiritus typer".
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              {form.id && (
                <Button
                  variant="outline"
                  className="mr-auto"
                  onClick={() => {
                    if (confirm(`Nulstil alle vurderinger for ${form.name}?`)) {
                      resetRatingM.mutate(form.id!);
                    }
                  }}
                  disabled={resetRatingM.isPending}
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
            placeholder="Søg efter spiritus..."
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
          {query ? "Ingen spiritus matcher søgningen." : 'Ingen spiritus endnu — opret en med "Ny spiritus".'}
        </p>
      ) : query ? (
        <div className="flex flex-col gap-3">
          {visibleList.map((s) => (
            <Card
              key={s.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted sm:h-16 sm:w-16">
                {s.image_url && (
                  <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  {!s.available && (
                    <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                      ikke tilgængelig
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.spirit_type ?? "Ingen type"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Slet ${s.name}?`)) delM.mutate(s.id);
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
          <SortableContext items={orderedList.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {orderedList.map((s) => (
                <SortableSpiritRow
                  key={s.id}
                  spirit={s}
                  onEdit={() => openEdit(s)}
                  onDelete={() => {
                    if (confirm(`Slet ${s.name}?`)) delM.mutate(s.id);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
