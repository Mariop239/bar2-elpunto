import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, round2 } from "@/lib/utils";
import { Pencil, Trash2, Search, X } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes/catalogo")({
  component: CatalogoPage,
});

function CatalogoPage() {
  const qc = useQueryClient();
  const productos = useQuery({
    queryKey: ["productos-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*, categorias(id, nombre, color)")
        .order("nombre");
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
  const [busqueda, setBusqueda] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["productos-todos"] });
    qc.invalidateQueries({ queryKey: ["productos-activos"] });
  };

  const crear = useMutation({
    mutationFn: async () => {
      const p = round2(precio);
      if (!nombre.trim() || !p || p < 0) throw new Error("Datos inválidos");
      const { error } = await supabase.from("productos").insert({
        nombre: nombre.trim(),
        precio: p,
        categoria_id: categoriaId || defaultCategoryId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto creado");
      setNombre("");
      setPrecio("");
      setCategoriaId("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("productos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      setConfirmDelete(null);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrados = (productos.data ?? []).filter((p: any) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end rounded-xl shadow-sm">
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
            {(categorias.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => crear.mutate()} disabled={crear.isPending} className="h-12">
          Agregar
        </Button>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="pl-9 pr-9 h-12"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card className="rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y">
          {filtrados.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">Sin productos</li>
          )}
          {filtrados.map((p: any) => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-4 py-4 hover:bg-muted/50 active:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-lg sm:text-xl font-medium leading-tight line-clamp-2 break-words">
                  {p.nombre}
                </p>
              </div>
              <div className="w-20 sm:w-24 text-right">
                <span className="text-base sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(Number(p.precio))}
                </span>
              </div>
              <div className="hidden sm:block w-36">
                <select
                  defaultValue={p.categoria_id || ""}
                  onChange={(e) => update.mutate({ id: p.id, categoria_id: e.target.value || null })}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {(categorias.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editing.nombre}
                  onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                  className="h-11"
                />
              </div>
              <div>
                <Label>Precio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.precio}
                  onChange={(e) => setEditing({ ...editing, precio: e.target.value })}
                  className="h-11"
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <select
                  value={editing.categoria_id || ""}
                  onChange={(e) => setEditing({ ...editing, categoria_id: e.target.value })}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sin categoría</option>
                  {(categorias.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(editing)}
              disabled={!editing}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!editing) return;
                  const precioNum = round2(editing.precio);
                  if (!editing.nombre.trim() || !precioNum || precioNum < 0) {
                    toast.error("Datos inválidos");
                    return;
                  }
                  update.mutate(
                    {
                      id: editing.id,
                      nombre: editing.nombre.trim(),
                      precio: precioNum,
                      categoria_id: editing.categoria_id || null,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Producto actualizado");
                        setEditing(null);
                      },
                    },
                  );
                }}
                disabled={update.isPending}
              >
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{confirmDelete?.nombre}" del catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
