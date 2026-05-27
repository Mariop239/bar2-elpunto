import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, Trash2, CalendarIcon, Search, X, Wallet, TrendingDown, Calculator, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { FiadosRecientes } from "@/components/fiados-recientes";
import { toast } from "sonner";
import { useEmpleado } from "@/lib/empleado-store";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { formatCurrency, cn, round2 } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export const Route = createFileRoute("/_app/registro")({
  component: RegistroPage,
});

type TipoMov = "ingreso" | "gasto" | "costo" | "fondo_caja";
type Metodo = "efectivo" | "transferencia";

function RegistroPage() {
  return (
    <PageTransition>
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Registro</h2>
      <Tabs defaultValue="caja" className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-12">
          <TabsTrigger value="caja" className="text-base">Caja diaria</TabsTrigger>
          <TabsTrigger value="fiados" className="text-base">Fiados (POS)</TabsTrigger>
        </TabsList>
        <TabsContent value="caja" className="mt-4"><CajaTab /></TabsContent>
        <TabsContent value="fiados" className="mt-4"><FiadosTab /></TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}

/* ---------- CAJA ---------- */

const DENOMS = [
  { key: "m100", label: "$1.00", value: 1.0 },
  { key: "m050", label: "$0.50", value: 0.5 },
  { key: "m025", label: "$0.25", value: 0.25 },
  { key: "m010", label: "$0.10", value: 0.1 },
  { key: "m005", label: "$0.05", value: 0.05 },
] as const;

type DenomKey = typeof DENOMS[number]["key"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CajaTab() {
  const empleado = useEmpleado((s) => s.empleado)!;
  const isAdmin = empleado.rol === "admin";
  const qc = useQueryClient();
  const fecha = todayISO();

  const [cajaInicial, setCajaInicial] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`caja_inicial_${fecha}`) ?? "";
  });
  const guardarCajaInicial = (v: string) => {
    setCajaInicial(v);
    if (typeof window !== "undefined") localStorage.setItem(`caja_inicial_${fecha}`, v);
    qc.invalidateQueries({ queryKey: ["caja-inicial-hoy"] });
  };

  const [egDesc, setEgDesc] = useState("");
  const [egMonto, setEgMonto] = useState("");

  // Sincronización en vivo entre admins: cualquier cambio en transacciones,
  // historial_cajas o abonos invalida las queries del cierre de caja.
  useEffect(() => {
    const channel = supabase
      .channel("registro-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacciones" }, () => {
        qc.invalidateQueries({ queryKey: ["egresos-hoy", fecha] });
        qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
        qc.invalidateQueries({ queryKey: ["historial"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "historial_cajas" }, () => {
        qc.invalidateQueries({ queryKey: ["ultimo-cierre", fecha] });
        qc.invalidateQueries({ queryKey: ["historial"] });
        qc.invalidateQueries({ queryKey: ["arqueo-hoy"] });
        qc.invalidateQueries({ queryKey: ["caja-inicial-hoy"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "abonos" }, () => {
        qc.invalidateQueries({ queryKey: ["cobros-deudas-hoy", fecha] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, fecha]);

  const egresosQ = useQuery({
    queryKey: ["egresos-hoy", fecha],
    queryFn: async () => {
      // Rango por día local (zona horaria del navegador) para evitar
      // que un gasto creado al final del día aparezca en el día siguiente UTC.
      const start = new Date(`${fecha}T00:00:00`).toISOString();
      const end = new Date(`${fecha}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("transacciones")
        .select("id,monto,descripcion,created_at")
        .eq("tipo", "gasto")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: true,
  });

  // Cobros de deudas (abonos) del día — entran físicamente a caja pero NO son venta
  const cobrosDeudasQ = useQuery({
    queryKey: ["cobros-deudas-hoy", fecha],
    queryFn: async () => {
      const start = new Date(`${fecha}T00:00:00`).toISOString();
      const end = new Date(`${fecha}T23:59:59.999`).toISOString();
      const { data, error } = await supabase
        .from("abonos")
        .select("monto,metodo_pago,created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: true,
  });

  // Recalcula historial_cajas del día si la caja ya fue cerrada (estrategia
  // frontend porque los triggers SQL no están disponibles en el entorno actual).
  const recalcHistorialCajas = async (deltaEgreso: number) => {
    const { data: hist, error: selErr } = await supabase
      .from("historial_cajas")
      .select("id,total_arqueo,caja_inicial,total_egresos")
      .eq("fecha", fecha)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!hist) return; // No hay cierre todavía, nada que recalcular
    const nuevoEgresos = round2(Number(hist.total_egresos || 0) + deltaEgreso);
    const nuevaVentaReal = round2(
      Number(hist.total_arqueo || 0) - Number(hist.caja_inicial || 0) + nuevoEgresos
    );
    const { error: upErr } = await supabase
      .from("historial_cajas")
      .update({ total_egresos: nuevoEgresos, venta_real: nuevaVentaReal })
      .eq("id", hist.id);
    if (upErr) throw upErr;
  };

  const addEgreso = useMutation({
    mutationFn: async () => {
      const m = round2(egMonto);
      if (!m || m <= 0) throw new Error("Monto inválido");
      const { error } = await supabase.from("transacciones").insert({
        tipo: "gasto",
        metodo_pago: "efectivo",
        monto: m,
        descripcion: egDesc || null,
        empleado_id: empleado.id,
        registrado_por: empleado.nombre,
        origen: "manual",
      });
      if (error) throw error;
      await recalcHistorialCajas(m);
    },
    onSuccess: () => {
      toast.success("Egreso registrado");
      setEgDesc(""); setEgMonto("");
      qc.invalidateQueries({ queryKey: ["egresos-hoy", fecha] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      qc.invalidateQueries({ queryKey: ["historial"] });
      qc.invalidateQueries({ queryKey: ["arqueo-hoy"] });
      qc.invalidateQueries({ queryKey: ["caja-inicial-hoy"] });
      qc.invalidateQueries({ queryKey: ["historial_cajas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delEgreso = useMutation({
    mutationFn: async (id: string) => {
      const { data: tx, error: txErr } = await supabase
        .from("transacciones")
        .select("monto")
        .eq("id", id)
        .maybeSingle();
      if (txErr) throw txErr;
      const monto = round2(tx?.monto || 0);
      const { error } = await supabase.from("transacciones").delete().eq("id", id);
      if (error) throw error;
      if (monto > 0) await recalcHistorialCajas(-monto);
    },
    onSuccess: () => {
      toast.success("Egreso eliminado");
      qc.invalidateQueries({ queryKey: ["egresos-hoy", fecha] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      qc.invalidateQueries({ queryKey: ["arqueo-hoy"] });
      qc.invalidateQueries({ queryKey: ["caja-inicial-hoy"] });
      qc.invalidateQueries({ queryKey: ["historial_cajas"] });
    },
  });

  const ARQ_KEYS = {
    pichincha: `arqueo_banco_pichincha_${fecha}`,
    guayaquil: `arqueo_banco_guayaquil_${fecha}`,
    billetes: `arqueo_billetes_${fecha}`,
    monedas: `arqueo_monedas_${fecha}`,
  };
  const [bancoPichincha, setBancoPichincha] = useLocalStorage<string>(ARQ_KEYS.pichincha, "");
  const [bancoGuayaquil, setBancoGuayaquil] = useLocalStorage<string>(ARQ_KEYS.guayaquil, "");
  const [billetes, setBilletes] = useLocalStorage<string>(ARQ_KEYS.billetes, "");
  const [monedas, setMonedas] = useLocalStorage<Record<DenomKey, string>>(ARQ_KEYS.monedas, {
    m100: "", m050: "", m025: "", m010: "", m005: "",
  });

  const limpiarArqueo = () => {
    setBancoPichincha("");
    setBancoGuayaquil("");
    setBilletes("");
    setMonedas({ m100: "", m050: "", m025: "", m010: "", m005: "" });
  };

  // Sugerir Caja Inicial de hoy = Total Arqueo de ayer (último cierre guardado)
  const ultimoCierreQ = useQuery({
    queryKey: ["ultimo-cierre", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historial_cajas")
        .select("fecha,total_arqueo")
        .lt("fecha", fecha)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const sugerenciaCajaInicial = ultimoCierreQ.data ? Number(ultimoCierreQ.data.total_arqueo) : 0;

  const totalEgresos = useMemo(
    () => (egresosQ.data ?? []).reduce((s, e) => s + Number(e.monto), 0),
    [egresosQ.data]
  );
  // Solo los abonos en efectivo afectan el dinero físico esperado en caja
  const totalCobroDeudas = useMemo(
    () => (cobrosDeudasQ.data ?? [])
      .filter((a: any) => a.metodo_pago === "efectivo")
      .reduce((s: number, a: any) => s + Number(a.monto), 0),
    [cobrosDeudasQ.data]
  );
  // Ahora el input representa el VALOR EN $ por denominación (no la cantidad)
  const totalMonedas = useMemo(
    () => DENOMS.reduce((s, d) => s + (Number(monedas[d.key]) || 0), 0),
    [monedas]
  );
  const totalBancos = (Number(bancoPichincha) || 0) + (Number(bancoGuayaquil) || 0);
  const totalArqueoCaja = totalBancos + (Number(billetes) || 0) + totalMonedas;
  const dineroEsperado = (Number(cajaInicial) || 0) - totalEgresos;
  const ventaRealDelDia = totalArqueoCaja - dineroEsperado;

  const finalizarDia = useMutation({
    mutationFn: async () => {
      if (!cajaInicial) throw new Error("Ingresa la Caja Inicial");
      const monedasDetalle = {
        ...Object.fromEntries(DENOMS.map((d) => [d.key, Number(monedas[d.key]) || 0])),
        banco_pichincha: Number(bancoPichincha) || 0,
        banco_guayaquil: Number(bancoGuayaquil) || 0,
      };
      const { error } = await supabase.from("historial_cajas").upsert({
        fecha,
        caja_inicial: Number(cajaInicial) || 0,
        total_egresos: totalEgresos,
        bancos: totalBancos,
        billetes: Number(billetes) || 0,
        monedas: monedasDetalle,
        total_arqueo: totalArqueoCaja,
        venta_real: ventaRealDelDia,
        empleado_id: empleado.id,
      }, { onConflict: "fecha" });
      if (error) throw error;

      // Registrar movimiento de "Cierre de Caja" en el historial de transacciones
      const desc = `Cierre de Caja — Venta Real: ${formatCurrency(ventaRealDelDia)}, Gastos: ${formatCurrency(totalEgresos)}, Pichincha: ${formatCurrency(Number(bancoPichincha) || 0)}, Guayaquil: ${formatCurrency(Number(bancoGuayaquil) || 0)}`;
      await supabase.from("transacciones").insert({
        tipo: "fondo_caja",
        metodo_pago: "efectivo",
        monto: totalArqueoCaja,
        descripcion: desc,
        empleado_id: empleado.id,
        registrado_por: empleado.nombre,
        origen: "cierre_caja",
      });
    },
    onSuccess: () => {
      toast.success("Día finalizado y guardado en historial");
      qc.invalidateQueries({ queryKey: ["historial"] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      qc.invalidateQueries({ queryKey: ["ultimo-cierre"] });
      // Limpiar caja inicial y arqueo locales
      if (typeof window !== "undefined") {
        localStorage.removeItem(`caja_inicial_${fecha}`);
        Object.values(ARQ_KEYS).forEach((k) => localStorage.removeItem(k));
      }
      limpiarArqueo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {isAdmin && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> A. Apertura del Día
          </CardTitle>
          <CardDescription>Dinero base con el que se abre la caja hoy</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="caja-inicial" className="text-sm">Caja Inicial</Label>
          <div className="relative mt-1.5 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">$</span>
            <Input
              id="caja-inicial"
              inputMode="decimal"
              type="number"
              step="0.01"
              value={cajaInicial}
              onChange={(e) => guardarCajaInicial(e.target.value)}
              placeholder="0.00"
              className="h-14 pl-8 text-2xl font-bold"
            />
          </div>
          {sugerenciaCajaInicial > 0 && !cajaInicial && (
            <button
              type="button"
              onClick={() => guardarCajaInicial(String(sugerenciaCajaInicial))}
              className="mt-2 text-xs text-primary underline underline-offset-2 hover:no-underline"
            >
              Usar saldo del cierre anterior: {formatCurrency(sugerenciaCajaInicial)}
            </button>
          )}
        </CardContent>
      </Card>
      )}

      {isAdmin ? (
      <Card>

        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" /> B. Egresos del Día
          </CardTitle>
          <CardDescription>Gastos pagados desde la caja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input
                value={egDesc}
                onChange={(e) => setEgDesc(e.target.value)}
                placeholder="Ej: pago luz"
                className="h-12 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={egMonto}
                onChange={(e) => setEgMonto(e.target.value)}
                placeholder="0.00"
                className="h-12 mt-1 text-lg"
              />
            </div>
            <Button onClick={() => addEgreso.mutate()} disabled={addEgreso.isPending} className="h-12">
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(egresosQ.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      Sin egresos registrados
                    </TableCell>
                  </TableRow>
                )}
                {(egresosQ.data ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.descripcion || <span className="text-muted-foreground italic">Sin descripción</span>}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {formatCurrency(Number(e.monto))}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delEgreso.mutate(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium text-muted-foreground">Total Egresos</span>
            <span className="text-xl font-bold text-destructive">{formatCurrency(totalEgresos)}</span>
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Fiados recientes
            </CardTitle>
            <CardDescription>Últimos 15 días — auditoría por empleado</CardDescription>
          </CardHeader>
          <CardContent>
            <FiadosRecientes days={15} showFilter />
          </CardContent>
        </Card>
      )}

      {isAdmin && (<>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" /> C. Arqueo / Cierre de Caja
          </CardTitle>
          <CardDescription>Dinero físico que hay al cierre del día</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Bancos / Transferencias</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-yellow-950 font-extrabold text-xs">BP</span>
                  <Label className="text-sm font-bold">Banco Pichincha</Label>
                </div>
                <Input type="number" inputMode="decimal" step="0.01" value={bancoPichincha} onChange={(e) => setBancoPichincha(e.target.value)} placeholder="0.00" className="h-12 text-lg bg-background" />
              </div>
              <div className="rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white font-extrabold text-xs">BG</span>
                  <Label className="text-sm font-bold">Banco Guayaquil</Label>
                </div>
                <Input type="number" inputMode="decimal" step="0.01" value={bancoGuayaquil} onChange={(e) => setBancoGuayaquil(e.target.value)} placeholder="0.00" className="h-12 text-lg bg-background" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-muted-foreground">Subtotal Bancos</span>
              <span className="font-semibold">{formatCurrency(totalBancos)}</span>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs">Billetes (efectivo)</Label>
            <Input type="number" inputMode="decimal" step="0.01" value={billetes} onChange={(e) => setBilletes(e.target.value)} placeholder="0.00" className="h-12 mt-1 text-lg max-w-sm" />
          </div>

          <Separator />

          <div>
            <Label className="text-sm font-semibold">Monedas (valor en $ por denominación)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-2">
              {DENOMS.map((d) => {
                const monto = Number(monedas[d.key]) || 0;
                const cant = d.value > 0 ? monto / d.value : 0;
                return (
                  <div key={d.key} className="rounded-lg border p-3 bg-muted/30">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-sm">{d.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {cant ? `≈ ${cant % 1 === 0 ? cant : cant.toFixed(1)} u` : ""}
                      </span>
                    </div>
                    <Input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      value={monedas[d.key]}
                      onChange={(e) => setMonedas((m) => ({ ...m, [d.key]: e.target.value }))}
                      placeholder="0.00"
                      className="h-11 text-base text-center"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-muted-foreground">Subtotal monedas</span>
              <span className="font-semibold">{formatCurrency(totalMonedas)}</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={limpiarArqueo}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpiar valores
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Resumen del Día
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Caja Inicial" value={formatCurrency(Number(cajaInicial) || 0)} />
          <Row label="(-) Gastos" value={formatCurrency(totalEgresos)} className="text-destructive" />
          <Row label="(=) Efectivo Base Esperado" value={formatCurrency(dineroEsperado)} bold />
          <Separator className="my-2" />
          <Row label="Total en Caja (arqueo físico)" value={formatCurrency(totalArqueoCaja)} bold />
          <Separator className="my-2" />
          <div className="flex justify-between items-center bg-success/10 rounded-lg p-3">
            <span className="text-base font-bold">VENTA REAL DEL DÍA</span>
            <span className={cn("text-2xl font-extrabold", ventaRealDelDia >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(ventaRealDelDia)}
            </span>
          </div>
          <p className="text-center text-xs text-muted-foreground -mt-1">
            = Total en Caja − Efectivo Base Esperado
          </p>
          <p className="text-center text-sm pt-2">
            Saldo para iniciar mañana:{" "}
            <span className="font-bold text-primary">{formatCurrency(totalArqueoCaja)}</span>
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={finalizarDia.isPending || !cajaInicial} className="w-full h-12 text-base mt-2">
                {finalizarDia.isPending ? "Guardando..." : "Finalizar Día"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar cierre del día</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 pt-2">
                    <p>Se guardará el resumen del día en el historial.</p>
                    <div className="rounded-lg border bg-muted/40 p-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo para iniciar mañana</p>
                      <p className="text-3xl font-extrabold text-primary mt-1">{formatCurrency(totalArqueoCaja)}</p>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>Venta real del día:</span>
                      <span className={cn("font-semibold", ventaRealDelDia >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(ventaRealDelDia)}</span>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => finalizarDia.mutate()}>Sí, finalizar día</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
      </>)}
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between items-center py-1", className)}>
      <span className={cn("text-sm", bold && "font-semibold")}>{label}</span>
      <span className={cn("text-base", bold ? "font-bold" : "font-medium")}>{value}</span>
    </div>
  );
}

/* ---------- FIADOS POS ---------- */

type Producto = { id: string; nombre: string; precio: number; categoria: string; color: string };
type Cliente = { id: string; nombre: string };
type CartItem = { producto: Producto; cantidad: number };

function FiadosTab() {
  const empleado = useEmpleado((s) => s.empleado)!;
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState<string>("");
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [fechaDeuda, setFechaDeuda] = useState<Date>(new Date());
  const [categoriaActiva, setCategoriaActiva] = useState<string>("Todos");
  const [busqueda, setBusqueda] = useState("");

  const productos = useQuery({
    queryKey: ["productos-activos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("id,nombre,precio,categorias(id,nombre,color)").eq("activo", true).order("nombre");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ 
        ...p, 
        precio: Number(p.precio),
        categoria: p.categorias?.nombre || "Otros",
        color: p.categorias?.color || "slate"
      })) as Producto[];
    },
  });

  const clientes = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id,nombre").order("nombre");
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const total = Object.values(cart).reduce((s, i) => s + i.cantidad * i.producto.precio, 0);

  const addToCart = (p: Producto) => {
    setCart((c) => ({ ...c, [p.id]: { producto: p, cantidad: (c[p.id]?.cantidad ?? 0) + 1 } }));
  };
  const inc = (id: string) => setCart((c) => ({ ...c, [id]: { ...c[id], cantidad: c[id].cantidad + 1 } }));
  const dec = (id: string) =>
    setCart((c) => {
      const cur = c[id];
      if (!cur) return c;
      if (cur.cantidad <= 1) {
        const { [id]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: { ...cur, cantidad: cur.cantidad - 1 } };
    });
  const removeItem = (id: string) =>
    setCart((c) => {
      const { [id]: _, ...rest } = c;
      return rest;
    });




  const confirmar = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Selecciona un cliente");
      const items = Object.values(cart);
      if (items.length === 0) throw new Error("Agrega productos");
      const rows = items.map((i) => ({
        cliente_id: clienteId,
        producto_id: i.producto.id,
        producto_nombre: i.producto.nombre,
        precio_unitario: i.producto.precio,
        cantidad: i.cantidad,
        monto: i.cantidad * i.producto.precio,
        empleado_id: empleado.id,
        registrado_por: empleado.nombre,
        created_at: fechaDeuda.toISOString(),
      }));
      const { error } = await supabase.from("deudas").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiado registrado");
      setCart({});
      setFechaDeuda(new Date());
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["deudores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-3">
        <Card className="p-3 flex flex-col gap-3">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full h-12 rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">Selecciona cliente…</option>
            {(clientes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground ml-1">Fecha de la Deuda</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal",
                    !fechaDeuda && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fechaDeuda ? format(fechaDeuda, "PPP HH:mm", { locale: es }) : <span>Selecciona una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaDeuda}
                  onSelect={(date) => {
                    if (date) {
                      const newDate = new Date(date);
                      const now = new Date();
                      newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                      setFechaDeuda(newDate);
                    }
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
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
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["Todos", ...Array.from(new Set((productos.data ?? []).map((p) => p.categoria)))].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaActiva(cat)}
              className={cn(
                "px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors",
                categoriaActiva === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:[&>*]:max-w-[180px] lg:[&>*]:max-w-none md:[&>*]:w-full">
          {(productos.data ?? [])
            .filter((p) => categoriaActiva === "Todos" || p.categoria === categoriaActiva)
            .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            .map((p) => {
              const bgMap: Record<string, string> = {
                blue: "bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-200",
                orange: "bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-200",
                green: "bg-green-100 hover:bg-green-200 text-green-900 border-green-200",
                red: "bg-red-100 hover:bg-red-200 text-red-900 border-red-200",
                slate: "bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-200",
                yellow: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-200",
                purple: "bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-200",
                pink: "bg-pink-100 hover:bg-pink-200 text-pink-900 border-pink-200",
              };
              const colorClass = bgMap[p.color] || bgMap.slate;

              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={cn(
                    "p-3 rounded-xl border shadow-sm active:scale-[.98] transition text-left flex flex-col h-full min-h-[88px]",
                    colorClass
                  )}
                >
                  <div className="font-semibold text-sm md:text-base leading-tight line-clamp-2 mb-2">{p.nombre}</div>
                  <div className="text-sm font-medium opacity-90 mt-auto">{formatCurrency(p.precio)}</div>
                </button>
              );
            })}
          {productos.data?.filter((p) => categoriaActiva === "Todos" || p.categoria === categoriaActiva).filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground p-4">No se encontraron productos.</p>
          )}
        </div>
      </div>

      <Card className="p-4 space-y-3 md:sticky md:top-4 self-start">
        <h3 className="font-semibold">Carrito</h3>
        <div className="space-y-2 max-h-96 overflow-auto">
          {Object.values(cart).length === 0 && <p className="text-sm text-muted-foreground">Vacío</p>}
          {Object.values(cart).map(({ producto, cantidad }) => (
            <div key={producto.id} className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{producto.nombre}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(producto.precio)} c/u</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => dec(producto.id)}><Minus className="h-4 w-4" /></Button>
                <span className="w-7 text-center font-semibold">{cantidad}</span>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => inc(producto.id)}><Plus className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeItem(producto.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold border-t pt-2">
          <span>Total</span><span>{formatCurrency(total)}</span>
        </div>
        <Button className="w-full h-12 text-base" onClick={() => confirmar.mutate()} disabled={confirmar.isPending || total === 0 || !clienteId}>
          {confirmar.isPending ? "Guardando..." : "Confirmar fiado"}
        </Button>
      </Card>
    </div>
  );
}
