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
import { lazy, Suspense, useState } from "react";
import { isAdmin } from "@/lib/admin.functions";
import { AdminCocktails } from "@/components/app/admin-cocktails";
import { AdminRecipes } from "@/components/app/admin-recipes";
import { AdminTags } from "@/components/app/admin-tags";
import { AdminSettings } from "@/components/app/admin-settings";
import { AdminMenukort } from "@/components/app/admin-menukort";
import { AdminGlasses } from "@/components/app/admin-glasses";
import { AdminGarnishes } from "@/components/app/admin-garnishes";
import { AdminIngredientsSection } from "@/components/app/admin-ingredients-section";
import { AdminSpiritsSection } from "@/components/app/admin-spirits-section";

// Statistik-fanen trækker recharts ind, som er et tungt bibliotek. Vi lazy-loader
// den, så recharts først hentes når admin faktisk åbner fanen — og aldrig ender i
// den bundle andre sider (fx gæstesiderne) downloader.
const AdminStatistik = lazy(() =>
  import("@/components/app/admin-statistik").then((m) => ({ default: m.AdminStatistik })),
);

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Aston's Bar" }] }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(isAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });
  const [tab, setTab] = useState("menukort");

  const TABS = [
    { value: "menukort",    label: "Menukort" },
    { value: "cocktails",   label: "Cocktails" },
    { value: "opskrifter",  label: "Opskrifter" },
    { value: "spiritus",    label: "Spiritus" },
    { value: "ingredients", label: "Ingredienser" },
    { value: "tags",        label: "Tags" },
    { value: "glasses",     label: "Glas" },
    { value: "garnishes",   label: "Pynt" },
    { value: "statistik",   label: "Statistik" },
    { value: "settings",    label: "Indstillinger" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Admin</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Administrér ingredienser, cocktails og opskrifter.
        </p>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : !data?.isAdmin ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
            Din konto har ikke administratorrettigheder.
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <div className="mb-6">
              <Select value={tab} onValueChange={setTab}>
                <SelectTrigger className="w-full sm:w-56">
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
            </div>

            <TabsContent value="menukort">
              <AdminMenukort />
            </TabsContent>
            <TabsContent value="cocktails">
              <AdminCocktails />
            </TabsContent>
            <TabsContent value="opskrifter">
              <AdminRecipes />
            </TabsContent>
            <TabsContent value="spiritus">
              <AdminSpiritsSection />
            </TabsContent>
            <TabsContent value="ingredients">
              <AdminIngredientsSection />
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
            <TabsContent value="statistik">
              <Suspense
                fallback={<p className="text-muted-foreground">Indlæser statistik…</p>}
              >
                <AdminStatistik />
              </Suspense>
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
