import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/deudores/")({
  component: DeudoresPage,
});

function DeudoresPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["deudores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nombre,saldo_total,deudas(created_at,estado)");
      if (error) throw error;
      
      const processed = (data ?? []).map((c) => {
        const deudasArray = Array.isArray(c.deudas) ? c.deudas : [];
        const pendingDeudas = deudasArray.filter((d: any) => d.estado === 'pendiente');
        
        let oldestDate: Date | null = null;
        if (pendingDeudas.length > 0) {
          oldestDate = new Date(Math.min(...pendingDeudas.map((d: any) => new Date(d.created_at).getTime())));
        }
        
        const hasAlerta = oldestDate ? (new Date().getTime() - oldestDate.getTime()) > 7 * 24 * 60 * 60 * 1000 : false;
        
        return {
          id: c.id,
          nombre: c.nombre,
          saldo_total: c.saldo_total,
          hasAlerta,
          oldestDate
        };
      });

      return processed.sort((a, b) => {
        if (a.hasAlerta && !b.hasAlerta) return -1;
        if (!a.hasAlerta && b.hasAlerta) return 1;
        return Number(b.saldo_total) - Number(a.saldo_total);
      });
    },
  });

  const filtered = (data ?? []).filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase()));
  const totalDeuda = (data ?? []).reduce((s, c) => s + Number(c.saldo_total), 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold">Cuentas por cobrar</h2>
        <span className="text-sm text-muted-foreground">Total: <strong className="text-foreground">{formatCurrency(totalDeuda)}</strong></span>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente..." className="h-12" />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="space-y-2">
        {filtered.map((c) => {
          const saldo = Number(c.saldo_total);
          return (
            <Link key={c.id} to="/deudores/$clienteId" params={{ clienteId: c.id }}>
              <Card className={`p-4 flex items-center justify-between hover:bg-accent/20 transition ${saldo > 0 ? "" : "opacity-60"} ${c.hasAlerta ? 'bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-900/50' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{c.nombre}</div>
                    {c.hasAlerta && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />}
                  </div>
                  {c.hasAlerta && (
                    <div className="text-xs text-red-600 dark:text-red-500 font-medium mt-0.5">
                      Deuda antigua (+7 días)
                    </div>
                  )}
                  <div className={`text-sm ${saldo > 0 ? (c.hasAlerta ? "text-red-700 dark:text-red-400 font-semibold" : "text-destructive font-semibold") : "text-muted-foreground"} ${c.hasAlerta ? 'mt-0.5' : ''}`}>
                    {formatCurrency(saldo)}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin clientes</p>
        )}
      </div>
    </div>
  );
}
