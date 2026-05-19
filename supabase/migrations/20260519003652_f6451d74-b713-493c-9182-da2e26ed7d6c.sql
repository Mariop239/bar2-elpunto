ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS registrado_por text;
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS registrado_por text;