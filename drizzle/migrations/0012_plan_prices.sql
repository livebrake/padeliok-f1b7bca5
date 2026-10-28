CREATE TABLE public.plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL UNIQUE CHECK (plan_key IN ('bazinis','standartinis','premium')),
  name text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price > 0 AND price < 100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_prices TO anon, authenticated;
GRANT UPDATE (price, updated_at) ON public.plan_prices TO authenticated;
GRANT ALL ON public.plan_prices TO service_role;
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads plan prices" ON public.plan_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin updates plan prices" ON public.plan_prices FOR UPDATE TO authenticated
  USING (public.team_access() = 'super_admin') WITH CHECK (public.team_access() = 'super_admin');
CREATE OR REPLACE FUNCTION public.touch_plan_price() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER plan_prices_touch BEFORE UPDATE ON public.plan_prices FOR EACH ROW EXECUTE FUNCTION public.touch_plan_price();
INSERT INTO public.plan_prices (plan_key, name, price) VALUES
  ('bazinis','Bazinis',49),('standartinis','Standartinis',99),('premium','Premium',199)
ON CONFLICT (plan_key) DO NOTHING;