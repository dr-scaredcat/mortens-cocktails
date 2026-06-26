import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTags, type TagRow, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { upsertTag, deleteTag, reorderTags } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X, GripVertical, ArrowDownAZ, TrendingDown } from "lucide-react";
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

function SortableTag({
  tag,
  onEdit,
  onDelete,
}: {
  tag: TagRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Træk for at ændre rækkefølge"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1">{tag.name}</span>
      <Button size="icon" variant="ghost" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

export function AdminTags() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listTags);
  const upsert = useServerFn(upsertTag);
  const del = useServerFn(deleteTag);
  const reorder = useServerFn(reorderTags);

  const { data: serverTags } = useQuery({ queryKey: ["tags"], queryFn: () => fetchList() });

  // Lokal optimistisk rækkefølge — nulstilles når serveren svarer
  const [localTags, setLocalTags] = useState<TagRow[] | null>(null);
  const tags = localTags ?? serverTags ?? [];

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOld, setEditOld] = useState("");

  const invalidate = () => {
    setLocalTags(null);
    qc.invalidateQueries({ queryKey: ["tags"] });
    qc.invalidateQueries({ queryKey: ["cocktails"] });
  };

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      setLocalTags(null);
      toast.error(e.message);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tags, oldIndex, newIndex);
    setLocalTags(reordered);
    reorderM.mutate(reordered.map((t) => t.id));
  }

  function sortAlpha() {
    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name, "da"));
    setLocalTags(sorted);
    reorderM.mutate(sorted.map((t) => t.id));
  }

  function sortByPopularity() {
    // Tæl brugen af hvert tag fra den allerede cachede cocktail-liste
    const cocktails = (qc.getQueryData<CocktailWithDetails[]>(["cocktails"])) ?? [];
    const counts = new Map<string, number>();
    for (const c of cocktails) {
      for (const tag of c.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const sorted = [...tags].sort(
      (a, b) => (counts.get(b.name) ?? 0) - (counts.get(a.name) ?? 0),
    );
    setLocalTags(sorted);
    reorderM.mutate(sorted.map((t) => t.id));
  }

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
          <Input
            placeholder="fx jule"
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

      <div className="flex gap-2">
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
          onClick={sortByPopularity}
          disabled={reorderM.isPending}
        >
          <TrendingDown className="mr-1 h-4 w-4" />
          Sortér efter popularitet
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {tags.length === 0 && (
              <li className="px-3 py-4 text-sm text-muted-foreground">
                Ingen tags endnu — tilføj et ovenfor.
              </li>
            )}
            {tags.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                  {/* Placeholder så bredden matcher grip-ikonet */}
                  <div className="w-4 shrink-0" />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        editM.mutate({ id: t.id, name: editName.trim(), oldName: editOld });
                    }}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      editM.mutate({ id: t.id, name: editName.trim(), oldName: editOld })
                    }
                    disabled={editM.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ) : (
                <SortableTag
                  key={t.id}
                  tag={t}
                  onEdit={() => {
                    setEditingId(t.id);
                    setEditName(t.name);
                    setEditOld(t.name);
                  }}
                  onDelete={() => {
                    if (confirm(`Slet "${t.name}"? Det fjernes fra alle cocktails.`))
                      delM.mutate({ id: t.id, name: t.name });
                  }}
                />
              ),
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
