import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Delete, Plus, Minus, Trash2, CalendarIcon, Search, X, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useEmpleado } from "@/lib/empleado-store";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_app/registro")({
  component: RegistroPage,
});

type TipoMov = "ingreso" | "gasto" | "costo" | "fondo_caja";
type Metodo = "efectivo" | "transferencia";

function RegistroPage() {
  return (
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
  );
}

/* ---------- CAJA ---------- */

function CajaTab() {
  const empleado = useEmpleado((s) => s.empleado)!;
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoMov>("ingreso");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const press = (d: string) => setMonto((m) => {
    if (d === "." && m.includes(".")) return m;
    return m === "0" && d !== "." ? d : m + d;
  });
  const back = () => setMonto((m) => m.slice(0, -1));
  const clear = () => setMonto("");

  const saveMut = useMutation({
    mutationFn: async () => {
      const m = Number(monto);
      if (!m || m <= 0) throw new Error("Ingresa un monto válido");
      const { error } = await supabase.from("transacciones").insert({
        tipo, metodo_pago: metodo, monto: m, descripcion: descripcion || null, empleado_id: empleado.id, origen: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimiento guardado");
      setMonto(""); setDescripcion("");
      qc.invalidateQueries({ queryKey: ["dashboard-hoy"] });
      qc.invalidateQueries({ queryKey: ["historial"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tipos: { v: TipoMov; label: string; cls: string; icon?: any }[] = [
    { v: "ingreso", label: "Ingreso", cls: "data-[on=true]:bg-success data-[on=true]:text-success-foreground" },
    { v: "costo", label: "Costo", cls: "data-[on=true]:bg-warning data-[on=true]:text-warning-foreground" },
    { v: "gasto", label: "Gasto", cls: "data-[on=true]:bg-destructive data-[on=true]:text-destructive-foreground" },
    { v: "fondo_caja", label: "Fondo Caja", cls: "data-[on=true]:bg-indigo-600 data-[on=true]:text-white", icon: Briefcase },
  ];

  // Fondo de caja siempre es efectivo
  const metodoEfectivo: Metodo = tipo === "fondo_caja" ? "efectivo" : metodo;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tipos.map((t) => (
            <button
              key={t.v}
              data-on={tipo === t.v}
              onClick={() => setTipo(t.v)}
              className={cn("h-14 rounded-lg border font-semibold flex items-center justify-center gap-1.5 text-sm", t.cls)}
            >{t.icon && <t.icon className="h-4 w-4" />}{t.label}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["efectivo","transferencia"] as Metodo[]).map((m) => (
            <button
              key={m}
              onClick={() => tipo !== "fondo_caja" && setMetodo(m)}
              disabled={tipo === "fondo_caja"}
              className={cn(
                "h-12 rounded-lg border capitalize font-medium",
                metodoEfectivo === m ? "bg-primary text-primary-foreground border-primary" : "bg-card",
                tipo === "fondo_caja" && m !== "efectivo" && "opacity-40"
              )}
            >{m}</button>
          ))}
        </div>

        <div>
          <Label>Descripción (opcional)</Label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="h-12" placeholder="Ej: pago luz" />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="rounded-lg bg-muted p-4 text-right">
          <div className="text-xs text-muted-foreground uppercase">Monto</div>
          <div className="text-3xl font-bold">{monto ? formatCurrency(Number(monto)) : formatCurrency(0)}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <Button key={d} variant="outline" className="h-14 text-xl" onClick={() => press(d)}>{d}</Button>
          ))}
          <Button variant="outline" className="h-14 text-xl" onClick={() => press(".")}>.</Button>
          <Button variant="outline" className="h-14 text-xl" onClick={() => press("0")}>0</Button>
          <Button variant="outline" className="h-14" onClick={back}><Delete /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={clear} className="flex-1">Limpiar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 h-12 text-base">
            {saveMut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </Card>
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
  const [nuevoCliente, setNuevoCliente] = useState("");
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

  const crearCliente = useMutation({
    mutationFn: async (nombre: string) => {
      const { data, error } = await supabase.from("clientes").insert({ nombre }).select("id,nombre").single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setClienteId(c.id);
      setNuevoCliente("");
      toast.success(`Cliente ${c.nombre} creado`);
    },
    onError: (e: Error) => toast.error(e.message),
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
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-base"
            >
              <option value="">Selecciona cliente…</option>
              {(clientes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)} placeholder="Nuevo cliente" className="h-12" />
              <Button onClick={() => nuevoCliente.trim() && crearCliente.mutate(nuevoCliente.trim())} disabled={crearCliente.isPending} className="h-12">+</Button>
            </div>
          </div>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    "p-3 rounded-xl border active:scale-[.98] transition text-left flex flex-col h-full",
                    colorClass
                  )}
                >
                  <div className="font-semibold flex-1 leading-tight">{p.nombre}</div>
                  <div className="text-sm opacity-80 mt-1">{formatCurrency(p.precio)}</div>
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
