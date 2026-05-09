import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { formatCOP } from "@/lib/utils";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/ajustes/historial")({
  component: HistorialPage,
});

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function HistorialPage() {
  const [desde, setDesde] = useState(todayISO(-7));
  const [hasta, setHasta] = useState(todayISO());

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
        .select("created_at,tipo,metodo_pago,monto,descripcion,origen")
        .gte("created_at", ini).lte("created_at", fin)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportar = async (tabla: "transacciones" | "deudas" | "abonos") => {
    const { ini, fin } = range();
    const { data, error } = await supabase.from(tabla).select("*").gte("created_at", ini).lte("created_at", fin);
    if (error) { alert(error.message); return; }
    downloadCSV(`${tabla}_${desde}_${hasta}.csv`, toCSV(data ?? []));
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
        <div className="grid grid-cols-3 gap-1">
          <Button variant="outline" onClick={() => exportar("transacciones")} className="text-xs"><Download className="h-3 w-3 mr-1" />Trans</Button>
          <Button variant="outline" onClick={() => exportar("deudas")} className="text-xs"><Download className="h-3 w-3 mr-1" />Deudas</Button>
          <Button variant="outline" onClick={() => exportar("abonos")} className="text-xs"><Download className="h-3 w-3 mr-1" />Abonos</Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Ingresos</p><p className="font-bold text-success">{formatCOP(totales.ingreso)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Costos</p><p className="font-bold">{formatCOP(totales.costo)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Gastos</p><p className="font-bold text-destructive">{formatCOP(totales.gasto)}</p></Card>
      </div>

      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-2">Fecha</th><th>Tipo</th><th>Método</th><th>Descripción</th><th className="text-right">Monto</th></tr>
          </thead>
          <tbody>
            {(trans.data ?? []).map((t: any, i) => (
              <tr key={i} className="border-t">
                <td className="py-2">{new Date(t.created_at).toLocaleString("es-CO")}</td>
                <td className="capitalize">{t.tipo}</td>
                <td className="capitalize">{t.metodo_pago ?? "—"}</td>
                <td>{t.descripcion ?? t.origen}</td>
                <td className="text-right font-medium">{formatCOP(Number(t.monto))}</td>
              </tr>
            ))}
            {trans.data?.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Sin movimientos en el rango</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
