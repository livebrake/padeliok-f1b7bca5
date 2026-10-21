ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS project_goal text;
COMMENT ON COLUMN public.orders.project_goal IS 'Planuoju: pasirinkta projektavimo paskirtis (vienas iš fiksuotų pasirinkimų)';