-- Create categories table
CREATE TABLE public.categorias (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre text NOT NULL,
    color text NOT NULL DEFAULT 'slate',
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "device all categorias" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert initial categories
INSERT INTO public.categorias (nombre, color) VALUES 
('Bebidas', 'blue'), 
('Snacks', 'orange'), 
('Almuerzos', 'green'), 
('Comidas Rápidas', 'red'), 
('Otros', 'slate');

-- Add category to products
ALTER TABLE public.productos ADD COLUMN categoria_id uuid REFERENCES public.categorias(id);

-- Assign default category to existing products (Otros)
UPDATE public.productos SET categoria_id = (SELECT id FROM public.categorias WHERE nombre = 'Otros' LIMIT 1);