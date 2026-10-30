ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS note text;
COMMENT ON COLUMN public.promo_codes.prefix IS 'DEPRECATED: codes are typed freely without a prefix';