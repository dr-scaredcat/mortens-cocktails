import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, type CategoryRow } from "@/lib/cocktails.functions";
import { upsertCategory, deleteCategory, reorderCategories } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X, GripVertical, ArrowDownAZ } from "lucide-react";
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

function SortableCategory({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
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
      <span className="flex-1">{category.name}</span>
      <Button size="icon" variant="ghost" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

export function AdminCategories() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCategories);
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const reorder = useServerFn(reorderCategories);

  const { data: serverCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchList(),
  });

  const [localCategories, setLocalCategories] = useState<CategoryRow[] | null>(null);
  const categories = localCategories ?? serverCategories ?? [];

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOld, setEditOld] = useState("");

  const invalidate = () => {
    setLocalCategories(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const reorderM = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      setLocalCategories(null);
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
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setLocalCategories(reordered);
    reorderM.mutate(reordered.map((c) => c.id));
  }

  function sortAlpha() {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, "da"));
    setLocalCategories(sorted);
    reorderM.mutate(sorted.map((c) => c.id));
  }

  const addM = useMutation({
    mutationFn: (n: string) => upsert({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Kategori tilføjet");
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
        <h3 className="mb-3 font-medium">Tilføj kategori</h3>
        <div className="flex gap-2">
          <Input
            placeholder="fx Bobler"
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
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {categories.length === 0 && (
              <li className="px-3 py-4 text-sm text-muted-foreground">
                Ingen kategorier endnu — tilføj en ovenfor.
              </li>
            )}
            {categories.map((c) =>
              editingId === c.id ? (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="w-4 shrink-0" />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        editM.mutate({ id: c.id, name: editName.trim(), oldName: editOld });
                    }}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      editM.mutate({ id: c.id, name: editName.trim(), oldName: editOld })
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
                <SortableCategory
                  key={c.id}
                  category={c}
                  onEdit={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                    setEditOld(c.name);
                  }}
                  onDelete={() => {
                    if (
                      confirm(
                        `Slet "${c.name}"? Ingredienser i denne kategori flyttes til "Andet".`,
                      )
                    )
                      delM.mutate({ id: c.id, name: c.name });
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
