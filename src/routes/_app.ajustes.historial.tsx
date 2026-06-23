import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { formatCurrency, round2 } from "@/lib/utils";
import { FileSpreadsheet, Eye, Pencil, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
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
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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

type RowItem =
  | { kind: "cerrado"; fecha: string; cierre: Cierre }
  | { kind: "pendiente"; fecha: string; ingresos: number; egresos: number };

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function localDateFromISO(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFechaCorta(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function HistorialPage() {
  const [desde, setDesde] = useState(todayISO(-7));
  const [hasta, setHasta] = useState(todayISO());
  const [openId, setOpenId] = useState<string | null>(null);
  const [openPendiente, setOpenPendiente] = useState<string | null>(null);
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

  // Form para cierre retroactivo
  const [pendForm, setPendForm] = useState<{
    cajaInicial: string;
    bancoPichincha: string;
    bancoGuayaquil: string;
    billetes: string;
    monedas: Record<DenomKey, string>;
  }>({
    cajaInicial: "",
    bancoPichincha: "",
    bancoGuayaquil: "",
    billetes: "",
    monedas: { m100: "", m050: "", m025: "", m010: "", m005: "" },
  });

  // Form para añadir gasto omitido al día pendiente
  const [gastoOmitido, setGastoOmitido] = useState<{ monto: string; descripcion: string }>({
    monto: "",
    descripcion: "",
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

  // Transacciones del rango (para detectar días sin cierre)
  const txRangoQ = useQuery({
    queryKey: ["transacciones-rango", desde, hasta],
    queryFn: async () => {
      const start = new Date(`${desde}T00:00:00`).toISOString();
      const end = new Date(`${hasta}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("transacciones")
        .select("id, tipo, monto, created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Abonos del rango (para considerar ingresos por cobros)
  const abonosRangoQ = useQuery({
    queryKey: ["abonos-rango", desde, hasta],
    queryFn: async () => {
      const start = new Date(`${desde}T00:00:00`).toISOString();
      const end = new Date(`${hasta}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("abonos")
        .select("id, monto, metodo_pago, created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cierres = cierresQ.data ?? [];

  // Construir mapa de actividad por fecha local.
  // Solo las transacciones con tipo === 'gasto' marcan el día como pendiente
  // (los ingresos por abonos/cobros de fiados NO deben generar fila "No Cerrado").
  const actividadPorFecha = useMemo(() => {
    const map = new Map<string, { ingresos: number; egresos: number; tieneGasto: boolean }>();
    for (const t of txRangoQ.data ?? []) {
      const f = localDateFromISO(t.created_at as string);
      const cur = map.get(f) ?? { ingresos: 0, egresos: 0, tieneGasto: false };
      const monto = Number(t.monto) || 0;
      if (t.tipo === "gasto") {
        cur.egresos += monto;
        cur.tieneGasto = true;
      } else if (t.tipo === "ingreso") {
        cur.ingresos += monto;
      }
      map.set(f, cur);
    }
    for (const a of abonosRangoQ.data ?? []) {
      const f = localDateFromISO(a.created_at as string);
      const cur = map.get(f) ?? { ingresos: 0, egresos: 0, tieneGasto: false };
      cur.ingresos += Number(a.monto) || 0;
      map.set(f, cur);
    }
    return map;
  }, [txRangoQ.data, abonosRangoQ.data]);

  const today = todayISO();
  const fechasCerradas = useMemo(() => new Set(cierres.map((c) => c.fecha)), [cierres]);

  const pendientes = useMemo<RowItem[]>(() => {
    const items: RowItem[] = [];
    for (const [fecha, act] of actividadPorFecha.entries()) {
      if (fecha >= today) continue; // hoy aún se puede cerrar normalmente
      if (fechasCerradas.has(fecha)) continue;
      // Solo días con al menos un GASTO real activan la fila virtual "No Cerrado".
      if (!act.tieneGasto) continue;
      items.push({ kind: "pendiente", fecha, ingresos: round2(act.ingresos), egresos: round2(act.egresos) });
    }
    return items;
  }, [actividadPorFecha, fechasCerradas, today]);

  const filas = useMemo<RowItem[]>(() => {
    const cerradas: RowItem[] = cierres.map((c) => ({ kind: "cerrado", fecha: c.fecha, cierre: c }));
    return [...cerradas, ...pendientes].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [cierres, pendientes]);

  const selected = useMemo(() => cierres.find((c) => c.id === openId) ?? null, [cierres, openId]);
  const selectedPend = useMemo(
    () => pendientes.find((p) => p.kind === "pendiente" && p.fecha === openPendiente) as
      | (RowItem & { kind: "pendiente" })
      | undefined,
    [pendientes, openPendiente]
  );

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

  // Reset form pendiente al cambiar
  useEffect(() => {
    if (!openPendiente) return;
    setPendForm({
      cajaInicial: "",
      bancoPichincha: "",
      bancoGuayaquil: "",
      billetes: "",
      monedas: { m100: "", m050: "", m025: "", m010: "", m005: "" },
    });
  }, [openPendiente]);

  const egresosDiaQ = useQuery({
    queryKey: ["egresos-dia-detalle", selected?.fecha],
    enabled: !!selected?.fecha,
    queryFn: async () => {
      const start = new Date(`${selected!.fecha}T00:00:00`).toISOString();
      const end = new Date(`${selected!.fecha}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("transacciones")
        .select("id, descripcion, monto, created_at, tipo")
        .eq("tipo", "gasto")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Detalle de gastos del día pendiente seleccionado
  const egresosPendDiaQ = useQuery({
    queryKey: ["egresos-dia-detalle", selectedPend?.fecha],
    enabled: !!selectedPend?.fecha,
    queryFn: async () => {
      const start = new Date(`${selectedPend!.fecha}T00:00:00`).toISOString();
      const end = new Date(`${selectedPend!.fecha}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("transacciones")
        .select("id, descripcion, monto, created_at, tipo")
        .eq("tipo", "gasto")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Totales globales: SOLO cierres confirmados (excluye pendientes)
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
        m100: round2(form.monedas.m100),
        m050: round2(form.monedas.m050),
        m025: round2(form.monedas.m025),
        m010: round2(form.monedas.m010),
        m005: round2(form.monedas.m005),
        banco_pichincha: round2(form.bancoPichincha),
        banco_guayaquil: round2(form.bancoGuayaquil),
      };
      const totalMonedas = round2(
        (monedasObj.m100 ?? 0) + (monedasObj.m050 ?? 0) + (monedasObj.m025 ?? 0) +
        (monedasObj.m010 ?? 0) + (monedasObj.m005 ?? 0)
      );
      const bancos = round2((monedasObj.banco_pichincha ?? 0) + (monedasObj.banco_guayaquil ?? 0));
      const billetes = round2(form.billetes);
      const totalArqueo = round2(bancos + billetes + totalMonedas);
      const ventaReal = round2(totalArqueo - (Number(selected.caja_inicial) - Number(selected.total_egresos)));

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

  // Cálculos en vivo durante cierre retroactivo
  const pendCalc = useMemo(() => {
    if (!selectedPend) return null;
    const totalMonedas = DENOMS.reduce((s, d) => s + (Number(pendForm.monedas[d.key]) || 0), 0);
    const bancos = (Number(pendForm.bancoPichincha) || 0) + (Number(pendForm.bancoGuayaquil) || 0);
    const billetes = Number(pendForm.billetes) || 0;
    const totalArqueo = bancos + billetes + totalMonedas;
    const cajaInicial = Number(pendForm.cajaInicial) || 0;
    const ventaReal = totalArqueo - (cajaInicial - selectedPend.egresos);
    return { totalMonedas, bancos, billetes, totalArqueo, ventaReal, cajaInicial };
  }, [pendForm, selectedPend]);

  const cerrarRetroMut = useMutation({
    mutationFn: async () => {
      if (!selectedPend) throw new Error("Sin día seleccionado");
      if (!empleado?.id) throw new Error("Sin empleado activo");
      const monedasObj: MonedasJson = {
        m100: round2(pendForm.monedas.m100),
        m050: round2(pendForm.monedas.m050),
        m025: round2(pendForm.monedas.m025),
        m010: round2(pendForm.monedas.m010),
        m005: round2(pendForm.monedas.m005),
        banco_pichincha: round2(pendForm.bancoPichincha),
        banco_guayaquil: round2(pendForm.bancoGuayaquil),
      };
      const totalMonedas = round2(
        (monedasObj.m100 ?? 0) + (monedasObj.m050 ?? 0) + (monedasObj.m025 ?? 0) +
        (monedasObj.m010 ?? 0) + (monedasObj.m005 ?? 0)
      );
      const bancos = round2((monedasObj.banco_pichincha ?? 0) + (monedasObj.banco_guayaquil ?? 0));
      const billetes = round2(pendForm.billetes);
      const totalArqueo = round2(bancos + billetes + totalMonedas);
      const cajaInicial = round2(pendForm.cajaInicial);
      const totalEgresos = round2(selectedPend.egresos);
      const ventaReal = round2(totalArqueo - (cajaInicial - totalEgresos));

      const { error } = await supabase.from("historial_cajas").upsert({
        fecha: selectedPend.fecha,
        caja_inicial: cajaInicial,
        total_egresos: totalEgresos,
        bancos,
        billetes,
        monedas: monedasObj,
        total_arqueo: totalArqueo,
        venta_real: ventaReal,
        empleado_id: empleado.id,
      }, { onConflict: "fecha" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caja cerrada retroactivamente");
      setOpenPendiente(null);
      qc.invalidateQueries({ queryKey: ["historial-cajas-rango"] });
      qc.invalidateQueries({ queryKey: ["transacciones-rango"] });
      qc.invalidateQueries({ queryKey: ["abonos-rango"] });
      qc.invalidateQueries({ queryKey: ["historial"] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      qc.invalidateQueries({ queryKey: ["ultimo-cierre"] });
    },
    onError: (err: any) => toast.error("Error al cerrar caja", { description: err.message }),
  });

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
          <p className="text-[10px] text-muted-foreground mt-0.5">{cierres.length} día(s) cerrado(s)</p>
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

      {pendientes.length > 0 && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>
              <strong>{pendientes.length}</strong> día(s) con actividad sin cierre de caja. No se incluyen en los totales hasta confirmarlos.
            </span>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Cierres de Caja</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Caja Inicial</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Total Arqueo</TableHead>
                <TableHead className="text-right">Venta Real</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((row) => {
                if (row.kind === "cerrado") {
                  const c = row.cierre;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{formatFechaCorta(c.fecha)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Cerrado
                        </Badge>
                      </TableCell>
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
                  );
                }
                return (
                  <TableRow
                    key={`pend-${row.fecha}`}
                    className="bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer"
                    onClick={() => setOpenPendiente(row.fecha)}
                  >
                    <TableCell className="font-medium">{formatFechaCorta(row.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        No Cerrado
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(row.egresos)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground italic">Pendiente</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPendiente(row.fecha);
                        }}
                      >
                        Cerrar caja
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Sin cierres ni actividad en el rango seleccionado
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

                  <Accordion type="single" collapsible className="rounded-lg border px-3">
                    <AccordionItem value="gastos" className="border-b-0">
                      <AccordionTrigger className="text-sm">
                        <span className="flex-1 text-left">Ver lista de gastos del día</span>
                        {egresosDiaQ.data && (
                          <span className="mr-2 text-xs text-muted-foreground">
                            {egresosDiaQ.data.length} {egresosDiaQ.data.length === 1 ? "gasto" : "gastos"}
                          </span>
                        )}
                      </AccordionTrigger>
                      <AccordionContent>
                        {egresosDiaQ.isLoading ? (
                          <p className="text-sm text-muted-foreground py-2">Cargando...</p>
                        ) : (egresosDiaQ.data?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground py-2 italic">
                            No se registraron gastos este día
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {egresosDiaQ.data!.map((g) => (
                              <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                                <span className="text-sm text-foreground truncate">
                                  {g.descripcion?.trim() || "Sin descripción"}
                                </span>
                                <span className="text-sm font-medium text-destructive whitespace-nowrap">
                                  {formatCurrency(Number(g.monto))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>

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

      {/* Sheet: cierre retroactivo de día pendiente */}
      <Sheet open={!!openPendiente} onOpenChange={(v) => !v && setOpenPendiente(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedPend && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Cierre Retroactivo
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Pendiente
                  </Badge>
                </SheetTitle>
                <SheetDescription>{formatFechaCorta(selectedPend.fecha)}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Actividad del Día
                  </h3>
                  <div className="rounded-lg border divide-y">
                    <Row
                      label="Ingresos (cobros / ventas)"
                      value={formatCurrency(selectedPend.ingresos)}
                      valueClass="text-success"
                    />
                    <Row
                      label="Egresos (gastos)"
                      value={formatCurrency(selectedPend.egresos)}
                      valueClass="text-destructive"
                    />
                  </div>

                  <Accordion type="single" collapsible className="rounded-lg border px-3">
                    <AccordionItem value="gastos-pend" className="border-b-0">
                      <AccordionTrigger className="text-sm">
                        <span className="flex-1 text-left">Ver lista de gastos del día</span>
                        {egresosPendDiaQ.data && (
                          <span className="mr-2 text-xs text-muted-foreground">
                            {egresosPendDiaQ.data.length} {egresosPendDiaQ.data.length === 1 ? "gasto" : "gastos"}
                          </span>
                        )}
                      </AccordionTrigger>
                      <AccordionContent>
                        {egresosPendDiaQ.isLoading ? (
                          <p className="text-sm text-muted-foreground py-2">Cargando...</p>
                        ) : (egresosPendDiaQ.data?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground py-2 italic">
                            No se registraron gastos este día
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {egresosPendDiaQ.data!.map((g) => (
                              <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                                <span className="text-sm text-foreground truncate">
                                  {g.descripcion?.trim() || "Sin descripción"}
                                </span>
                                <span className="text-sm font-medium text-destructive whitespace-nowrap">
                                  {formatCurrency(Number(g.monto))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Caja Inicial
                  </h3>
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm text-muted-foreground">Dinero al iniciar el día</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={pendForm.cajaInicial}
                        onChange={(e) => setPendForm((f) => ({ ...f, cajaInicial: e.target.value }))}
                        placeholder="0.00"
                        className="h-9 w-32 text-right"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Efectivo Físico (Cierre)
                  </h3>
                  <div className="rounded-lg border divide-y">
                    <EditableRow
                      label="Total Billetes"
                      editing
                      value={pendForm.billetes}
                      readValue={0}
                      onChange={(v) => setPendForm((f) => ({ ...f, billetes: v }))}
                    />
                    {DENOMS.map((d) => (
                      <EditableRow
                        key={d.key}
                        label={d.label}
                        editing
                        value={pendForm.monedas[d.key]}
                        readValue={0}
                        onChange={(v) =>
                          setPendForm((f) => ({ ...f, monedas: { ...f.monedas, [d.key]: v } }))
                        }
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Bancos
                  </h3>
                  <div className="rounded-lg border divide-y">
                    <EditableRow
                      label="Banco Pichincha"
                      editing
                      value={pendForm.bancoPichincha}
                      readValue={0}
                      onChange={(v) => setPendForm((f) => ({ ...f, bancoPichincha: v }))}
                    />
                    <EditableRow
                      label="Banco Guayaquil"
                      editing
                      value={pendForm.bancoGuayaquil}
                      readValue={0}
                      onChange={(v) => setPendForm((f) => ({ ...f, bancoGuayaquil: v }))}
                    />
                  </div>
                </section>

                {pendCalc && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Resumen
                    </h3>
                    <div className="rounded-lg border divide-y">
                      <Row label="Total Arqueo" value={formatCurrency(pendCalc.totalArqueo)} valueClass="font-semibold" />
                      <Row
                        label="Venta Real del Día"
                        value={formatCurrency(pendCalc.ventaReal)}
                        valueClass="font-bold text-success text-base"
                      />
                    </div>
                  </section>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setOpenPendiente(null)}
                    disabled={cerrarRetroMut.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => cerrarRetroMut.mutate()}
                    disabled={cerrarRetroMut.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {cerrarRetroMut.isPending ? "Guardando..." : "Confirmar y Cerrar Caja"}
                  </Button>
                </div>
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
