import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tilfoej-naeste")({
  beforeLoad: () => {
    throw redirect({ to: "/ingredienser" });
  },
  component: () => null,
});
