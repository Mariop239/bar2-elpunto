import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Banknote, ArrowLeftRight, ShoppingCart, Receipt, PlusCircle, Wallet, Clock, ArrowRight, Briefcase, Coins } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_app/inicio")({
  component: Dashboard,
});

function startOfDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-hoy"],
    queryFn: async () => {
      const since = startOfDayISO();

      // Hoy
      const { data: hoy, error } = await supabase
        .from("transacciones")
        .select("tipo,metodo_pago,monto")
        .gte("created_at", since);
      if (error) throw error;

      // Fondo inicial = suma de fondo_caja del día anterior (entre ayer 00:00 y hoy 00:00)
      const startToday = new Date(); startToday.setHours(0,0,0,0);
      const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
      const { data: fondoPrev, error: errFondo } = await supabase
        .from("transacciones")
        .select("monto")
        .eq("tipo", "fondo_caja")
        .gte("created_at", startYesterday.toISOString())
        .lt("created_at", startToday.toISOString());
      if (errFondo) throw errFondo;

      const totals = { ingresoEfectivo: 0, ingresoTransferencia: 0, costo: 0, gasto: 0, fondoCajaHoy: 0 };
      for (const t of hoy ?? []) {
        const m = Number(t.monto);
        if (t.tipo === "ingreso") {
          if (t.metodo_pago === "efectivo") totals.ingresoEfectivo += m;
          else totals.ingresoTransferencia += m;
        } else if (t.tipo === "costo") totals.costo += m;
        else if (t.tipo === "gasto") totals.gasto += m;
        else if (t.tipo === "fondo_caja") totals.fondoCajaHoy += m;
      }
      const fondoInicial = (fondoPrev ?? []).reduce((s, r: any) => s + Number(r.monto), 0);
      return { ...totals, fondoInicial };
    },
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

  const t = data ?? { ingresoEfectivo: 0, ingresoTransferencia: 0, costo: 0, gasto: 0 };
  const balance = t.ingresoEfectivo + t.ingresoTransferencia - t.costo - t.gasto;

  const cards = [
    { label: "Ingresos efectivo", value: t.ingresoEfectivo, icon: Banknote, color: "text-success", bg: "bg-success/10" },
    { label: "Ingresos transferencia", value: t.ingresoTransferencia, icon: ArrowLeftRight, color: "text-success", bg: "bg-success/10" },
    { label: "Costos (insumos)", value: t.costo, icon: ShoppingCart, color: "text-warning-foreground", bg: "bg-warning/30" },
    { label: "Gastos (operativos)", value: t.gasto, icon: Receipt, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Resumen del día</h2>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={`p-4 ${c.bg} border-0`}>
            <div className="flex items-center justify-between">
              <c.icon className={`h-6 w-6 ${c.color}`} />
            </div>
            <p className="mt-2 text-xs md:text-sm text-muted-foreground">{c.label}</p>
            <p className="text-xl md:text-2xl font-bold">{isLoading ? "—" : formatCurrency(c.value)}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Balance del día</p>
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
          {isLoading ? "—" : formatCurrency(balance)}
        </p>
      </Card>

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
  );
}
