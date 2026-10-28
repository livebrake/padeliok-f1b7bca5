CREATE TABLE public.invoice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  series_prefix text NOT NULL DEFAULT 'PAD',
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  company_name text NOT NULL DEFAULT '',
  company_code text NOT NULL DEFAULT '',
  vat_code text,
  company_address text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_iban text NOT NULL DEFAULT '',
  is_vat_payer boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.invoice_settings TO authenticated;
GRANT ALL ON public.invoice_settings TO service_role;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads invoice settings" ON public.invoice_settings FOR SELECT TO authenticated USING (public.team_access() = 'super_admin');
CREATE POLICY "Super admin updates invoice settings" ON public.invoice_settings FOR UPDATE TO authenticated
  USING (public.team_access() = 'super_admin') WITH CHECK (public.team_access() = 'super_admin');
CREATE TRIGGER invoice_settings_touch BEFORE UPDATE ON public.invoice_settings FOR EACH ROW EXECUTE FUNCTION public.touch_plan_price();
INSERT INTO public.invoice_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  invoice_number text NOT NULL UNIQUE,
  issue_date timestamptz NOT NULL DEFAULT now(),
  line_item text NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  vat_amount numeric(10,2) NOT NULL,
  amount_without_vat numeric(10,2) NOT NULL,
  buyer_details jsonb NOT NULL,
  seller_details jsonb NOT NULL
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads invoices" ON public.invoices FOR SELECT TO authenticated USING (public.team_access() = 'super_admin');

-- Issues exactly one invoice per paid order; numbering is serialized by the settings row lock.
CREATE OR REPLACE FUNCTION public.issue_invoice(order_uuid uuid) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.invoice_settings; o public.orders; inv public.invoices; n integer; total numeric; vat numeric; plan text;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE order_id = order_uuid;
  IF FOUND THEN RETURN inv; END IF;
  SELECT * INTO o FROM public.orders WHERE id = order_uuid;
  IF NOT FOUND OR o.payment_status <> 'PAID' THEN RAISE EXCEPTION 'Order not paid'; END IF;
  SELECT * INTO s FROM public.invoice_settings WHERE id FOR UPDATE;
  SELECT * INTO inv FROM public.invoices WHERE order_id = order_uuid;
  IF FOUND THEN RETURN inv; END IF;
  n := s.last_number + 1;
  UPDATE public.invoice_settings SET last_number = n WHERE id;
  total := round(o.price, 2);
  vat := CASE WHEN s.is_vat_payer THEN round(total * 21 / 121, 2) ELSE 0 END;
  plan := CASE lower(o.plan_name) WHEN 'bazinis' THEN 'Bazinis' WHEN 'standartinis' THEN 'Standartinis' WHEN 'premium' THEN 'Premium' ELSE o.plan_name END;
  INSERT INTO public.invoices (order_id, invoice_number, issue_date, line_item, total_amount, vat_rate, vat_amount, amount_without_vat, buyer_details, seller_details)
  VALUES (o.id, s.series_prefix || lpad(n::text, 4, '0'), coalesce(o.paid_at, now()), 'Sklypo analizė (' || plan || ' planas)',
    total, CASE WHEN s.is_vat_payer THEN 21 ELSE 0 END, vat, total - vat,
    jsonb_build_object('is_company', o.client_type IN ('company','juridinis'), 'name', coalesce(nullif(o.company_name,''), o.full_name, o.client_name, ''),
      'company_code', o.company_code, 'vat_code', o.vat_code, 'address', o.company_address, 'email', o.email, 'phone', o.phone, 'order_number', o.order_number),
    jsonb_build_object('company_name', s.company_name, 'company_code', s.company_code, 'vat_code', s.vat_code, 'company_address', s.company_address,
      'bank_name', s.bank_name, 'bank_iban', s.bank_iban, 'is_vat_payer', s.is_vat_payer))
  RETURNING * INTO inv;
  RETURN inv;
END $$;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid) TO service_role;