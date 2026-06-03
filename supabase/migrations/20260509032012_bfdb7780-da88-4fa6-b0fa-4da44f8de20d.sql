-- Shared trigger function for updated_at maintenance
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Goals/Impian table for the goal planner (device-scoped, no auth)
CREATE TABLE public.user_impian (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('machine','sales','branch')),
  goal_name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_saved NUMERIC NOT NULL DEFAULT 0,
  selected_plan JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_impian_device ON public.user_impian (device_id, created_at DESC);
ALTER TABLE public.user_impian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read impian" ON public.user_impian FOR SELECT USING (true);
CREATE POLICY "Anyone can create impian" ON public.user_impian FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update impian" ON public.user_impian FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete impian" ON public.user_impian FOR DELETE USING (true);
CREATE TRIGGER update_user_impian_updated_at BEFORE UPDATE ON public.user_impian FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Waste log
CREATE TABLE public.waste_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  log_date date NOT NULL,
  day_of_week integer NOT NULL,
  total_leftover_units numeric NOT NULL DEFAULT 0,
  total_waste_rm numeric NOT NULL DEFAULT 0,
  items jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, log_date)
);
ALTER TABLE public.waste_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read waste_log" ON public.waste_log FOR SELECT USING (true);
CREATE POLICY "Anyone can create waste_log" ON public.waste_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update waste_log" ON public.waste_log FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete waste_log" ON public.waste_log FOR DELETE USING (true);
CREATE TRIGGER waste_log_updated_at BEFORE UPDATE ON public.waste_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_waste_log_device_date ON public.waste_log(device_id, log_date DESC);

-- Nightly reports
CREATE TABLE public.nightly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  business_name text,
  report_date date NOT NULL,
  total_sales numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  sales_change_pct numeric,
  profit_change_pct numeric,
  expense_change_pct numeric,
  transaction_count integer NOT NULL DEFAULT 0,
  peak_hour integer,
  slow_hour integer,
  weekly_revenue numeric NOT NULL DEFAULT 0,
  weekly_target numeric NOT NULL DEFAULT 0,
  weekly_target_progress numeric,
  weekly_expenses numeric NOT NULL DEFAULT 0,
  weekly_budget numeric NOT NULL DEFAULT 0,
  critical_stock_items jsonb,
  low_stock_items jsonb,
  ai_summary text,
  ai_achievement text,
  ai_warning text,
  ai_recommendations jsonb,
  ai_motivation text,
  read_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, report_date)
);
ALTER TABLE public.nightly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nightly_reports" ON public.nightly_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can create nightly_reports" ON public.nightly_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update nightly_reports" ON public.nightly_reports FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete nightly_reports" ON public.nightly_reports FOR DELETE USING (true);
CREATE TRIGGER nightly_reports_set_updated BEFORE UPDATE ON public.nightly_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX nightly_reports_device_date_idx ON public.nightly_reports (device_id, report_date DESC);

-- Action items log
CREATE TABLE public.action_items_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  report_id uuid REFERENCES public.nightly_reports(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  action_text text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.action_items_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read action_items_log" ON public.action_items_log FOR SELECT USING (true);
CREATE POLICY "Anyone can create action_items_log" ON public.action_items_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update action_items_log" ON public.action_items_log FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete action_items_log" ON public.action_items_log FOR DELETE USING (true);
CREATE TRIGGER action_items_log_set_updated BEFORE UPDATE ON public.action_items_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX action_items_log_report_idx ON public.action_items_log (report_id);

-- Forecasts
CREATE TABLE public.forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  day_index INTEGER NOT NULL,
  baseline NUMERIC NOT NULL DEFAULT 0,
  predicted_revenue NUMERIC NOT NULL DEFAULT 0,
  predicted_low NUMERIC NOT NULL DEFAULT 0,
  predicted_high NUMERIC NOT NULL DEFAULT 0,
  weather_adjust NUMERIC NOT NULL DEFAULT 0,
  weather_label TEXT,
  actual_revenue NUMERIC,
  accuracy_pct NUMERIC,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, forecast_date)
);
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forecasts" ON public.forecasts FOR SELECT USING (true);
CREATE POLICY "Anyone can create forecasts" ON public.forecasts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update forecasts" ON public.forecasts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete forecasts" ON public.forecasts FOR DELETE USING (true);
CREATE TRIGGER update_forecasts_updated_at BEFORE UPDATE ON public.forecasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_forecasts_device_date ON public.forecasts(device_id, forecast_date DESC);