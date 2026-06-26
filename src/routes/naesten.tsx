import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/naesten")({
  beforeLoad: () => {
    throw redirect({ to: "/cocktails", search: { tab: "naesten" } });
  },
  component: () => null,
});
