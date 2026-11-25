ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz, ADD COLUMN IF NOT EXISTS documents_purged_at timestamptz, ADD COLUMN IF NOT EXISTS report_sent_at timestamptz;
UPDATE public.orders SET completed_at = created_at WHERE status = 'Atlikta' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_order_completed_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Atlikta' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_completed_at ON public.orders;
CREATE TRIGGER orders_completed_at BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_order_completed_at();

CREATE TABLE IF NOT EXISTS public.email_templates (
  id text PRIMARY KEY,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
CREATE POLICY "team reads templates" ON public.email_templates FOR SELECT TO authenticated USING (public.team_access() IS NOT NULL);
CREATE POLICY "manager inserts templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (public.team_access() = 'super_admin');
CREATE POLICY "manager updates templates" ON public.email_templates FOR UPDATE TO authenticated USING (public.team_access() = 'super_admin') WITH CHECK (public.team_access() = 'super_admin');