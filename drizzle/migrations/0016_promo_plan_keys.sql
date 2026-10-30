ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS plan_keys text[];
UPDATE public.promo_codes SET plan_keys = ARRAY[plan_key] WHERE plan_key IS NOT NULL AND plan_keys IS NULL;
COMMENT ON COLUMN public.promo_codes.plan_key IS 'DEPRECATED: replaced by plan_keys (NULL/empty = all plans)';