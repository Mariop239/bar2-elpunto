import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Cantidad máxima a mostrar; si no se pasa, muestra todos los del rango */
  limit?: number;
  /** Días hacia atrás (por defecto 15) */
  days?: number;
  /** Mostrar etiqueta "Registrado por" */
  showAuthor?: boolean;
  /** Mostrar buscador por nombre de cliente */
  showFilter?: boolean;
  className?: string;
  emptyText?: string;
};

export function FiadosRecientes({
  limit,
  days = 15,
  showAuthor = true,
  showFilter = false,
  className,
  emptyText = "No hay fiados registrados",
}: Props) {
  const [filtro, setFiltro] = useState("");

  const q = useQuery({
    queryKey: ["fiados-recientes", days, limit ?? "all"],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - days);
      let query = supabase
        .from("deudas")
        .select("id, monto, created_at, producto_nombre, cantidad, registrado_por, cliente:clientes(nombre), empleado:empleados(nombre)")
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: true,
  });

  const filtrados = useMemo(() => {
    if (!q.data) return [];
    const term = filtro.trim().toLowerCase();
    if (!term) return q.data;
    return q.data.filter((d: any) =>
      (d.cliente?.nombre || "").toLowerCase().includes(term)
    );
  }, [q.data, filtro]);

  const filterInput = showFilter ? (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por nombre de cliente..."
        className="pl-8 pr-8 h-9"
      />
      {filtro && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setFiltro("")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  ) : null;

  if (q.isLoading) {
    return (
      <>
        {filterInput}
        <p className="text-xs text-muted-foreground">Cargando...</p>
      </>
    );
  }
  if (!q.data || q.data.length === 0) {
    return (
      <>
        {filterInput}
        <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-muted/30 text-center">
          {emptyText}
        </p>
      </>
    );
  }

  return (
    <>
      {filterInput}
      {filtrados.length === 0 ? (
        <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-muted/30 text-center">
          Sin coincidencias para "{filtro}"
        </p>
      ) : (
        <div className={className ?? "space-y-2"}>
          {filtrados.map((d: any) => {
            const autor = d.registrado_por || d.empleado?.nombre || "Sistema";
            return (
              <Card key={d.id} className="p-3 border-border/50 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {d.cliente?.nombre || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.cantidad > 1 ? `${d.cantidad}× ` : ""}
                      {d.producto_nombre}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                      {format(new Date(d.created_at), "dd MMM, HH:mm", { locale: es })}
                    </p>
                    {showAuthor && (
                      <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <UserCircle2 className="h-3 w-3" />
                        Registrado por:{" "}
                        <span className="font-medium text-foreground/80">{autor}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{formatCurrency(Number(d.monto))}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
