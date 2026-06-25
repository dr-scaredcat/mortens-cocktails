import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { isAdmin } from "@/lib/admin.functions";
import { AdminIngredients } from "@/components/app/admin-ingredients";
import { AdminCocktails } from "@/components/app/admin-cocktails";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminTags } from "@/components/app/admin-tags";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminSettings } from "@/components/app/admin-settings";
import { AdminMenukort } from "@/components/app/admin-menukort";
import { AdminThemes } from "@/components/app/admin-themes";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Barskab" }] }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(isAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });
  const [tab, setTab] = useState("ingredients");
  const TABS = [
    { value: "ingredients", label: "Ingredienser" },
    { value: "cocktails", label: "Cocktails" },
    { value: "menukort", label: "Menukort" },
    { value: "categories", label: "Kategorier" },
    { value: "tags", label: "Tags" },
    { value: "users", label: "Brugere" },
    { value: "settings", label: "Indstillinger" },
    { value: "themes", label: "Temaer" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Admin</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Administrér ingredienser og cocktails.
        </p>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : !data?.isAdmin ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
            Din konto har ikke administratorrettigheder.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsContent value="ingredients" className="mt-4">
              <AdminIngredients />
            </TabsContent>
            <TabsContent value="cocktails" className="mt-4">
              <AdminCocktails />
            </TabsContent>
            <TabsContent value="menukort" className="mt-4">
              <AdminMenukort />
            </TabsContent>
            <TabsContent value="categories" className="mt-4">
              <AdminCategories />
            </TabsContent>
            <TabsContent value="tags" className="mt-4">
              <AdminTags />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
              <AdminUsers />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <AdminSettings />
            </TabsContent>
            <TabsContent value="themes" className="mt-4">
              <AdminThemes />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
