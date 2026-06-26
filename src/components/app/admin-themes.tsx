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

// Single state object ensures theme and open flag always update atomically
type EditorState = { open: false } | { open: true; theme: Theme | null };

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

  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);

  const themes = data?.themes ?? [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME];
  const activeThemeId = data?.activeThemeId ?? "built-in-light";

  const saveMutation = useMutation({
    mutationFn: (theme: Theme) => saveFn({ data: theme }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      setEditor({ open: false });
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
    setEditor({ open: true, theme: null });
  }

  function openEdit(theme: Theme) {
    setEditor({ open: true, theme });
  }

  function handleDelete(theme: Theme) {
    if (
      !confirm(
        `Slet temaet "${theme.name}"?${theme.id === activeThemeId ? " Det aktive tema vil nulstilles til det første tilgængelige." : ""}`,
      )
    )
      return;
    deleteMutation.mutate(theme.id);
  }

  const previewTheme = previewThemeId
    ? themes.find((t) => t.id === previewThemeId) ?? null
    : null;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Indlæser temaer…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Temaer</h2>
          <p className="text-sm text-muted-foreground">
            Tilpas udseendet af din app med farvetemaer.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nyt tema
        </Button>
      </div>

      {themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen temaer endnu.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => {
            const isActive = theme.id === activeThemeId;
            return (
              <Card
                key={theme.id}
                className={`overflow-hidden transition-shadow hover:shadow-md ${
                  isActive ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
              >
                {/* Mini preview — click to expand */}
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium truncate">{theme.name}</span>
                    {isActive && (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/15 text-xs">
                        Aktiv
                      </Badge>
                    )}
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
                    {!theme.isBuiltIn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(theme)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
        open={editor.open}
        onOpenChange={(o) => { if (!o) setEditor({ open: false }); }}
        initial={editor.open ? editor.theme : null}
        onSave={(theme) => saveMutation.mutate(theme)}
        onReset={
          editor.open && editor.theme?.isBuiltIn
            ? () => {
                const defaultTheme =
                  editor.theme?.id === "built-in-light"
                    ? DEFAULT_LIGHT_THEME
                    : DEFAULT_DARK_THEME;
                saveMutation.mutate(defaultTheme);
              }
            : undefined
        }
      />
    </div>
  );
}
