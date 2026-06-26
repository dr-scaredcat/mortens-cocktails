import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/alle")({
  beforeLoad: () => {
    throw redirect({ to: "/cocktails", search: { tab: "alle" } });
  },
  component: () => null,
});
