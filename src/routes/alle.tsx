import { createFileRoute } from "@tanstack/react-router";
import { CocktailListPage } from "@/components/app/cocktail-list-page";

export const Route = createFileRoute("/alle")({
  head: () => ({
    meta: [
      { title: "Alle cocktails — Barskab" },
      { name: "description", content: "Hele biblioteket – med markering af manglende ingredienser." },
    ],
  }),
  component: () => (
    <CocktailListPage
      title="Alle cocktails"
      subtitle="Hele biblioteket sorteret efter hvor tæt du er på at kunne lave dem."
      mode="all"
    />
  ),
});