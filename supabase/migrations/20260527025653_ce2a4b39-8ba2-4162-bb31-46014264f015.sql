DROP TRIGGER IF EXISTS sync_egresos_caja_trigger ON public.transacciones;
DROP TRIGGER IF EXISTS sync_gasto_historial_cajas ON public.transacciones;
DROP FUNCTION IF EXISTS public.trg_sync_egresos_caja();
DROP FUNCTION IF EXISTS public.recalcular_egresos_caja(DATE);
DROP FUNCTION IF EXISTS public.trg_sync_gasto_historial_cajas();