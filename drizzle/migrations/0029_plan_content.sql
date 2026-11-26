ALTER TABLE public.plan_prices
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS popular boolean NOT NULL DEFAULT false;
UPDATE public.plan_prices SET description='Greitas sklypo patikrinimas', features=ARRAY['Pagrindiniai sklypo rodikliai','Užstatymo zonų patikrinimas','Ribojimų ir apsaugos zonų patikra','Specialisto išvada (PDF)'] WHERE plan_key='bazinis' AND description='';
UPDATE public.plan_prices SET description='Optimalus pasirinkimas perkant / parduodant', popular=true, features=ARRAY['Viskas iš Bazinio plano','Komunikacijų įvertinimas (elektra, vanduo, dujos)','Privažiavimo patikra','Servitutų patikra'] WHERE plan_key='standartinis' AND description='';
UPDATE public.plan_prices SET description='Išsami analizė prieš projektavimą', features=ARRAY['Viskas iš Standartinio plano','Detaliojo plano / specialiųjų sąlygų analizė','Profesionalo komentarai','Preliminarus užstatymo plotas'] WHERE plan_key='premium' AND description='';
GRANT UPDATE (name, description, features, popular) ON public.plan_prices TO authenticated;