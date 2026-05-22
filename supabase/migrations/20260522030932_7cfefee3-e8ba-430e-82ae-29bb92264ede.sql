CREATE OR REPLACE FUNCTION public.trg_sync_gasto_historial_cajas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha date;
BEGIN
  IF NEW.tipo IS DISTINCT FROM 'gasto' THEN
    RETURN NEW;
  END IF;

  -- Día local (Ecuador) de la transacción para coincidir con historial_cajas.fecha
  v_fecha := ((COALESCE(NEW.created_at, now())) AT TIME ZONE 'America/Guayaquil')::date;

  UPDATE public.historial_cajas
     SET total_egresos = total_egresos + NEW.monto,
         venta_real    = total_arqueo - caja_inicial + (total_egresos + NEW.monto)
   WHERE fecha = v_fecha;

  RETURN NEW;
END;
$function$;

-- Asegurar que el trigger exista (idempotente)
DROP TRIGGER IF EXISTS sync_gasto_historial_cajas ON public.transacciones;
CREATE TRIGGER sync_gasto_historial_cajas
AFTER INSERT ON public.transacciones
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_gasto_historial_cajas();