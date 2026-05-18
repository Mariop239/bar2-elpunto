import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { useEmpleado } from "@/lib/empleado-store";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ajustes")({
  component: AjustesLayout,
});

function AjustesLayout() {
  const empleado = useEmpleado((s) => s.empleado);
  const location = useLocation();

  if (empleado && empleado.rol !== "admin") {
    return <Navigate to="/registro" replace />;
  }

  const tabs = [
    { to: "/ajustes/catalogo", label: "Catálogo" },
    { to: "/ajustes/categorias", label: "Categorías" },
    { to: "/ajustes/empleados", label: "Empleados" },
    { to: "/ajustes/historial", label: "Historial" },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Ajustes</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const active = location.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2 rounded-lg border whitespace-nowrap font-medium",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
