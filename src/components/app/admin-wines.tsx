import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listWines,
  getWineFridgeLayout,
  WINE_TYPE_ORDER,
  DEFAULT_WINE_FRIDGE_LAYOUT,
  type WineWithDetails,
  type WineFridgeLayout,
} from "@/lib/wines.functions";
import { upsertWine, deleteWine, saveWineFridgeLayout } from "@/lib/wines-admin.functions";
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
  DialogDescription,
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
import { Plus, Pencil, Trash2, Upload, Search, Minus, MapPin } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { AdminImage } from "@/components/app/admin-image";
import { WineFridge, WineFridgeLegend, type FridgePosition } from "@/components/app/wine-fridge";

// ── Formular-hjælpere ──────────────────────────────────────────────────────
// Tal holdes som tekst i formularen, så felterne kan stå tomme uden at blive
// til 0. Komma accepteres som decimaltegn (dansk tastatur).

function numOrNull(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value: string): number | null {
  const n = numOrNull(value);
  return n === null ? null : Math.round(n);
}

/** Vis et tal i formularen med komma som decimaltegn. */
function toInput(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

function emptyForm() {
  return {
    id: undefined as string | undefined,
    name: "",
    producer: "",
    vintage: "",
    country: "",
    region: "",
    grapes: "",
    wineType: "" as string,
    abv: "",
    bottleSizeCl: "75",
    price: "",
    drinkFrom: "",
    drinkTo: "",
    quantity: "1",
    shelf: null as number | null,
    slot: null as number | null,
    imageUrl: "",
    description: "",
    tastingNotes: "",
    foodPairing: "",
    servingTemp: "",
  };
}

type WineForm = ReturnType<typeof emptyForm>;

/** Læsbar placering, fx "Hylde 2, plads 3". */
function placementLabel(shelf: number | null, slot: number | null): string {
  if (shelf === null || slot === null) return "Ikke placeret";
  return `Hylde ${shelf}, plads ${slot}`;
}

// ── Én række i vinlisten ───────────────────────────────────────────────────
function WineRow({
  wine,
  onEdit,
  onDelete,
}: {
  wine: WineWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const placed = wine.shelf !== null && wine.slot !== null;
  return (
    <Card className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted sm:h-16 sm:w-16">
        {wine.image_url && (
          <AdminImage src={wine.image_url} alt={wine.name} className="h-full w-full" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{wine.name}</span>
          {wine.vintage && (
            <span className="shrink-0 text-sm text-muted-foreground">{wine.vintage}</span>
          )}
          <Badge variant="outline" className="shrink-0 text-xs">
            {wine.wine_type}
          </Badge>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {wine.quantity} {wine.quantity === 1 ? "flaske" : "flasker"}
          </Badge>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {wine.producer ? `${wine.producer} · ` : ""}
          <span className={placed ? "" : "italic"}>
            {placementLabel(wine.shelf, wine.slot)}
          </span>
        </div>
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
export function AdminWines() {
  const qc = useQueryClient();
  const fetchWines = useServerFn(listWines);
  const fetchLayout = useServerFn(getWineFridgeLayout);
  const save = useServerFn(upsertWine);
  const del = useServerFn(deleteWine);
  const saveLayout = useServerFn(saveWineFridgeLayout);

  const { data: wines } = useQuery({ queryKey: ["wines"], queryFn: () => fetchWines() });
  const { data: layout } = useQuery({
    queryKey: ["wine-fridge-layout"],
    queryFn: () => fetchLayout(),
  });

  const wineList = (wines ?? []) as WineWithDetails[];
  const activeLayout: WineFridgeLayout = layout ?? DEFAULT_WINE_FRIDGE_LAYOUT;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WineForm>(emptyForm());
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<WineWithDetails | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = <K extends keyof WineForm>(key: K, val: WineForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // ── Søgning + typefiltre ────────────────────────────────────────────────
  const query = search.trim().toLowerCase();

  const searchPool = useMemo(() => {
    if (!query) return wineList;
    return wineList.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        (w.producer ?? "").toLowerCase().includes(query) ||
        (w.region ?? "").toLowerCase().includes(query) ||
        (w.grapes ?? "").toLowerCase().includes(query),
    );
  }, [wineList, query]);

  const countByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of searchPool) m.set(w.wine_type, (m.get(w.wine_type) ?? 0) + 1);
    return m;
  }, [searchPool]);

  const visibleList = useMemo(() => {
    if (selectedTypes.length === 0) return searchPool;
    return searchPool.filter((w) => selectedTypes.includes(w.wine_type));
  }, [searchPool, selectedTypes]);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  // ── Mutationer ──────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wines"] });
    qc.invalidateQueries({ queryKey: ["wine-fridge-layout"] });
  };

  const saveM = useMutation({
    mutationFn: (payload: WineForm) =>
      save({
        data: {
          id: payload.id,
          name: payload.name.trim(),
          producer: payload.producer.trim() || null,
          vintage: intOrNull(payload.vintage),
          country: payload.country.trim() || null,
          region: payload.region.trim() || null,
          grapes: payload.grapes.trim() || null,
          wineType: payload.wineType as (typeof WINE_TYPE_ORDER)[number],
          abv: numOrNull(payload.abv),
          bottleSizeCl: intOrNull(payload.bottleSizeCl) ?? 75,
          price: numOrNull(payload.price),
          drinkFrom: intOrNull(payload.drinkFrom),
          drinkTo: intOrNull(payload.drinkTo),
          quantity: intOrNull(payload.quantity) ?? 1,
          shelf: payload.shelf,
          slot: payload.slot,
          imageUrl: payload.imageUrl.trim() || null,
          description: payload.description.trim() || null,
          tastingNotes: payload.tastingNotes.trim() || null,
          foodPairing: payload.foodPairing.trim() || null,
          servingTemp: payload.servingTemp.trim() || null,
        },
      }),
    onSuccess: () => {
      const wasEdit = !!form.id;
      setOpen(false);
      invalidate();
      toast.success(wasEdit ? "Vinen er gemt" : "Vinen er oprettet");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme vinen"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast.success("Vinen er slettet");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke slette vinen"),
  });

  // ── Dialog-håndtering ───────────────────────────────────────────────────
  function openNew() {
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(w: WineWithDetails) {
    setForm({
      id: w.id,
      name: w.name,
      producer: w.producer ?? "",
      vintage: w.vintage !== null ? String(w.vintage) : "",
      country: w.country ?? "",
      region: w.region ?? "",
      grapes: w.grapes ?? "",
      wineType: w.wine_type,
      abv: toInput(w.abv),
      bottleSizeCl: String(w.bottle_size_cl ?? 75),
      price: toInput(w.price),
      drinkFrom: w.drink_from !== null ? String(w.drink_from) : "",
      drinkTo: w.drink_to !== null ? String(w.drink_to) : "",
      quantity: String(w.quantity ?? 1),
      shelf: w.shelf,
      slot: w.slot,
      imageUrl: w.image_url ?? "",
      description: w.description ?? "",
      tastingNotes: w.tasting_notes ?? "",
      foodPairing: w.food_pairing ?? "",
      servingTemp: w.serving_temp ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) return toast.error("Navn mangler");
    if (!form.wineType) return toast.error("Vælg en vintype");
    saveM.mutate(form);
  }

  function selectSlot(pos: FridgePosition) {
    // Tryk på den allerede valgte plads = fravælg den.
    if (form.shelf === pos.shelf && form.slot === pos.slot) {
      setForm((f) => ({ ...f, shelf: null, slot: null }));
      return;
    }
    setForm((f) => ({ ...f, shelf: pos.shelf, slot: pos.slot }));
  }

  // ── Billedupload — samme flow som cocktails/spiritus ─────────────────────
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
      const compressed = await compressImage(file);
      // Bevar .png (og dermed gennemsigtighed) hvis compressImage returnerede en PNG.
      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const fileName = `wine_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("cocktail-images")
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

  const selectedPosition: FridgePosition | null =
    form.shelf !== null && form.slot !== null ? { shelf: form.shelf, slot: form.slot } : null;

  return (
    <div className="space-y-4">
      {/* Ny vin */}
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Ny vin
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{form.id ? "Redigér vin" : "Ny vin"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Navn */}
              <div>
                <Label>Navn *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="fx Rioja Reserva"
                />
              </div>

              {/* Producent + årgang */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div>
                  <Label>Producent</Label>
                  <Input
                    value={form.producer}
                    onChange={(e) => patch("producer", e.target.value)}
                    placeholder="Vingård"
                  />
                </div>
                <div>
                  <Label>Årgang</Label>
                  <Input
                    value={form.vintage}
                    onChange={(e) => patch("vintage", e.target.value)}
                    inputMode="numeric"
                    placeholder="fx 2018"
                  />
                </div>
              </div>

              {/* Land + region */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Land</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => patch("country", e.target.value)}
                    placeholder="fx Spanien"
                  />
                </div>
                <div>
                  <Label>Område</Label>
                  <Input
                    value={form.region}
                    onChange={(e) => patch("region", e.target.value)}
                    placeholder="fx Rioja"
                  />
                </div>
              </div>

              {/* Druer */}
              <div>
                <Label>Druesort(er)</Label>
                <Input
                  value={form.grapes}
                  onChange={(e) => patch("grapes", e.target.value)}
                  placeholder="fx Tempranillo, Garnacha"
                />
              </div>

              {/* Vintype */}
              <div>
                <Label>Vintype *</Label>
                <Select value={form.wineType} onValueChange={(v) => patch("wineType", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg vintype" />
                  </SelectTrigger>
                  <SelectContent>
                    {WINE_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alkohol, flaskestørrelse, antal */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Alkohol (%)</Label>
                  <Input
                    value={form.abv}
                    onChange={(e) => patch("abv", e.target.value)}
                    inputMode="decimal"
                    placeholder="fx 13,5"
                  />
                </div>
                <div>
                  <Label>Flaskestørrelse (cl)</Label>
                  <Input
                    value={form.bottleSizeCl}
                    onChange={(e) => patch("bottleSizeCl", e.target.value)}
                    inputMode="numeric"
                    placeholder="75"
                  />
                </div>
                <div>
                  <Label>Antal flasker</Label>
                  <Input
                    value={form.quantity}
                    onChange={(e) => patch("quantity", e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Pris + drikkevindue */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Indkøbspris (kr.)</Label>
                  <Input
                    value={form.price}
                    onChange={(e) => patch("price", e.target.value)}
                    inputMode="decimal"
                    placeholder="fx 149,95"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Vises kun i admin.</p>
                </div>
                <div>
                  <Label>Drikkes fra (år)</Label>
                  <Input
                    value={form.drinkFrom}
                    onChange={(e) => patch("drinkFrom", e.target.value)}
                    inputMode="numeric"
                    placeholder="fx 2024"
                  />
                </div>
                <div>
                  <Label>Drikkes til (år)</Label>
                  <Input
                    value={form.drinkTo}
                    onChange={(e) => patch("drinkTo", e.target.value)}
                    inputMode="numeric"
                    placeholder="fx 2030"
                  />
                </div>
              </div>

              {/* Etiket-foto */}
              <div>
                <Label>Etiket-foto (URL)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => patch("imageUrl", e.target.value)}
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
                {form.imageUrl && (
                  <div className="relative mt-2">
                    <AdminImage src={form.imageUrl} alt="Preview" className="h-32 w-full rounded" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7 opacity-90"
                      onClick={() => patch("imageUrl", "")}
                      aria-label="Fjern billede"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Beskrivelse (gæstevendt) */}
              <div>
                <Label>Beskrivelse (vises for gæster)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => patch("description", e.target.value)}
                  rows={2}
                  placeholder="Kort beskrivelse..."
                />
              </div>

              {/* Smagsnoter */}
              <div>
                <Label>Smagsnoter</Label>
                <Textarea
                  value={form.tastingNotes}
                  onChange={(e) => patch("tastingNotes", e.target.value)}
                  rows={3}
                  placeholder="Mine noter — vises for gæster i detaljevisningen..."
                />
              </div>

              {/* Serveringsforslag + temperatur */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Serveringsforslag</Label>
                  <Input
                    value={form.foodPairing}
                    onChange={(e) => patch("foodPairing", e.target.value)}
                    placeholder="fx Lam, modne oste"
                  />
                </div>
                <div>
                  <Label>Serveringstemperatur</Label>
                  <Input
                    value={form.servingTemp}
                    onChange={(e) => patch("servingTemp", e.target.value)}
                    placeholder="fx 16–18 °C"
                  />
                </div>
              </div>

              {/* Placering i køleskabet */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Placering i vinkøleskabet</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {placementLabel(form.shelf, form.slot)}
                    </span>
                    {form.shelf !== null && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, shelf: null, slot: null }))}
                      >
                        Fjern placering
                      </Button>
                    )}
                  </div>
                </div>
                <WineFridge
                  mode="admin-vaelger"
                  wines={wineList}
                  layout={activeLayout}
                  selected={selectedPosition}
                  currentWineId={form.id ?? null}
                  onSelectSlot={selectSlot}
                />
                <WineFridgeLegend />
                <p className="text-xs text-muted-foreground">
                  Optagne pladser kan ikke vælges. Tryk på den valgte plads igen for at fjerne
                  placeringen.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annullér
              </Button>
              <Button onClick={submit} disabled={saveM.isPending}>
                {saveM.isPending ? "Gemmer…" : "Gem"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Søgning + typefiltre */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg efter navn, producent, område eller drue..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {WINE_TYPE_ORDER.map((t) => {
            const count = countByType.get(t) ?? 0;
            const active = selectedTypes.includes(t);
            if (count === 0 && !active) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      {visibleList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          {query || selectedTypes.length > 0
            ? "Ingen vine matcher søgningen."
            : "Ingen vine endnu — opret den første med “Ny vin”."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleList.map((w) => (
            <WineRow
              key={w.id}
              wine={w}
              onEdit={() => openEdit(w)}
              onDelete={() => setDeleteTarget(w)}
            />
          ))}
        </div>
      )}

      {/* Køleskabs-layout */}
      <FridgeLayoutEditor
        wines={wineList}
        layout={activeLayout}
        onSave={async (draft) => {
          const result = await saveLayout({ data: draft });
          qc.invalidateQueries({ queryKey: ["wine-fridge-layout"] });
          qc.invalidateQueries({ queryKey: ["wines"] });
          if (result.affectedWines.length > 0) {
            toast.warning(
              `Layoutet er gemt. Disse vine mistede deres plads: ${result.affectedWines.join(", ")}`,
            );
          } else {
            toast.success("Køleskabets layout er gemt");
          }
        }}
      />

      {/* Bekræft sletning */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Slet vin</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette <strong>{deleteTarget?.name}</strong>? Handlingen kan
              ikke fortrydes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={delM.isPending}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && delM.mutate(deleteTarget.id)}
              disabled={delM.isPending}
            >
              {delM.isPending ? "Sletter…" : "Slet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Layout-editor ──────────────────────────────────────────────────────────
// Justér antal hylder og pladser pr. hylde. Ændringer holdes lokalt indtil
// der trykkes Gem, så man kan nå at fortryde inden vine mister deres plads.

const MAX_SHELVES = 15;
const MAX_SLOTS = 20;

function FridgeLayoutEditor({
  wines,
  layout,
  onSave,
}: {
  wines: WineWithDetails[];
  layout: WineFridgeLayout;
  onSave: (draft: WineFridgeLayout) => Promise<void>;
}) {
  const [draft, setDraft] = useState<WineFridgeLayout>(layout);
  const [busy, setBusy] = useState(false);

  // Følg serverens layout indtil brugeren begynder at ændre i det.
  useEffect(() => {
    setDraft(layout);
  }, [layout]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(layout);

  function addShelf() {
    if (draft.shelves.length >= MAX_SHELVES) return;
    // Ny hylde arver kapaciteten fra den nederste hylde.
    const last = draft.shelves[draft.shelves.length - 1]?.slots ?? 5;
    setDraft({ shelves: [...draft.shelves, { slots: last }] });
  }

  function removeShelf() {
    if (draft.shelves.length <= 1) return;
    setDraft({ shelves: draft.shelves.slice(0, -1) });
  }

  function changeSlots(index: number, delta: number) {
    setDraft({
      shelves: draft.shelves.map((s, i) => {
        if (i !== index) return s;
        const next = Math.min(MAX_SLOTS, Math.max(1, s.slots + delta));
        return { slots: next };
      }),
    });
  }

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(draft);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme layoutet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
        <MapPin className="h-4 w-4" />
        Køleskab
      </h2>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Justér antal hylder og pladser pr. hylde, så det passer til dit vinkøleskab. Hvis en vin
          havner uden for det nye layout, mister den sin placering.
        </p>

        {/* Hylder */}
        <div className="space-y-2">
          {draft.shelves.map((shelf, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm text-muted-foreground">Hylde {i + 1}</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => changeSlots(i, -1)}
                  disabled={shelf.slots <= 1}
                  aria-label={`Færre pladser på hylde ${i + 1}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-20 text-center text-sm tabular-nums">
                  {shelf.slots} {shelf.slots === 1 ? "plads" : "pladser"}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => changeSlots(i, 1)}
                  disabled={shelf.slots >= MAX_SLOTS}
                  aria-label={`Flere pladser på hylde ${i + 1}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Tilføj/fjern hylde */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addShelf}
            disabled={draft.shelves.length >= MAX_SHELVES}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tilføj hylde
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeShelf}
            disabled={draft.shelves.length <= 1}
          >
            <Minus className="mr-1 h-4 w-4" />
            Fjern nederste hylde
          </Button>
        </div>

        {/* Live-preview */}
        <div className="space-y-2">
          <Label className="text-sm">Forhåndsvisning</Label>
          <WineFridge mode="gæst" wines={wines} layout={draft} />
          <WineFridgeLegend />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={busy || !dirty}>
            {busy ? "Gemmer…" : "Gem layout"}
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => setDraft(layout)}
              disabled={busy}
            >
              Fortryd ændringer
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}
