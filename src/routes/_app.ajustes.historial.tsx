import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { FileSpreadsheet, Eye, Pencil, Save, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useEmpleado } from "@/lib/empleado-store";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/ajustes/historial")({
  component: HistorialPage,
});

const DENOMS = [
  { key: "m100", label: "Monedas $1.00" },
  { key: "m050", label: "Monedas $0.50" },
  { key: "m025", label: "Monedas $0.25" },
  { key: "m010", label: "Monedas $0.10" },
  { key: "m005", label: "Monedas $0.05" },
] as const;
type DenomKey = typeof DENOMS[number]["key"];

type MonedasJson = Partial<Record<DenomKey, number>> & {
  banco_pichincha?: number;
  banco_guayaquil?: number;
};

type Cierre = {
  id: string;
  fecha: string;
  caja_inicial: number;
  total_egresos: number;
  billetes: number;
  bancos: number;
  total_arqueo: number;
  venta_real: number;
  monedas: MonedasJson;
};

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatFechaCorta(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function HistorialPage() {
  const [desde, setDesde] = useState(todayISO(-7));
  const [hasta, setHasta] = useState(todayISO());
  const [openId, setOpenId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<{
    bancoPichincha: string;
    bancoGuayaquil: string;
    billetes: string;
    monedas: Record<DenomKey, string>;
  }>({
    bancoPichincha: "",
    bancoGuayaquil: "",
    billetes: "",
    monedas: { m100: "", m050: "", m025: "", m010: "", m005: "" },
  });

  const { empleado } = useEmpleado();
  const isAdmin = empleado?.rol === "admin";
  const qc = useQueryClient();

  const cierresQ = useQuery({
    queryKey: ["historial-cajas-rango", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historial_cajas")
        .select("id, fecha, caja_inicial, total_egresos, billetes, bancos, monedas, total_arqueo, venta_real")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cierre[];
    },
  });

  const cierres = cierresQ.data ?? [];
  const selected = useMemo(() => cierres.find((c) => c.id === openId) ?? null, [cierres, openId]);

  // Cargar formulario cuando se abre un cierre
  useEffect(() => {
    if (!selected) return;
    const m = selected.monedas || {};
    setForm({
      bancoPichincha: String(m.banco_pichincha ?? ""),
      bancoGuayaquil: String(m.banco_guayaquil ?? ""),
      billetes: String(selected.billetes ?? ""),
      monedas: {
        m100: String(m.m100 ?? ""),
        m050: String(m.m050 ?? ""),
        m025: String(m.m025 ?? ""),
        m010: String(m.m010 ?? ""),
        m005: String(m.m005 ?? ""),
      },
    });
    setEditMode(false);
  }, [selected?.id]);

  const totales = cierres.reduce(
    (acc, c) => {
      acc.ventaReal += Number(c.venta_real);
      acc.egresos += Number(c.total_egresos);
      acc.cajaInicial += Number(c.caja_inicial);
      return acc;
    },
    { ventaReal: 0, egresos: 0, cajaInicial: 0 }
  );

  const exportar = () => {
    const rows = cierres.map((c) => ({
      "FECHA": formatFechaCorta(c.fecha),
      "CAJA INICIAL $": Number(c.caja_inicial),
      "TOTAL EGRESOS $": Number(c.total_egresos),
      "TOTAL ARQUEO $": Number(c.total_arqueo),
      "VENTA REAL $": Number(c.venta_real),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cierres");
    XLSX.writeFile(wb, `Historial_Cajas_${desde}_${hasta}.xlsx`);
  };

  const guardarMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sin cierre seleccionado");
      const monedasObj: MonedasJson = {
        m100: Number(form.monedas.m100) || 0,
        m050: Number(form.monedas.m050) || 0,
        m025: Number(form.monedas.m025) || 0,
        m010: Number(form.monedas.m010) || 0,
        m005: Number(form.monedas.m005) || 0,
        banco_pichincha: Number(form.bancoPichincha) || 0,
        banco_guayaquil: Number(form.bancoGuayaquil) || 0,
      };
      const totalMonedas =
        (monedasObj.m100 ?? 0) + (monedasObj.m050 ?? 0) + (monedasObj.m025 ?? 0) +
        (monedasObj.m010 ?? 0) + (monedasObj.m005 ?? 0);
      const bancos = (monedasObj.banco_pichincha ?? 0) + (monedasObj.banco_guayaquil ?? 0);
      const billetes = Number(form.billetes) || 0;
      const totalArqueo = bancos + billetes + totalMonedas;
      // Fórmula mágica: Venta Real = Total Arqueo - (Caja Inicial - Egresos)
      const ventaReal = totalArqueo - (Number(selected.caja_inicial) - Number(selected.total_egresos));

      const { error } = await supabase
        .from("historial_cajas")
        .update({
          billetes,
          bancos,
          monedas: monedasObj,
          total_arqueo: totalArqueo,
          venta_real: ventaReal,
        })
        .eq("id", selected.id);
      if (error) throw error;
      return { totalArqueo, ventaReal };
    },
    onSuccess: () => {
      toast.success("Cierre actualizado correctamente");
      setEditMode(false);
      qc.invalidateQueries({ queryKey: ["historial-cajas-rango"] });
      qc.invalidateQueries({ queryKey: ["arqueos-rango"] });
      qc.invalidateQueries({ queryKey: ["ultimo-cierre"] });
      qc.invalidateQueries({ queryKey: ["arqueo-hoy"] });
    },
    onError: (err: any) => toast.error("Error al guardar", { description: err.message }),
  });

  // Cálculos en vivo durante edición
  const liveCalc = useMemo(() => {
    if (!selected) return null;
    const totalMonedas = DENOMS.reduce((s, d) => s + (Number(form.monedas[d.key]) || 0), 0);
    const bancos = (Number(form.bancoPichincha) || 0) + (Number(form.bancoGuayaquil) || 0);
    const billetes = Number(form.billetes) || 0;
    const totalArqueo = bancos + billetes + totalMonedas;
    const ventaReal = totalArqueo - (Number(selected.caja_inicial) - Number(selected.total_egresos));
    return { totalMonedas, bancos, billetes, totalArqueo, ventaReal };
  }, [form, selected]);

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-12" />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-12" />
        </div>
        <Button variant="outline" onClick={exportar}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Exportar Excel
        </Button>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Venta Real Total</p>
          <p className="font-bold text-success">{formatCurrency(totales.ventaReal)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{cierres.length} día(s)</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Egresos Totales</p>
          <p className="font-bold text-destructive">{formatCurrency(totales.egresos)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Caja Inicial (suma)</p>
          <p className="font-bold">{formatCurrency(totales.cajaInicial)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Cierres de Caja</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Caja Inicial</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Total Arqueo</TableHead>
                <TableHead className="text-right">Venta Real</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{formatFechaCorta(c.fecha)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(c.caja_inicial))}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(Number(c.total_egresos))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(c.total_arqueo))}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatCurrency(Number(c.venta_real))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver detalles
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cierres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin cierres en el rango seleccionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Detalle del Cierre</SheetTitle>
                <SheetDescription>{formatFechaCorta(selected.fecha)}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Grupo A: Totales */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Totales</h3>
                  <div className="rounded-lg border divide-y">
                    <Row label="Caja Inicial" value={formatCurrency(Number(selected.caja_inicial))} />
                    <Row label="Egresos Totales" value={formatCurrency(Number(selected.total_egresos))} valueClass="text-destructive" />
                    <Row
                      label="Total Arqueo"
                      value={formatCurrency(editMode && liveCalc ? liveCalc.totalArqueo : Number(selected.total_arqueo))}
                      valueClass="font-semibold"
                    />
                    <Row
                      label="Venta Real del Día"
                      value={formatCurrency(editMode && liveCalc ? liveCalc.ventaReal : Number(selected.venta_real))}
                      valueClass="font-bold text-success text-base"
                    />
                  </div>
                </section>

                {/* Grupo B: Efectivo físico */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Efectivo Físico</h3>
                  <div className="rounded-lg border divide-y">
                    <EditableRow
                      label="Total Billetes"
                      editing={editMode}
                      value={form.billetes}
                      readValue={Number(selected.billetes)}
                      onChange={(v) => setForm((f) => ({ ...f, billetes: v }))}
                    />
                    {DENOMS.map((d) => (
                      <EditableRow
                        key={d.key}
                        label={d.label}
                        editing={editMode}
                        value={form.monedas[d.key]}
                        readValue={Number((selected.monedas as any)?.[d.key] ?? 0)}
                        onChange={(v) => setForm((f) => ({ ...f, monedas: { ...f.monedas, [d.key]: v } }))}
                      />
                    ))}
                  </div>
                </section>

                {/* Grupo C: Bancos */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bancos</h3>
                  <div className="rounded-lg border divide-y">
                    <EditableRow
                      label="Banco Pichincha"
                      editing={editMode}
                      value={form.bancoPichincha}
                      readValue={Number(selected.monedas?.banco_pichincha ?? 0)}
                      onChange={(v) => setForm((f) => ({ ...f, bancoPichincha: v }))}
                    />
                    <EditableRow
                      label="Banco Guayaquil"
                      editing={editMode}
                      value={form.bancoGuayaquil}
                      readValue={Number(selected.monedas?.banco_guayaquil ?? 0)}
                      onChange={(v) => setForm((f) => ({ ...f, bancoGuayaquil: v }))}
                    />
                  </div>
                </section>

                {isAdmin && (
                  <div className="flex gap-2 pt-2">
                    {!editMode ? (
                      <Button className="w-full" onClick={() => setEditMode(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar Cierre de Caja
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setEditMode(false)}
                          disabled={guardarMut.isPending}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => guardarMut.mutate()}
                          disabled={guardarMut.isPending}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {guardarMut.isPending ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

function EditableRow({
  label,
  editing,
  value,
  readValue,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: string;
  readValue: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {editing ? (
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="h-9 w-32 text-right"
        />
      ) : (
        <span className="text-sm font-medium">{formatCurrency(readValue)}</span>
      )}
    </div>
  );
}
