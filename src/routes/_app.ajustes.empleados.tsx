import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { hashPin, isValidPin } from "@/lib/pin";
import { Trash2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes/empleados")({
  component: EmpleadosPage,
});

function EmpleadosPage() {
  const qc = useQueryClient();
  const empleados = useQuery({
    queryKey: ["empleados-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empleados").select("*").order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<"admin" | "empleado">("empleado");
  const [pin, setPin] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) throw new Error("Nombre requerido");
      if (!isValidPin(pin)) throw new Error("PIN debe ser 4 dígitos");
      const { error } = await supabase.from("empleados").insert({
        nombre: nombre.trim(), rol, pin_hash: hashPin(pin),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empleado creado"); setNombre(""); setPin(""); setRol("empleado");
      qc.invalidateQueries({ queryKey: ["empleados-todos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("empleados").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados-todos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empleados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Empleado eliminado"); qc.invalidateQueries({ queryKey: ["empleados-todos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPin = (id: string) => {
    const nuevo = prompt("Nuevo PIN (4 dígitos):") ?? "";
    if (!isValidPin(nuevo)) { toast.error("PIN inválido"); return; }
    update.mutate({ id, pin_hash: hashPin(nuevo) });
    toast.success("PIN actualizado");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div>
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label>Rol</Label>
          <select value={rol} onChange={(e) => setRol(e.target.value as any)} className="h-12 w-full rounded-md border border-input bg-background px-3">
            <option value="empleado">Empleado</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <Label>PIN (4 dígitos)</Label>
          <Input value={pin} maxLength={4} inputMode="numeric" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-12" />
        </div>
        <Button onClick={() => crear.mutate()} disabled={crear.isPending} className="h-12">Crear empleado</Button>
      </Card>

      <div className="space-y-2">
        {(empleados.data ?? []).map((e: any) => (
          <Card key={e.id} className="p-3 flex items-center gap-3">
            <Input
              defaultValue={e.nombre}
              className="h-10 flex-1"
              onBlur={(ev) => ev.target.value !== e.nombre && update.mutate({ id: e.id, nombre: ev.target.value })}
            />
            <select
              defaultValue={e.rol}
              onChange={(ev) => update.mutate({ id: e.id, rol: ev.target.value })}
              className="h-10 rounded-md border border-input bg-background px-2"
            >
              <option value="empleado">Empleado</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={e.activo} onCheckedChange={(v) => update.mutate({ id: e.id, activo: v })} />
            </div>
            <Button size="icon" variant="ghost" onClick={() => resetPin(e.id)} title="Reset PIN">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => confirm(`¿Eliminar "${e.nombre}"?`) && remove.mutate(e.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
