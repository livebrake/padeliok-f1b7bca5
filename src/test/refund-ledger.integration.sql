-- Run with a privileged PostgreSQL test connection; all sample data is rolled back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.orders(id,order_number,plan_name,price,email,phone,payment_status,promo_code,promo_note,discount_amount)
VALUES('99999999-0000-4000-8000-000000000001','REFUND-ROLLBACK-CHECK','Standartinis',99,'refund-check@example.invalid','000','PENDING','PARTNER','Istorinė pastaba',10);
DO $$
DECLARE result jsonb; n bigint; current_state text; before_note text; before_price numeric;
BEGIN
result:=public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','PAID',9900,'2026-11-04T12:00:00Z','check-paid');
result:=public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','PARTIALLY_REFUNDED',9900,'2026-11-04T13:00:00Z','check-partial','[{"uuid":"99999999-0000-4000-8000-000000000003","amount_cents":2500,"status":"SUCCESSFUL","created_at":"2026-11-04T12:30:00Z","event_at":"2026-11-04T13:00:00Z"}]');
PERFORM public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','PARTIALLY_REFUNDED',9900,'2026-11-04T13:00:00Z','check-partial','[{"uuid":"99999999-0000-4000-8000-000000000003","amount_cents":2500,"status":"SUCCESSFUL","created_at":"2026-11-04T12:30:00Z","event_at":"2026-11-04T13:00:00Z"}]');
SELECT refunded_amount_cents,payment_status,promo_note,price INTO n,current_state,before_note,before_price FROM public.orders WHERE order_number='REFUND-ROLLBACK-CHECK';
IF n<>2500 OR current_state<>'PARTIALLY_REFUNDED' OR before_note<>'Istorinė pastaba' OR before_price<>99 THEN RAISE EXCEPTION 'Partial/duplicate/snapshot check failed'; END IF;
PERFORM public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','PAID',9900,'2026-11-04T11:00:00Z','check-late-paid');
IF (SELECT payment_status FROM public.orders WHERE order_number='REFUND-ROLLBACK-CHECK')<>'PARTIALLY_REFUNDED' THEN RAISE EXCEPTION 'Late PAID regressed refund'; END IF;
BEGIN
 PERFORM public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','PARTIALLY_REFUNDED',9900,'2026-11-04T13:10:00Z','check-overflow','[{"uuid":"99999999-0000-4000-8000-000000000004","amount_cents":9900,"status":"SUCCESSFUL","created_at":"2026-11-04T13:10:00Z","event_at":"2026-11-04T13:10:00Z"}]');
 RAISE EXCEPTION 'Expected over-refund rejection';
EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Refund exceeds captured amount%' THEN RAISE; END IF; END;
IF EXISTS(SELECT 1 FROM public.order_refunds WHERE montonio_refund_uuid='99999999-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'Rejected event not rolled back'; END IF;
PERFORM public.record_montonio_event('REFUND-ROLLBACK-CHECK','99999999-0000-4000-8000-000000000002','REFUNDED',9900,'2026-11-04T13:20:00Z','check-full','[{"uuid":"99999999-0000-4000-8000-000000000005","amount_cents":7400,"status":"SUCCESSFUL","created_at":"2026-11-04T13:20:00Z","event_at":"2026-11-04T13:20:00Z"}]');
IF (SELECT refunded_amount_cents FROM public.orders WHERE order_number='REFUND-ROLLBACK-CHECK')<>9900 THEN RAISE EXCEPTION 'Full refund failed'; END IF;
IF (SELECT count(*) FROM public.payment_events WHERE order_id='99999999-0000-4000-8000-000000000001')<>4 THEN RAISE EXCEPTION 'Duplicate events not deduplicated'; END IF;
RAISE NOTICE 'PASS atomic refund ledger, duplicate delivery, late PAID, cumulative limit, full refund, snapshot preservation';
END $$;
ROLLBACK;
