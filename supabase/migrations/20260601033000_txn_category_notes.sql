ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.transactions
SET category = CASE WHEN type = 'in' THEN 'Jualan' ELSE 'Kos Operasi' END
WHERE category IS NULL;
