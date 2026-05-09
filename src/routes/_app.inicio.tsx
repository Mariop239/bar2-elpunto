import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { Banknote, ArrowLeftRight, ShoppingCart, Receipt, PlusCircle, Wallet } from "lucide-react";

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
      const { data, error } = await supabase
        .from("transacciones")
        .select("tipo,metodo_pago,monto")
        .gte("created_at", since);
      if (error) throw error;
      const totals = { ingresoEfectivo: 0, ingresoTransferencia: 0, costo: 0, gasto: 0 };
      for (const t of data ?? []) {
        const m = Number(t.monto);
        if (t.tipo === "ingreso") {
          if (t.metodo_pago === "efectivo") totals.ingresoEfectivo += m;
          else totals.ingresoTransferencia += m;
        } else if (t.tipo === "costo") totals.costo += m;
        else if (t.tipo === "gasto") totals.gasto += m;
      }
      return totals;
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
            <p className="text-xl md:text-2xl font-bold">{isLoading ? "—" : formatCOP(c.value)}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Balance del día</p>
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
          {isLoading ? "—" : formatCOP(balance)}
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
    </div>
  );
}
