import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ajustes/categorias")({
  component: CategoriasPage,
});

const COLORES = [
  { value: "slate", label: "Gris", hex: "bg-slate-500" },
  { value: "blue", label: "Azul", hex: "bg-blue-500" },
  { value: "orange", label: "Naranja", hex: "bg-orange-500" },
  { value: "green", label: "Verde", hex: "bg-green-500" },
  { value: "red", label: "Rojo", hex: "bg-red-500" },
  { value: "yellow", label: "Amarillo", hex: "bg-yellow-500" },
  { value: "purple", label: "Morado", hex: "bg-purple-500" },
  { value: "pink", label: "Rosa", hex: "bg-pink-500" },
];

type Categoria = {
  id: string;
  nombre: string;
  color: string;
};

function CategoriasPage() {
  const qc = useQueryClient();
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoColor, setNuevoColor] = useState("slate");

  const categorias = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("nombre");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      if (!nuevoNombre.trim()) throw new Error("El nombre no puede estar vacío");
      const { error } = await supabase.from("categorias").insert({
        nombre: nuevoNombre.trim(),
        color: nuevoColor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoría creada");
      setNuevoNombre("");
      setNuevoColor("slate");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["productos-activos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, nombre, color }: { id: string; nombre: string; color: string }) => {
      if (!nombre.trim()) throw new Error("El nombre no puede estar vacío");
      const { error } = await supabase.from("categorias").update({ nombre: nombre.trim(), color }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoría actualizada");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["productos-activos"] });
      qc.invalidateQueries({ queryKey: ["catalogo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      // Validar si existen productos asignados
      const { count, error: countError } = await supabase
        .from("productos")
        .select("*", { count: "exact", head: true })
        .eq("categoria_id", id);
      
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`No se puede eliminar: hay ${count} producto(s) en esta categoría.`);
      }

      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoría eliminada");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["productos-activos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col md:flex-row gap-3 items-end md:items-center">
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nueva Categoría</label>
          <Input 
            value={nuevoNombre} 
            onChange={(e) => setNuevoNombre(e.target.value)} 
            placeholder="Ej: Desayunos" 
          />
        </div>
        <div className="w-full md:w-48 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Color</label>
          <Select value={nuevoColor} onValueChange={setNuevoColor}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLORES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", c.hex)} />
                    {c.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={() => crear.mutate()} 
          disabled={crear.isPending || !nuevoNombre.trim()}
          className="w-full md:w-auto h-10"
        >
          Crear
        </Button>
      </Card>

      <div className="space-y-2">
        {categorias.isLoading && <div className="text-center p-4 text-muted-foreground">Cargando...</div>}
        {categorias.data?.map(cat => (
          <Card key={cat.id} className="p-3 flex flex-col md:flex-row gap-3 md:items-center">
            <Input 
              defaultValue={cat.nombre} 
              onBlur={(e) => {
                if (e.target.value !== cat.nombre) {
                  actualizar.mutate({ id: cat.id, nombre: e.target.value, color: cat.color });
                }
              }}
              className="flex-1 font-medium bg-transparent" 
            />
            <div className="flex gap-2">
              <Select 
                defaultValue={cat.color} 
                onValueChange={(val) => {
                  if (val !== cat.color) {
                    actualizar.mutate({ id: cat.id, nombre: cat.nombre, color: val });
                  }
                }}
              >
                <SelectTrigger className="w-32 md:w-40 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", c.hex)} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive shrink-0"
                disabled={eliminar.isPending}
                onClick={() => {
                  if (confirm("¿Eliminar esta categoría?")) {
                    eliminar.mutate(cat.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {categorias.data?.length === 0 && (
          <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
            No hay categorías registradas.
          </div>
        )}
      </div>
    </div>
  );
}
