
-- TRANSACTIONS
CREATE TABLE public.transactions (
  id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  emoji text,
  label text,
  amount numeric,
  time text,
  ts bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- STOCK ITEMS
CREATE TABLE public.stock_items (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text,
  name text,
  qty numeric,
  unit text,
  min_qty numeric,
  restock_qty numeric,
  max_qty numeric,
  category text,
  last_restocked_at timestamptz,
  last_used_at timestamptz,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.stock_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.stock_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.stock_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.stock_items FOR DELETE USING (auth.uid() = user_id);

-- BUY ITEMS
CREATE TABLE public.buy_items (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text,
  name text,
  cost numeric,
  current_qty numeric,
  rec_qty numeric,
  unit text,
  days_cover numeric,
  reason text,
  done boolean DEFAULT false,
  source text,
  note text,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.buy_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.buy_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.buy_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.buy_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.buy_items FOR DELETE USING (auth.uid() = user_id);

-- PETTY ENTRIES
CREATE TABLE public.petty_entries (
  id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text,
  "desc" text,
  emoji text,
  amount numeric,
  time text,
  balance numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  ts bigint,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.petty_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.petty_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.petty_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.petty_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.petty_entries FOR DELETE USING (auth.uid() = user_id);

-- PETTY SETTINGS
CREATE TABLE public.petty_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_limit numeric DEFAULT 0
);
ALTER TABLE public.petty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.petty_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.petty_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.petty_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.petty_settings FOR DELETE USING (auth.uid() = user_id);

-- OPEX ENTRIES
CREATE TABLE public.opex_entries (
  id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  "desc" text,
  amount numeric,
  time text,
  ts bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_from_petty boolean DEFAULT false,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.opex_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.opex_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.opex_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.opex_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.opex_entries FOR DELETE USING (auth.uid() = user_id);

-- PRODUCTS
CREATE TABLE public.products (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text,
  name text,
  description text,
  category text,
  servings_per_batch numeric,
  serving_unit text,
  cooking_frequency_days numeric,
  batches_from_ingredients numeric,
  total_cost numeric,
  cost_per_unit numeric,
  suggested_price numeric,
  margin numeric,
  target_profit_scale numeric,
  packaging jsonb,
  ingredients jsonb,
  note text,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- COOKING LOGS
CREATE TABLE public.cooking_logs (
  id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text,
  product_name text,
  product_emoji text,
  batches numeric,
  batch_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ts bigint,
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.cooking_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.cooking_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.cooking_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.cooking_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.cooking_logs FOR DELETE USING (auth.uid() = user_id);

-- SAVED CARDS
CREATE TABLE public.saved_cards (
  id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text,
  ewallet_provider text,
  ewallet_phone text,
  bank_name text,
  account_number text,
  account_holder text,
  nickname text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.saved_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.saved_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.saved_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.saved_cards FOR DELETE USING (auth.uid() = user_id);

-- BUSINESS HOURS
CREATE TABLE public.business_hours (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb
);
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.business_hours FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.business_hours FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.business_hours FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.business_hours FOR DELETE USING (auth.uid() = user_id);

-- OUTLET SETTINGS
CREATE TABLE public.outlet_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb
);
ALTER TABLE public.outlet_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.outlet_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.outlet_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.outlet_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.outlet_settings FOR DELETE USING (auth.uid() = user_id);

-- CHAT HISTORY
CREATE TABLE public.chat_history (
  id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "from" text,
  text text,
  ts bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON public.chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON public.chat_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON public.chat_history FOR DELETE USING (auth.uid() = user_id);
