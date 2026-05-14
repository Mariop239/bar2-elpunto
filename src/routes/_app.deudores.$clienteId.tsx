import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Trash2, Pencil, CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { useEmpleado } from "@/lib/empleado-store";
import { formatCurrency, cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/deudores/$clienteId")({
  component: DetalleDeudor,
});

type Metodo = "efectivo" | "transferencia";

function DetalleDeudor() {
  const { clienteId } = Route.useParams();
  const empleado = useEmpleado((s) => s.empleado)!;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const cliente = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id,nombre,saldo_total").eq("id", clienteId).single();
      if (error) throw error;
      return data;
    },
  });

  const deudas = useQuery({
    queryKey: ["deudas", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deudas")
        .select("id,producto_nombre,cantidad,precio_unitario,monto,estado,created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const abonar = useMutation({
    mutationFn: async ({ monto, metodo }: { monto: number; metodo: Metodo }) => {
      const { error } = await supabase.rpc("aplicar_abono", {
        p_cliente: clienteId, p_monto: monto, p_metodo: metodo, p_empleado: empleado.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago registrado");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudas", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudores"] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminarCliente = useMutation({
    mutationFn: async () => {
      await supabase.from("abonos").delete().eq("cliente_id", clienteId);
      await supabase.from("deudas").delete().eq("cliente_id", clienteId);
      const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["deudores"] });
      navigate({ to: "/deudores" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editarDeuda = useMutation({
    mutationFn: async ({ id, cantidad, precio_unitario, created_at }: { id: string; cantidad: number; precio_unitario: number; created_at: string }) => {
      const monto = cantidad * precio_unitario;
      const { error } = await supabase
        .from("deudas")
        .update({ cantidad, monto, created_at })
        .eq("id", id);
      if (error) throw error;
      const { error: rpcErr } = await supabase.rpc("recalcular_saldo_cliente", { p_cliente: clienteId });
      if (rpcErr) throw rpcErr;
    },
    onSuccess: () => {
      toast.success("Deuda actualizada");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudas", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminarDeuda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deudas").delete().eq("id", id);
      if (error) throw error;
      const { error: rpcErr } = await supabase.rpc("recalcular_saldo_cliente", { p_cliente: clienteId });
      if (rpcErr) throw rpcErr;
    },
    onSuccess: () => {
      toast.success("Registro eliminado");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudas", clienteId] });
      qc.invalidateQueries({ queryKey: ["deudores"] });
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saldo = Number(cliente.data?.saldo_total ?? 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/deudores"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Link>
        </Button>
        {empleado.rol === "admin" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={eliminarCliente.isPending}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará al cliente, junto con todas sus deudas y abonos asociados de forma permanente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => eliminarCliente.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Cliente</p>
        <h2 className="text-2xl font-bold">{cliente.data?.nombre ?? "..."}</h2>
        <p className="text-sm text-muted-foreground mt-2">Saldo total</p>
        <p className={`text-3xl font-bold ${saldo > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(saldo)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <PagarTodoDialog saldo={saldo} onConfirm={(metodo) => abonar.mutate({ monto: saldo, metodo })} disabled={saldo <= 0 || abonar.isPending} />
          <AbonarDialog saldo={saldo} onConfirm={(monto, metodo) => abonar.mutate({ monto, metodo })} disabled={saldo <= 0 || abonar.isPending} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Detalle de consumo</h3>
        <div className="space-y-2">
          {(deudas.data ?? []).map((d) => (
            <div key={d.id} className={cn("flex items-center justify-between text-sm border-b pb-2 last:border-0", d.estado === "pagado" && "opacity-50 line-through")}>
              <div>
                <div className="font-medium">{d.producto_nombre} × {d.cantidad}</div>
                <div className="text-xs text-muted-foreground">{new Date(d.created_at as string).toLocaleString("es-CO")}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">{formatCurrency(Number(d.monto))}</div>
                {empleado.rol === "admin" && d.estado === "pendiente" && (
                  <>
                    <EditarDeudaDialog
                      deuda={{ id: d.id, cantidad: d.cantidad, precio_unitario: Number(d.precio_unitario), created_at: d.created_at as string, producto_nombre: d.producto_nombre }}
                      onSave={(payload) => editarDeuda.mutate(payload)}
                      pending={editarDeuda.isPending}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={eliminarDeuda.isPending}>
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará "{d.producto_nombre} × {d.cantidad}" por {formatCurrency(Number(d.monto))} y se recalculará el saldo del cliente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => eliminarDeuda.mutate(d.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sí, eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          ))}
          {deudas.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin consumos</p>}
        </div>
      </Card>
    </div>
  );
}

function PagarTodoDialog({ saldo, onConfirm, disabled }: { saldo: number; onConfirm: (m: Metodo) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-14 text-base bg-success hover:bg-success/90 text-success-foreground" disabled={disabled}>Pagar todo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Pagar {formatCurrency(saldo)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["efectivo","transferencia"] as Metodo[]).map((m) => (
            <button key={m} onClick={() => setMetodo(m)} className={cn("h-12 rounded-lg border capitalize font-medium", metodo === m ? "bg-primary text-primary-foreground border-primary" : "")}>
              {m}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => { onConfirm(metodo); setOpen(false); }} className="w-full h-12">Confirmar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbonarDialog({ saldo, onConfirm, disabled }: { saldo: number; onConfirm: (monto: number, m: Metodo) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const valor = Number(monto);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-14 text-base" disabled={disabled}>Abonar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Abonar (saldo {formatCurrency(saldo)})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Monto</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} className="h-12 text-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["efectivo","transferencia"] as Metodo[]).map((m) => (
              <button key={m} onClick={() => setMetodo(m)} className={cn("h-12 rounded-lg border capitalize font-medium", metodo === m ? "bg-primary text-primary-foreground border-primary" : "")}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!valor || valor <= 0 || valor > saldo}
            onClick={() => { onConfirm(valor, metodo); setOpen(false); setMonto(""); }}
            className="w-full h-12"
          >
            Confirmar abono
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditarPayload = { id: string; cantidad: number; precio_unitario: number; created_at: string };

function EditarDeudaDialog({
  deuda,
  onSave,
  pending,
}: {
  deuda: { id: string; cantidad: number; precio_unitario: number; created_at: string; producto_nombre: string };
  onSave: (p: EditarPayload) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cantidad, setCantidad] = useState(String(deuda.cantidad));
  const [fecha, setFecha] = useState<Date>(new Date(deuda.created_at));

  const cantNum = Number(cantidad);
  const monto = (cantNum || 0) * deuda.precio_unitario;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setCantidad(String(deuda.cantidad));
          setFecha(new Date(deuda.created_at));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar {deuda.producto_nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-12 text-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Precio unitario: {formatCurrency(deuda.precio_unitario)} · Nuevo monto: {formatCurrency(monto)}
            </p>
          </div>
          <div>
            <Label>Fecha del registro</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-12")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(fecha, "PPP p")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(d) => {
                    if (!d) return;
                    const nueva = new Date(d);
                    nueva.setHours(fecha.getHours(), fecha.getMinutes(), 0, 0);
                    setFecha(nueva);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !cantNum || cantNum <= 0}
            onClick={() => {
              onSave({
                id: deuda.id,
                cantidad: cantNum,
                precio_unitario: deuda.precio_unitario,
                created_at: fecha.toISOString(),
              });
              setOpen(false);
            }}
            className="w-full h-12"
          >
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
