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
import { AdminTags } from "@/components/app/admin-tags";
import { AdminSettings } from "@/components/app/admin-settings";
import { AdminMenukort } from "@/components/app/admin-menukort";
import { AdminGlasses } from "@/components/app/admin-glasses";
import { AdminGarnishes } from "@/components/app/admin-garnishes";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Barskab" }] }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(isAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });
  const [tab, setTab] = useState("menukort");

  const TABS = [
    { value: "menukort",     label: "Menukort" },
    { value: "cocktails",    label: "Cocktails" },
    { value: "ingredients",  label: "Ingredienser" },
    { value: "tags",         label: "Tags" },
    { value: "glasses",      label: "Glas" },
    { value: "garnishes",    label: "Pynt" },
    { value: "settings",     label: "Indstillinger" },
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
              <SelectTrigger className="mb-6 w-52">
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

            <TabsContent value="menukort">
              <AdminMenukort />
            </TabsContent>
            <TabsContent value="cocktails">
              <AdminCocktails />
            </TabsContent>
            <TabsContent value="ingredients">
              <AdminIngredients />
            </TabsContent>
            <TabsContent value="tags">
              <AdminTags />
            </TabsContent>
            <TabsContent value="glasses">
              <AdminGlasses />
            </TabsContent>
            <TabsContent value="garnishes">
              <AdminGarnishes />
            </TabsContent>
            <TabsContent value="settings">
              <AdminSettings />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
