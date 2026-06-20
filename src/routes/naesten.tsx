import { createFileRoute } from "@tanstack/react-router";
import { CocktailListPage } from "@/components/app/cocktail-list-page";

export const Route = createFileRoute("/naesten")({
  head: () => ({
    meta: [
      { title: "Næsten klar — Barskab" },
      { name: "description", content: "Cocktails du næsten kan lave – kun én ingrediens mangler." },
    ],
  }),
  component: () => (
    <CocktailListPage
      title="Næsten klar"
      subtitle="Cocktails der mangler præcis én ingrediens."
      mode="almost"
    />
  ),
});