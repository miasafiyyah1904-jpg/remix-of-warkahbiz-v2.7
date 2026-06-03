ALTER TABLE forecasts
  ADD COLUMN IF NOT EXISTS cultural_adjust float DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS cultural_label  text,
  ADD COLUMN IF NOT EXISTS payday_adjust   float DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS payday_label    text;
