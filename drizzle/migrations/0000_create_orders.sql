CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  comment TEXT,
  file_paths TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'naujas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;