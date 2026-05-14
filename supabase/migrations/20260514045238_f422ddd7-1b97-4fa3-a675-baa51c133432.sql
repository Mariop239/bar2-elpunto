CREATE TABLE public.historial_cajas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  caja_inicial NUMERIC NOT NULL DEFAULT 0,
  total_egresos NUMERIC NOT NULL DEFAULT 0,
  bancos NUMERIC NOT NULL DEFAULT 0,
  billetes NUMERIC NOT NULL DEFAULT 0,
  monedas JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_arqueo NUMERIC NOT NULL DEFAULT 0,
  venta_real NUMERIC NOT NULL DEFAULT 0,
  empleado_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.historial_cajas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device all historial_cajas"
ON public.historial_cajas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);