CREATE TABLE public.sisa_harian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  log_date date NOT NULL,
  prepared_qty numeric NOT NULL DEFAULT 0,
  sold_qty numeric NOT NULL DEFAULT 0,
  leftover_qty numeric NOT NULL DEFAULT 0,
  leftover_value numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  ai_suggested_qty numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, product_id, log_date)
);

ALTER TABLE public.sisa_harian ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sisa_harian" ON public.sisa_harian FOR SELECT USING (true);
CREATE POLICY "Anyone can create sisa_harian" ON public.sisa_harian FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sisa_harian" ON public.sisa_harian FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sisa_harian" ON public.sisa_harian FOR DELETE USING (true);

CREATE INDEX idx_sisa_harian_device_date ON public.sisa_harian (device_id, log_date DESC);
CREATE INDEX idx_sisa_harian_device_product ON public.sisa_harian (device_id, product_id, log_date DESC);

CREATE TRIGGER trg_sisa_harian_updated_at
  BEFORE UPDATE ON public.sisa_harian
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();