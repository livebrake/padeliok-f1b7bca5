DO $migration$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb)'::regprocedure);
  definition := replace(definition, 'o.price*100', 'o.price::numeric*100');
  definition := replace(definition, 'o.price * 100', 'o.price::numeric * 100');
  IF definition NOT LIKE '%o.price::numeric%' THEN RAISE EXCEPTION 'Unexpected payment function price expression; review required'; END IF;
  EXECUTE definition;
  definition := pg_get_functiondef('public.issue_invoice(uuid)'::regprocedure);
  definition := replace(definition, 'round(o.price, 2)', 'round(o.price::numeric, 2)');
  IF definition NOT LIKE '%round(o.price::numeric, 2)%' THEN RAISE EXCEPTION 'Unexpected invoice price expression; review required'; END IF;
  EXECUTE definition;
END $migration$;
REVOKE ALL ON FUNCTION public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid) TO service_role;