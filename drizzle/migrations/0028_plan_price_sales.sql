ALTER TABLE public.plan_prices
  ADD COLUMN sale_active boolean NOT NULL DEFAULT false,
  ADD COLUMN sale_type text NOT NULL DEFAULT 'percent' CHECK (sale_type IN ('percent','fixed')),
  ADD COLUMN sale_value numeric(10,2) CHECK (sale_value IS NULL OR (sale_value > 0 AND sale_value < 100000)),
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz,
  ADD COLUMN sale_badge text CHECK (sale_badge IS NULL OR char_length(sale_badge) <= 40),
  ADD COLUMN sale_allow_promo boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT plan_prices_sale_dates CHECK (sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_ends_at > sale_starts_at);
GRANT UPDATE (sale_active, sale_type, sale_value, sale_starts_at, sale_ends_at, sale_badge, sale_allow_promo) ON public.plan_prices TO authenticated;