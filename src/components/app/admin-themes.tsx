import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getThemesData,
  saveTheme,
  deleteTheme,
  setActiveTheme,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
} from "@/lib/themes.functions";
import type { Theme } from "@/lib/themes.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeEditor } from "@/components/app/theme-editor";
import { ThemePreview } from "@/components/app/theme-preview";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check } from "lucide-react";

export function AdminThemes() {
  const qc = useQueryClient();
  const fetchThemes = useServerFn(getThemesData);
  const saveFn = useServerFn(saveTheme);
  const deleteFn = useServerFn(deleteTheme);
  const setActiveFn = useServerFn(setActiveTheme);

  const { data, isLoading } = useQuery({
    queryKey: ["themes"],
    queryFn: () => fetchThemes(),
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);

  const themes = data?.themes ?? [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME];
  const activeThemeId = data?.activeThemeId ?? "built-in-light";

  const saveMutation = useMutation({
    mutationFn: (theme: Theme) => saveFn({ data: theme }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      setEditorOpen(false);
      toast.success("Tema gemt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Tema slettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => setActiveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Tema aktiveret — genindlæs siden for at se ændringen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditingTheme(null);
    setEditorOpen(true);
  }

  function openEdit(theme: Theme) {
    setEditingTheme(theme);
    setEditorOpen(true);
  }

  function handleDelete(theme: Theme) {
    if (
      !confirm(
        `Slet temaet "${theme.name}"?${theme.id === activeThemeId ? " Det aktive tema vil nulstilles til Lys." : ""}`,
      )
    )
      return;
    deleteMutation.mutate(theme.id);
  }

  const previewTheme = previewThemeId
    ? themes.find((t) => t.id === previewThemeId)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Vælg et tema for alle brugere, eller opret dit eget. Ændringer træder i
          kraft ved næste sideopdatering.
        </p>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nyt tema
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Indlæser...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => {
            const isActive = theme.id === activeThemeId;
            return (
              <Card
                key={theme.id}
                className={`overflow-hidden transition ${
                  isActive ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
              >
                {/* Mini preview */}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setPreviewThemeId(
                      previewThemeId === theme.id ? null : theme.id,
                    )
                  }
                  title="Klik for at se forhåndsvisning"
                >
                  <div className="pointer-events-none scale-[0.6] origin-top-left w-[167%]">
                    <ThemePreview colors={theme.colors} />
                  </div>
                </button>

                <div className="border-t border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{theme.name}</span>
                        {isActive && (
                          <Badge className="bg-primary/15 text-primary hover:bg-primary/15 text-xs">
                            Aktiv
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1.5 flex-wrap">
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => activateMutation.mutate(theme.id)}
                        disabled={activateMutation.isPending}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Aktivér
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(theme)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(theme)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Expanded preview */}
      {previewTheme && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Forhåndsvisning: {previewTheme.name}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPreviewThemeId(null)}
            >
              Luk
            </Button>
          </div>
          <ThemePreview colors={previewTheme.colors} />
        </div>
      )}

      <ThemeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editingTheme}
        onSave={(theme) => saveMutation.mutate(theme)}
      />
    </div>
  );
}
