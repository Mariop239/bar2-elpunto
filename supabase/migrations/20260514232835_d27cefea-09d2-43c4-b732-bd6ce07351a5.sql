ALTER TABLE public.historial_cajas REPLICA IDENTITY FULL;
ALTER TABLE public.transacciones REPLICA IDENTITY FULL;
ALTER TABLE public.abonos REPLICA IDENTITY FULL;
ALTER TABLE public.deudas REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_cajas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transacciones; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.abonos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deudas; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;