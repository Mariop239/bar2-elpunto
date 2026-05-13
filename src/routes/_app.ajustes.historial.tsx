import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmpleado } from "@/lib/empleado-store";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/ajustes/historial")({
  component: HistorialPage,
});

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDate(isoStr: string | null) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HistorialPage() {
  const [desde, setDesde] = useState(todayISO(-7));
  const [hasta, setHasta] = useState(todayISO());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { empleado } = useEmpleado();
  const isAdmin = empleado?.rol === "admin";
  const queryClient = useQueryClient();

  useEffect(() => {
    setSelectedIds([]);
  }, [desde, hasta]);

  const range = () => {
    const ini = new Date(desde + "T00:00:00").toISOString();
    const fin = new Date(hasta + "T23:59:59").toISOString();
    return { ini, fin };
  };

  const trans = useQuery({
    queryKey: ["historial", desde, hasta],
    queryFn: async () => {
      const { ini, fin } = range();
      const { data, error } = await supabase
        .from("transacciones")
        .select("id, created_at, tipo, metodo_pago, monto, descripcion, origen")
        .gte("created_at", ini)
        .lte("created_at", fin)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allIds = trans.data?.map((t: any) => t.id) ?? [];
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(allIds);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (!selectedIds.length) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("transacciones")
        .delete()
        .in("id", selectedIds);
      if (error) throw error;
      toast.success("Registros eliminados correctamente");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["historial"] });
    } catch (err: any) {
      toast.error("Error al eliminar", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const exportarTransacciones = async () => {
    const { ini, fin } = range();
    const { data, error } = await supabase
      .from("transacciones")
      .select("created_at, tipo, metodo_pago, descripcion, origen, monto, empleados(nombre)")
      .gte("created_at", ini)
      .lte("created_at", fin)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data ?? []).map((t: any) => ({
      "FECHA": formatDate(t.created_at),
      "CATEGORÍA": t.tipo?.toUpperCase() || "",
      "MÉTODO PAGO": t.metodo_pago ? t.metodo_pago.toUpperCase() : "—",
      "PRODUCTO/CONCEPTO": t.descripcion || t.origen || "",
      "MONTO $": Number(t.monto),
      "EMPLEADO": t.empleados?.nombre || "—"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transacciones");
    XLSX.writeFile(wb, `Reporte_Diario_${desde}_${hasta}.xlsx`);
  };

  const exportarDeudores = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("nombre, saldo_total, deudas(created_at, estado)")
      .gt("saldo_total", 0);

    if (error) {
      alert(error.message);
      return;
    }

    const clientesConDeudas = (data ?? []).map((c: any) => {
      const deudasPendientes = (c.deudas || []).filter((d: any) => d.estado === "pendiente");
      const oldestDate = deudasPendientes.length > 0
        ? new Date(Math.min(...deudasPendientes.map((d: any) => new Date(d.created_at).getTime())))
        : null;

      return {
        "NOMBRE DEL CLIENTE": c.nombre,
        "SALDO TOTAL $": Number(c.saldo_total),
        oldestTime: oldestDate ? oldestDate.getTime() : 0,
        "FECHA DEUDA MÁS ANTIGUA": oldestDate ? formatDate(oldestDate.toISOString()) : "—"
      };
    });

    clientesConDeudas.sort((a, b) => a.oldestTime - b.oldestTime);

    const rows = clientesConDeudas.map(({ oldestTime, ...rest }) => rest);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deudores");
    XLSX.writeFile(wb, `Lista_Deudores_${todayISO()}.xlsx`);
  };

  const totales = (trans.data ?? []).reduce(
    (acc, t: any) => {
      const m = Number(t.monto);
      if (t.tipo === "ingreso") acc.ingreso += m;
      else if (t.tipo === "costo") acc.costo += m;
      else if (t.tipo === "gasto") acc.gasto += m;
      return acc;
    },
    { ingreso: 0, costo: 0, gasto: 0 }
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-3 gap-3 items-end">
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-12" /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-12" /></div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={exportarTransacciones} className="text-xs px-2" title="Exportar reporte del día o rango seleccionado">
            <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" />
            Transacciones
          </Button>
          <Button variant="outline" onClick={exportarDeudores} className="text-xs px-2" title="Exportar lista de clientes con deudas pendientes">
            <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" />
            Deudores
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Ingresos</p><p className="font-bold text-success">{formatCurrency(totales.ingreso)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Costos</p><p className="font-bold">{formatCurrency(totales.costo)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Gastos</p><p className="font-bold text-destructive">{formatCurrency(totales.gasto)}</p></Card>
      </div>

      <div className="flex justify-between items-center mt-2 mb-2">
        <h2 className="text-lg font-semibold">Movimientos</h2>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={selectedIds.length === 0 || isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Seleccionados {selectedIds.length > 0 && `(${selectedIds.length})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que deseas eliminar permanentemente {selectedIds.length} registros? Esto recalculará los totales del dashboard y es una acción irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete} 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              {isAdmin && (
                <th className="py-2 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
              )}
              <th className="py-2">Fecha</th>
              <th>Tipo</th>
              <th>Método</th>
              <th>Descripción</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {(trans.data ?? []).map((t: any, i) => (
              <tr key={t.id || i} className="border-t">
                {isAdmin && (
                  <td className="py-2">
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onCheckedChange={() => toggleOne(t.id)}
                    />
                  </td>
                )}
                <td className="py-2">{new Date(t.created_at).toLocaleString("es-CO")}</td>
                <td className="capitalize">{t.tipo}</td>
                <td className="capitalize">{t.metodo_pago ?? "—"}</td>
                <td>{t.descripcion ?? t.origen}</td>
                <td className="text-right font-medium">{formatCurrency(Number(t.monto))}</td>
              </tr>
            ))}
            {trans.data?.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-6">
                  Sin movimientos en el rango
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
