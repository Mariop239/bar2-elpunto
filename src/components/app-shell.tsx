import { Link, useLocation } from "@tanstack/react-router";
import { Home, ClipboardList, Wallet, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpleado } from "@/lib/empleado-store";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/registro", label: "Registro", icon: ClipboardList },
  { to: "/deudores", label: "Fiados", icon: Wallet },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const empleado = useEmpleado((s) => s.empleado);
  const logoutEmp = useEmpleado((s) => s.logout);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar (tablet/desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar border-r border-sidebar-border p-4 gap-2">
        <div className="px-2 py-4">
          <h1 className="text-xl font-bold text-sidebar-foreground">El Punto</h1>
          <p className="text-xs text-muted-foreground">Gestión Financiera</p>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 rounded-lg bg-sidebar-accent">
          <p className="text-xs text-muted-foreground">En turno</p>
          <p className="font-semibold text-sidebar-foreground">{empleado?.nombre}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{empleado?.rol}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            onClick={logoutEmp}
          >
            <LogOut className="h-4 w-4 mr-2" /> Cerrar Turno
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
        <div>
          <h1 className="text-lg font-bold">El Punto</h1>
          <p className="text-xs text-muted-foreground">{empleado?.nombre} · {empleado?.rol}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logoutEmp} aria-label="Cerrar Turno" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </header>

      <main className="flex-1 pb-20 md:pb-6">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 grid grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
