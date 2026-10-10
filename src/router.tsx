import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data betragtes som frisk i 60 sekunder. Det betyder at navigation
        // mellem sider ikke udløser et fuldt refetch hver gang — tunge lister
        // som ["cocktails"], ["spirits"], ["recipes"], ["themes"] og
        // ["site-settings"] genbruges direkte fra cachen.
        //
        // Bemærk: dette forhindrer IKKE opdatering ved admin-ændringer, fordi
        // queryClient.invalidateQueries(...) altid markerer data som forældet
        // og refetcher aktive queries uanset staleTime.
        //
        // Bestillings-relaterede queries (["orders"], ["ordering-enabled"])
        // overstyrer selv med staleTime: 0 dér hvor de bruges, så de forbliver
        // friske og altid henter ved fokus/navigation.
        staleTime: 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
