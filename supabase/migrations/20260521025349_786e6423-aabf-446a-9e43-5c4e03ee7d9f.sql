-- Function: si ya existe cierre del día, suma el nuevo gasto a total_egresos
-- y recalcula venta_real manteniendo caja_inicial y total_arqueo constantes.
-- Fórmula: venta_real = total_arqueo - caja_inicial + total_egresos
CREATE OR REPLACE FUNCTION public.trg_sync_gasto_historial_cajas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha date;
BEGIN
  -- Solo nos interesan gastos
  IF NEW.tipo IS DISTINCT FROM 'gasto' THEN
    RETURN NEW;
  END IF;

  -- Día local de la transacción (usa created_at; default now())
  v_fecha := (COALESCE(NEW.created_at, now()))::date;

  -- Si existe cierre para ese día, recalcular en el mismo registro
  UPDATE public.historial_cajas
     SET total_egresos = total_egresos + NEW.monto,
         venta_real    = total_arqueo - caja_inicial + (total_egresos + NEW.monto)
   WHERE fecha = v_fecha;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_gasto_historial_cajas ON public.transacciones;

CREATE TRIGGER sync_gasto_historial_cajas
AFTER INSERT ON public.transacciones
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_gasto_historial_cajas();