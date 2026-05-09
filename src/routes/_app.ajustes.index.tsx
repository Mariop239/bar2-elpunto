import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ajustes/")({
  beforeLoad: () => { throw redirect({ to: "/ajustes/catalogo" }); },
});
