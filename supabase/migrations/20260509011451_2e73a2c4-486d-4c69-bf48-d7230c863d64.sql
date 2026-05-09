
-- Enums
CREATE TYPE public.tipo_transaccion AS ENUM ('ingreso', 'gasto', 'costo');
CREATE TYPE public.metodo_pago AS ENUM ('efectivo', 'transferencia');
CREATE TYPE public.rol_empleado AS ENUM ('admin', 'empleado');
CREATE TYPE public.estado_deuda AS ENUM ('pendiente', 'pagado');

-- Empleados (no son usuarios de auth; PIN hash bcrypt)
CREATE TABLE public.empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rol public.rol_empleado NOT NULL DEFAULT 'empleado',
  pin_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  telefono text,
  saldo_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_transaccion NOT NULL,
  metodo_pago public.metodo_pago,
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  descripcion text,
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  origen text NOT NULL DEFAULT 'manual',
  abono_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transacciones_created_at ON public.transacciones(created_at DESC);
CREATE INDEX idx_transacciones_tipo ON public.transacciones(tipo);

CREATE TABLE public.deudas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  producto_nombre text NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  estado public.estado_deuda NOT NULL DEFAULT 'pendiente',
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  pagado_at timestamptz
);
CREATE INDEX idx_deudas_cliente ON public.deudas(cliente_id);
CREATE INDEX idx_deudas_estado ON public.deudas(estado);

CREATE TABLE public.abonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  metodo_pago public.metodo_pago NOT NULL,
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  transaccion_id uuid REFERENCES public.transacciones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_abonos_cliente ON public.abonos(cliente_id);

-- Trigger: recalcular saldo del cliente
CREATE OR REPLACE FUNCTION public.recalcular_saldo_cliente(p_cliente uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deudas numeric;
  v_abonos numeric;
BEGIN
  SELECT COALESCE(SUM(monto),0) INTO v_deudas
    FROM public.deudas WHERE cliente_id = p_cliente AND estado = 'pendiente';
  SELECT COALESCE(SUM(monto),0) INTO v_abonos FROM (
    SELECT 0 AS monto WHERE false
  ) x;
  -- Saldo = deudas pendientes (los abonos ya marcan deudas como pagadas)
  UPDATE public.clientes SET saldo_total = v_deudas WHERE id = p_cliente;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_actualizar_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_saldo_cliente(OLD.cliente_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalcular_saldo_cliente(NEW.cliente_id);
    IF TG_OP = 'UPDATE' AND NEW.cliente_id <> OLD.cliente_id THEN
      PERFORM public.recalcular_saldo_cliente(OLD.cliente_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER deudas_saldo AFTER INSERT OR UPDATE OR DELETE ON public.deudas
  FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_saldo();

-- RPC: aplicar abono (FIFO)
CREATE OR REPLACE FUNCTION public.aplicar_abono(
  p_cliente uuid,
  p_monto numeric,
  p_metodo public.metodo_pago,
  p_empleado uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restante numeric := p_monto;
  v_deuda RECORD;
  v_transaccion uuid;
  v_abono uuid;
BEGIN
  IF p_monto <= 0 THEN RAISE EXCEPTION 'Monto debe ser positivo'; END IF;

  -- Crear transacción de ingreso
  INSERT INTO public.transacciones (tipo, metodo_pago, monto, descripcion, empleado_id, origen)
  VALUES ('ingreso', p_metodo, p_monto, 'Cobro de fiado', p_empleado, 'abono')
  RETURNING id INTO v_transaccion;

  -- Crear abono
  INSERT INTO public.abonos (cliente_id, monto, metodo_pago, empleado_id, transaccion_id)
  VALUES (p_cliente, p_monto, p_metodo, p_empleado, v_transaccion)
  RETURNING id INTO v_abono;

  UPDATE public.transacciones SET abono_id = v_abono WHERE id = v_transaccion;

  -- FIFO: marcar deudas pendientes como pagadas hasta cubrir el monto
  FOR v_deuda IN
    SELECT id, monto FROM public.deudas
    WHERE cliente_id = p_cliente AND estado = 'pendiente'
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_restante <= 0;
    IF v_deuda.monto <= v_restante THEN
      UPDATE public.deudas SET estado = 'pagado', pagado_at = now() WHERE id = v_deuda.id;
      v_restante := v_restante - v_deuda.monto;
    ELSE
      -- Pago parcial: dividir la deuda
      UPDATE public.deudas SET monto = monto - v_restante WHERE id = v_deuda.id;
      INSERT INTO public.deudas (cliente_id, producto_id, producto_nombre, precio_unitario, cantidad, monto, estado, empleado_id, pagado_at, created_at)
      SELECT cliente_id, producto_id, producto_nombre, precio_unitario, cantidad, v_restante, 'pagado', p_empleado, now(), created_at - interval '1 millisecond'
      FROM public.deudas WHERE id = v_deuda.id;
      v_restante := 0;
    END IF;
  END LOOP;

  PERFORM public.recalcular_saldo_cliente(p_cliente);
  RETURN v_abono;
END;
$$;

-- RLS: cualquier sesión autenticada (la del dispositivo) puede operar
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device read empleados" ON public.empleados FOR SELECT TO authenticated USING (true);
CREATE POLICY "device write empleados" ON public.empleados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "device update empleados" ON public.empleados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "device delete empleados" ON public.empleados FOR DELETE TO authenticated USING (true);

CREATE POLICY "device all productos" ON public.productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "device all clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "device all transacciones" ON public.transacciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "device all deudas" ON public.deudas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "device all abonos" ON public.abonos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Empleado admin inicial con PIN 1234 (bcrypt hash). Cambiar luego desde la app.
INSERT INTO public.empleados (nombre, rol, pin_hash)
VALUES ('Admin', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
