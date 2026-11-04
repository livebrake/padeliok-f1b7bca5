-- Isolated PostgreSQL only: schema changes and sample orders are rolled back.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.orders ALTER COLUMN price TYPE text USING price::text;
INSERT INTO public.orders(id,order_number,plan_name,price,email,phone,payment_status)
VALUES('99999999-0000-4000-8000-000000000011','PRICE-TEXT-CHECK','Bazinis','49','price-check@example.invalid','000','PENDING');
DO $$
DECLARE result jsonb; invoice public.invoices; repeated public.invoices;
BEGIN
 result:=public.record_montonio_event('PRICE-TEXT-CHECK','99999999-0000-4000-8000-000000000012','PAID',4900,'2026-11-04T12:00:00Z','price-text-check');
 IF result->>'payment_status'<>'PAID' OR (SELECT captured_amount_cents FROM public.orders WHERE order_number='PRICE-TEXT-CHECK')<>4900 THEN
  RAISE EXCEPTION '49 euro text price must capture exactly 4900 cents';
 END IF;
 invoice:=public.issue_invoice('99999999-0000-4000-8000-000000000011');
 repeated:=public.issue_invoice('99999999-0000-4000-8000-000000000011');
 IF invoice.total_amount<>49 OR repeated.id<>invoice.id THEN
  RAISE EXCEPTION 'Text price must issue one stable 49 euro invoice';
 END IF;
 IF has_function_privilege('anon','public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Payment recording must remain service-only';
 END IF;
 RAISE NOTICE 'PASS text price 49, captured 4900 cents, stable invoice and service-only recording';
END $$;
ROLLBACK;