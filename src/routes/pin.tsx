import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Delete, LogOut } from "lucide-react";
import { toast } from "sonner";
import { comparePin } from "@/lib/pin";
import { useEmpleado } from "@/lib/empleado-store";
import { cn } from "@/lib/utils";

type Empleado = { id: string; nombre: string; rol: "admin" | "empleado"; pin_hash: string };

export const Route = createFileRoute("/pin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  loader: async () => {
    const { data, error } = await supabase
      .from("empleados")
      .select("id,nombre,rol,pin_hash")
      .eq("activo", true)
      .order("nombre");
    if (error) throw error;
    return { empleados: (data ?? []) as Empleado[] };
  },
  component: PinPage,
});

function PinPage() {
  const { empleados } = Route.useLoaderData();
  const navigate = useNavigate();
  const setEmpleado = useEmpleado((s) => s.setEmpleado);
  const [selected, setSelected] = useState<Empleado | null>(empleados[0] ?? null);
  const [pin, setPin] = useState("");

  useEffect(() => { setPin(""); }, [selected?.id]);

  const press = (d: string) => setPin((p) => (p.length >= 4 ? p : p + d));
  const back = () => setPin((p) => p.slice(0, -1));

  useEffect(() => {
    if (pin.length !== 4 || !selected) return;
    if (comparePin(pin, selected.pin_hash)) {
      setEmpleado({ id: selected.id, nombre: selected.nombre, rol: selected.rol, loggedAt: Date.now() });
      toast.success(`Bienvenido, ${selected.nombre}`);
      navigate({ to: selected.rol === "admin" ? "/inicio" : "/registro" });
    } else {
      toast.error("PIN incorrecto");
      setPin("");
    }
  }, [pin, selected, navigate, setEmpleado]);

  const logoutDevice = async () => {
    setEmpleado(null);
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  if (empleados.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-6 max-w-sm text-center space-y-3">
          <h2 className="font-bold">Sin empleados activos</h2>
          <p className="text-sm text-muted-foreground">Pide al admin que cree empleados desde la base de datos.</p>
          <Button variant="outline" onClick={logoutDevice}>Cerrar sesión del dispositivo</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex justify-end p-3">
        <Button variant="ghost" size="sm" onClick={logoutDevice}>
          <LogOut className="h-4 w-4 mr-2" /> Salir
        </Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-6 max-w-md mx-auto w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold">¿Quién entra al turno?</h1>
        </div>
        <div className="w-full grid grid-cols-2 gap-2">
          {empleados.map((e: Empleado) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className={cn(
                "p-4 rounded-xl border text-left transition",
                selected?.id === e.id ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border bg-card"
              )}
            >
              <div className="font-semibold">{e.nombre}</div>
              <div className="text-xs uppercase text-muted-foreground">{e.rol}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 my-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-2",
                pin.length > i ? "bg-primary border-primary" : "border-muted-foreground/40"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <Button key={d} variant="outline" onClick={() => press(d)} className="h-16 text-2xl font-semibold">
              {d}
            </Button>
          ))}
          <div />
          <Button variant="outline" onClick={() => press("0")} className="h-16 text-2xl font-semibold">0</Button>
          <Button variant="outline" onClick={back} className="h-16">
            <Delete className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
