CREATE OR REPLACE FUNCTION public.lock_refund_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous public.order_refunds;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.montonio_refund_uuid::text,0));
 SELECT * INTO previous FROM public.order_refunds WHERE montonio_refund_uuid=NEW.montonio_refund_uuid;
 IF FOUND AND (previous.order_id<>NEW.order_id OR previous.amount_cents<>NEW.amount_cents) THEN RAISE EXCEPTION 'Refund identity mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER serialize_refund_identity BEFORE INSERT ON public.order_refunds FOR EACH ROW EXECUTE FUNCTION public.lock_refund_identity();
COMMENT ON COLUMN public.order_refunds.event_at IS 'Time the reconciled provider status was observed; API does not expose refund settlement time.';
COMMENT ON COLUMN public.orders.refunded_at IS 'Latest observed successful refund; not an exact provider settlement timestamp.';