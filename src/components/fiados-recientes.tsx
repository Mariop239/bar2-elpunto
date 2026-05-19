import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UserCircle2 } from "lucide-react";

type Props = {
  /** Cantidad máxima a mostrar; si no se pasa, muestra todos los del rango */
  limit?: number;
  /** Días hacia atrás (por defecto 15) */
  days?: number;
  /** Mostrar etiqueta "Registrado por" */
  showAuthor?: boolean;
  className?: string;
  emptyText?: string;
};

export function FiadosRecientes({
  limit,
  days = 15,
  showAuthor = true,
  className,
  emptyText = "No hay fiados registrados",
}: Props) {
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

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando...</p>;
  }
  if (!q.data || q.data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-muted/30 text-center">
        {emptyText}
      </p>
    );
  }

  return (
    <div className={className ?? "space-y-2"}>
      {q.data.map((d: any) => {
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
  );
}
