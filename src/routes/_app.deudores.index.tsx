import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

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
        .select("id,nombre,saldo_total")
        .order("saldo_total", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
              <Card className={`p-4 flex items-center justify-between hover:bg-accent/20 transition ${saldo > 0 ? "" : "opacity-60"}`}>
                <div>
                  <div className="font-semibold">{c.nombre}</div>
                  <div className={`text-sm ${saldo > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
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
