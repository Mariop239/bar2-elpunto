import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";
import { Banknote, Receipt, PlusCircle, Wallet, Clock, ArrowRight, Coins, AlertCircle } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { useEmpleado } from "@/lib/empleado-store";
import { FiadosRecientes } from "@/components/fiados-recientes";

export const Route = createFileRoute("/_app/inicio")({
  component: Dashboard,
});

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDayRange() {
  const fecha = todayDate();
  const ini = new Date(fecha + "T00:00:00").toISOString();
  const fin = new Date(fecha + "T23:59:59.999").toISOString();
  return { ini, fin };
}

function Dashboard() {
  const empleado = useEmpleado((s) => s.empleado);
  if (empleado && empleado.rol !== "admin") return <Navigate to="/registro" replace />;
  const qc = useQueryClient();

  // Sincronización en vivo entre admins
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "historial_cajas" }, () => {
        qc.invalidateQueries({ queryKey: ["arqueo-hoy"] });
        qc.invalidateQueries({ queryKey: ["caja-inicial-hoy"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transacciones" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deudas" }, () => {
        qc.invalidateQueries({ queryKey: ["ultimas-deudas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Arqueo del día (si existe)
  const arqueo = useQuery({
    queryKey: ["arqueo-hoy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historial_cajas")
        .select("*")
        .eq("fecha", todayDate())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
  });

  // Movimientos del día (gastos y fallback de venta real)
  // Misma lógica que /ajustes/historial: rango por día local, filtrado por tipo='gasto'
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-hoy", todayDate()],
    queryFn: async () => {
      const { ini, fin } = localDayRange();
      const { data: hoy, error } = await supabase
        .from("transacciones")
        .select("tipo,metodo_pago,monto")
        .gte("created_at", ini)
        .lte("created_at", fin);
      if (error) throw error;

      const totals = (hoy ?? []).reduce(
        (acc, t) => {
          const m = Number(t.monto);
          if (t.tipo === "ingreso") {
            if (t.metodo_pago === "efectivo") acc.ingresoEfectivo += m;
            else acc.ingresoTransferencia += m;
          } else if (t.tipo === "gasto") {
            acc.gasto += m;
          }
          return acc;
        },
        { ingresoEfectivo: 0, ingresoTransferencia: 0, gasto: 0 }
      );
      return totals;
    },
    refetchOnWindowFocus: true,
  });

  // Caja inicial = valor ingresado hoy en /registro (localStorage),
  // o el total_arqueo del último cierre anterior a hoy como fallback.
  const cajaInicialQ = useQuery({
    queryKey: ["caja-inicial-hoy"],
    queryFn: async () => {
      const fecha = todayDate();
      const local =
        typeof window !== "undefined"
          ? localStorage.getItem(`caja_inicial_${fecha}`)
          : null;
      if (local && !Number.isNaN(Number(local)) && Number(local) > 0) {
        return Number(local);
      }
      const { data, error } = await supabase
        .from("historial_cajas")
        .select("total_arqueo,fecha")
        .lt("fecha", fecha)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.total_arqueo) : 0;
    },
    refetchOnWindowFocus: true,
  });

  const ultimasDeudas = useQuery({
    queryKey: ["ultimas-deudas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deudas")
        .select("id, monto, created_at, empleado:empleados(nombre)")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const t = data ?? { ingresoEfectivo: 0, ingresoTransferencia: 0, gasto: 0 };
  const hasArqueo = !!arqueo.data;

  // Venta Real solo se conoce con el arqueo del día.
  const ventaReal = hasArqueo ? Number(arqueo.data!.venta_real) : null;
  const totalEgresos = hasArqueo ? Number(arqueo.data!.total_egresos) : t.gasto;
  const cajaInicial = hasArqueo
    ? Number(arqueo.data!.caja_inicial)
    : (cajaInicialQ.data ?? 0);

  return (
    <PageTransition>
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Resumen del día</h2>
          <p className="text-sm text-muted-foreground capitalize">{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {!arqueo.isLoading && !hasArqueo && (
          <Badge variant="outline" className="gap-1.5 border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-3.5 w-3.5" /> Pendiente de Arqueo
          </Badge>
        )}
      </div>

      {/* Cards principales alineadas con el cierre de caja */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm">
          <Coins className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          <p className="mt-2 text-xs text-muted-foreground">Caja Inicial</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {cajaInicialQ.isLoading || arqueo.isLoading ? "—" : formatCurrency(cajaInicial)}
          </p>
        </Card>
        <Card className="p-4 bg-destructive/10 border-destructive/20 rounded-xl shadow-sm">
          <Receipt className="h-6 w-6 text-destructive" />
          <p className="mt-2 text-xs text-muted-foreground">Gastos / Egresos</p>
          <p className="text-2xl font-bold text-destructive">{isLoading || arqueo.isLoading ? "—" : formatCurrency(totalEgresos)}</p>
        </Card>
        {arqueo.isLoading ? (
          <Card className="p-4 bg-muted/40 border-dashed rounded-xl shadow-sm">
            <Banknote className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Venta Real del día</p>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          </Card>
        ) : ventaReal !== null ? (
          <Card className="p-4 bg-success/10 border-success/30 rounded-xl shadow-sm ring-1 ring-success/20">
            <div className="flex items-center justify-between">
              <Banknote className="h-6 w-6 text-success" />
              <Badge className="bg-success/15 text-success hover:bg-success/15 border-success/30 text-[10px]">Cierre realizado</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Venta Real del día</p>
            <p className="text-3xl font-extrabold text-success tracking-tight">{formatCurrency(ventaReal)}</p>
          </Card>
        ) : (
          <Card className="p-4 bg-muted/30 border-dashed border-muted-foreground/30 rounded-xl shadow-none">
            <Banknote className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Venta Real del día</p>
            <p className="text-sm font-medium text-muted-foreground italic">Pendiente de arqueo</p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-16 text-base">
          <Link to="/registro"><PlusCircle className="h-5 w-5 mr-2" /> Registrar</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-16 text-base">
          <Link to="/deudores"><Wallet className="h-5 w-5 mr-2" /> Cobrar fiado</Link>
        </Button>
      </div>

      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" /> Últimos Fiados Registrados
          </h3>
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
            <Link to="/ajustes/historial">Ver más <ArrowRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>

        <div className="space-y-2">
          {ultimasDeudas.isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
          {!ultimasDeudas.isLoading && ultimasDeudas.data?.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-muted/30 text-center">No hay fiados recientes</p>
          )}
          {ultimasDeudas.data?.map((deuda: any) => (
            <Card key={deuda.id} className="p-3 flex items-center justify-between border-border/50 shadow-sm">
              <div>
                <p className="font-medium text-sm">{formatCurrency(deuda.monto)}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(new Date(deuda.created_at), "dd MMM, HH:mm", { locale: es })}
                </p>
              </div>
              <div className="text-xs font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-md">
                {deuda.empleado?.nombre || "Sistema"}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
