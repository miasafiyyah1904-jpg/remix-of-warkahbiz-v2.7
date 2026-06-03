
-- =============================================================
-- WarkahBiz schema
-- =============================================================

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ========== profiles ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- Generic per-user tables (user_id = auth.uid())
-- =============================================================

-- products
CREATE TABLE public.products (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT, name TEXT NOT NULL,
  description TEXT, category TEXT,
  servings_per_batch NUMERIC, serving_unit TEXT,
  cooking_frequency_days NUMERIC,
  batches_from_ingredients NUMERIC,
  total_cost NUMERIC, cost_per_unit NUMERIC,
  suggested_price NUMERIC, margin NUMERIC,
  target_profit_scale NUMERIC,
  packaging JSONB, ingredients JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- stock_items
CREATE TABLE public.stock_items (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT, name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  min_qty NUMERIC NOT NULL DEFAULT 0,
  restock_qty NUMERIC NOT NULL DEFAULT 0,
  max_qty NUMERIC, category TEXT,
  last_restocked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- buy_items
CREATE TABLE public.buy_items (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT, name TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  current_qty NUMERIC NOT NULL DEFAULT 0,
  rec_qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT, days_cover NUMERIC,
  reason TEXT, done BOOLEAN NOT NULL DEFAULT false,
  source TEXT, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- transactions
CREATE TABLE public.transactions (
  id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  emoji TEXT, label TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  time TEXT, ts BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_transactions_user_ts ON public.transactions(user_id, ts DESC);

-- opex_entries
CREATE TABLE public.opex_entries (
  id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  "desc" TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  time TEXT, ts BIGINT,
  paid_from_petty BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX idx_opex_user_ts ON public.opex_entries(user_id, ts DESC);

-- petty_entries
CREATE TABLE public.petty_entries (
  id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  "desc" TEXT, emoji TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  time TEXT, balance NUMERIC NOT NULL DEFAULT 0,
  ts BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- cooking_logs
CREATE TABLE public.cooking_logs (
  id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT, product_name TEXT, product_emoji TEXT,
  batches NUMERIC NOT NULL DEFAULT 0,
  batch_unit TEXT, ts BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- saved_cards
CREATE TABLE public.saved_cards (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ewallet_provider TEXT, ewallet_phone TEXT,
  bank_name TEXT, account_number TEXT, account_holder TEXT,
  nickname TEXT, is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- chat_history
CREATE TABLE public.chat_history (
  id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "from" TEXT NOT NULL CHECK ("from" IN ('user','bot')),
  text TEXT NOT NULL DEFAULT '',
  ts BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- business_hours (singleton)
CREATE TABLE public.business_hours (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- outlet_settings (singleton)
CREATE TABLE public.outlet_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- petty_settings (singleton)
CREATE TABLE public.petty_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_limit NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- device_id-keyed tables (device_id stores auth.uid())
-- =============================================================

-- user_impian
CREATE TABLE public.user_impian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('machine','sales','branch')),
  goal_name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_saved NUMERIC NOT NULL DEFAULT 0,
  selected_plan JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_impian_device ON public.user_impian(device_id);

-- sisa_harian
CREATE TABLE public.sisa_harian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  log_date DATE NOT NULL,
  prepared_qty NUMERIC NOT NULL DEFAULT 0,
  sold_qty NUMERIC NOT NULL DEFAULT 0,
  leftover_qty NUMERIC NOT NULL DEFAULT 0,
  leftover_value NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  ai_suggested_qty NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, product_id, log_date)
);
CREATE INDEX idx_sisa_device_date ON public.sisa_harian(device_id, log_date DESC);

-- nightly_reports
CREATE TABLE public.nightly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  business_name TEXT,
  report_date DATE NOT NULL,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  sales_change_pct NUMERIC, profit_change_pct NUMERIC, expense_change_pct NUMERIC,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  peak_hour INTEGER, slow_hour INTEGER,
  weekly_revenue NUMERIC NOT NULL DEFAULT 0,
  weekly_target NUMERIC NOT NULL DEFAULT 0,
  weekly_target_progress NUMERIC,
  weekly_expenses NUMERIC NOT NULL DEFAULT 0,
  weekly_budget NUMERIC NOT NULL DEFAULT 0,
  critical_stock_items JSONB, low_stock_items JSONB,
  ai_summary TEXT, ai_achievement TEXT, ai_warning TEXT,
  ai_recommendations JSONB, ai_motivation TEXT,
  read_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, report_date)
);
CREATE INDEX idx_nightly_device_date ON public.nightly_reports(device_id, report_date DESC);

-- action_items_log
CREATE TABLE public.action_items_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  report_id UUID REFERENCES public.nightly_reports(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  action_text TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_device ON public.action_items_log(device_id);
CREATE INDEX idx_action_report ON public.action_items_log(report_id);

-- forecasts
CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  forecast_date DATE NOT NULL,
  day_index INTEGER NOT NULL DEFAULT 0,
  baseline NUMERIC NOT NULL DEFAULT 0,
  predicted_revenue NUMERIC NOT NULL DEFAULT 0,
  predicted_low NUMERIC NOT NULL DEFAULT 0,
  predicted_high NUMERIC NOT NULL DEFAULT 0,
  weather_adjust NUMERIC NOT NULL DEFAULT 0,
  weather_label TEXT,
  actual_revenue NUMERIC,
  accuracy_pct NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, forecast_date)
);
CREATE INDEX idx_forecasts_device_date ON public.forecasts(device_id, forecast_date DESC);

-- =============================================================
-- Enable RLS + policies
-- =============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'products','stock_items','buy_items','transactions','opex_entries',
    'petty_entries','cooking_logs','saved_cards','chat_history',
    'business_hours','outlet_settings','petty_settings'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own select" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own insert" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own update" ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own delete" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;

  FOR t IN SELECT unnest(ARRAY[
    'user_impian','sisa_harian','nightly_reports','action_items_log','forecasts'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own select" ON public.%I FOR SELECT USING (auth.uid() = device_id)', t);
    EXECUTE format('CREATE POLICY "own insert" ON public.%I FOR INSERT WITH CHECK (auth.uid() = device_id)', t);
    EXECUTE format('CREATE POLICY "own update" ON public.%I FOR UPDATE USING (auth.uid() = device_id) WITH CHECK (auth.uid() = device_id)', t);
    EXECUTE format('CREATE POLICY "own delete" ON public.%I FOR DELETE USING (auth.uid() = device_id)', t);
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER stock_upd BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bh_upd BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER os_upd BEFORE UPDATE ON public.outlet_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ps_upd BEFORE UPDATE ON public.petty_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER impian_upd BEFORE UPDATE ON public.user_impian FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sisa_upd BEFORE UPDATE ON public.sisa_harian FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER nr_upd BEFORE UPDATE ON public.nightly_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ail_upd BEFORE UPDATE ON public.action_items_log FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- product images storage bucket (referenced by ProductsView)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images','product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product images public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "product images user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "product images user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "product images user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
