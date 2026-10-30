CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  prefix text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  valid_from timestamptz,
  valid_to timestamptz,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  plan_key text CHECK (plan_key IS NULL OR plan_key IN ('bazinis','standartinis','premium')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manages promo codes" ON public.promo_codes FOR ALL TO authenticated
  USING (public.team_access() = 'super_admin') WITH CHECK (public.team_access() = 'super_admin');

ALTER TABLE public.orders
  ADD COLUMN promo_code_id uuid,
  ADD COLUMN promo_code text,
  ADD COLUMN discount_label text,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN original_price numeric;

CREATE OR REPLACE FUNCTION public.team_orders()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE access text:=public.team_access(); result jsonb; BEGIN IF access IS NULL THEN RAISE EXCEPTION 'Prieiga negalima'; END IF; SELECT coalesce(jsonb_agg(CASE WHEN access='super_admin' THEN to_jsonb(o) ELSE to_jsonb(o)-'price'-'discount_amount'-'original_price'-'promo_code'-'promo_code_id'-'discount_label' END ORDER BY o.created_at DESC),'[]'::jsonb) INTO result FROM public.orders o; RETURN result; END $function$;