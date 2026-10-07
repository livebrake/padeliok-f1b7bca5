ALTER TABLE public.orders
  ADD COLUMN client_type TEXT NOT NULL DEFAULT 'fizinis',
  ADD COLUMN company_name TEXT,
  ADD COLUMN company_code TEXT,
  ADD COLUMN company_address TEXT,
  ADD COLUMN vat_code TEXT,
  ADD COLUMN contact_person TEXT;