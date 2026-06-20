import { createFileRoute } from "@tanstack/react-router";
import { CocktailListPage } from "@/components/app/cocktail-list-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klar at lave — Barskab" },
      { name: "description", content: "Cocktails du kan lave med dine nuværende ingredienser." },
    ],
  }),
  component: () => (
    <CocktailListPage
      title="Klar at lave"
      subtitle="Cocktails hvor du har alle ingredienser i barskabet."
      mode="ready"
    />
  ),
});
