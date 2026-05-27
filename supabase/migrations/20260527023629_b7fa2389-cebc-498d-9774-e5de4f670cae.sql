
-- Función para recalcular egresos y venta real de un día específico
CREATE OR REPLACE FUNCTION public.recalcular_egresos_caja(p_fecha DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_egresos numeric;
  v_caja_inicial numeric;
  v_total_arqueo numeric;
BEGIN
  SELECT COALESCE(SUM(monto), 0) INTO v_total_egresos
  FROM public.transacciones
  WHERE tipo = 'gasto'
    AND DATE(created_at AT TIME ZONE 'UTC') = p_fecha;

  SELECT caja_inicial, total_arqueo INTO v_caja_inicial, v_total_arqueo
  FROM public.historial_cajas
  WHERE fecha = p_fecha;

  IF FOUND THEN
    UPDATE public.historial_cajas
    SET
      total_egresos = v_total_egresos,
      venta_real = v_total_arqueo - (v_caja_inicial - v_total_egresos)
    WHERE fecha = p_fecha;
  END IF;
END;
$$;

-- Función del Trigger
CREATE OR REPLACE FUNCTION public.trg_sync_egresos_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo = 'gasto' THEN
      v_fecha := DATE(OLD.created_at AT TIME ZONE 'UTC');
      PERFORM public.recalcular_egresos_caja(v_fecha);
    END IF;
    RETURN OLD;
  ELSE
    IF TG_OP = 'INSERT' AND NEW.tipo = 'gasto' THEN
      PERFORM public.recalcular_egresos_caja(DATE(NEW.created_at AT TIME ZONE 'UTC'));
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.tipo = 'gasto' AND NEW.tipo <> 'gasto' THEN
        PERFORM public.recalcular_egresos_caja(DATE(OLD.created_at AT TIME ZONE 'UTC'));
      ELSIF OLD.tipo <> 'gasto' AND NEW.tipo = 'gasto' THEN
        PERFORM public.recalcular_egresos_caja(DATE(NEW.created_at AT TIME ZONE 'UTC'));
      ELSIF OLD.tipo = 'gasto' AND NEW.tipo = 'gasto' THEN
        IF DATE(NEW.created_at AT TIME ZONE 'UTC') <> DATE(OLD.created_at AT TIME ZONE 'UTC') THEN
          PERFORM public.recalcular_egresos_caja(DATE(OLD.created_at AT TIME ZONE 'UTC'));
          PERFORM public.recalcular_egresos_caja(DATE(NEW.created_at AT TIME ZONE 'UTC'));
        ELSE
          PERFORM public.recalcular_egresos_caja(DATE(NEW.created_at AT TIME ZONE 'UTC'));
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

-- Crear el Trigger en la tabla transacciones
DROP TRIGGER IF EXISTS sync_egresos_caja_trigger ON public.transacciones;
CREATE TRIGGER sync_egresos_caja_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transacciones
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_egresos_caja();
