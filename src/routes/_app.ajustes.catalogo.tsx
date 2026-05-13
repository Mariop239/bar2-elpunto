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
import { formatCurrency } from "@/lib/utils";
import { Trash2, Search, X } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes/catalogo")({
  component: CatalogoPage,
});

function CatalogoPage() {
  const qc = useQueryClient();
  const productos = useQuery({
    queryKey: ["productos-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("*, categorias(id, nombre, color)").order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categorias = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const defaultCategoryId = categorias.data?.find((c) => c.nombre === "Otros")?.id || "";

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoriaId, setCategoriaId] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      const p = Number(precio);
      if (!nombre.trim() || !p || p < 0) throw new Error("Datos inválidos");
      const { error } = await supabase.from("productos").insert({ 
        nombre: nombre.trim(), 
        precio: p,
        categoria_id: categoriaId || defaultCategoryId || null
      });
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Producto creado"); 
      setNombre(""); 
      setPrecio(""); 
      setCategoriaId("");
      qc.invalidateQueries({ queryKey: ["productos-todos"] }); 
      qc.invalidateQueries({ queryKey: ["productos-activos"] }); 
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("productos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos-todos"] }); qc.invalidateQueries({ queryKey: ["productos-activos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Producto eliminado"); qc.invalidateQueries({ queryKey: ["productos-todos"] }); qc.invalidateQueries({ queryKey: ["productos-activos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div className="sm:col-span-1">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label>Precio</Label>
          <Input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label>Categoría</Label>
          <select 
            value={categoriaId} 
            onChange={(e) => setCategoriaId(e.target.value)} 
            className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {(categorias.data ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => crear.mutate()} disabled={crear.isPending} className="h-12">Agregar</Button>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {(productos.data ?? []).map((p: any) => (
          <Card key={p.id} className="p-3 flex items-center gap-3">
            <Input
              defaultValue={p.nombre}
              className="h-10 flex-1 min-w-0"
              onBlur={(e) => e.target.value !== p.nombre && update.mutate({ id: p.id, nombre: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              defaultValue={p.precio}
              className="h-10 w-24"
              onBlur={(e) => Number(e.target.value) !== Number(p.precio) && update.mutate({ id: p.id, precio: Number(e.target.value) })}
            />
            <select
              defaultValue={p.categoria_id || ""}
              onChange={(e) => update.mutate({ id: p.id, categoria_id: e.target.value })}
              className="h-10 w-32 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Sin categoría</option>
              {(categorias.data ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-xs">
              <Switch checked={p.activo} onCheckedChange={(v) => update.mutate({ id: p.id, activo: v })} />
            </div>
            <Button size="icon" variant="ghost" className="flex-shrink-0" onClick={() => confirm(`¿Eliminar "${p.nombre}"?`) && remove.mutate(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Precio: {formatCurrency(0).replace("0", "...")} se formatea en USD.</p>
    </div>
  );
}
