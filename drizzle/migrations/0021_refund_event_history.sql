ALTER TABLE public.payment_events ADD COLUMN refund_snapshot jsonb NOT NULL DEFAULT '[]';
CREATE OR REPLACE FUNCTION public.record_montonio_event(order_reference text, provider_uuid uuid, new_status text, total_cents bigint, occurred_at timestamptz, event_key text, refund_rows jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE o public.orders; r jsonb; previous public.order_refunds; refunded bigint; captured bigint; effective text;
BEGIN
 SELECT * INTO o FROM public.orders WHERE order_number=order_reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF total_cents <> round(o.price*100)::bigint OR total_cents < 0 THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
 IF o.montonio_uuid IS NOT NULL AND o.montonio_uuid<>provider_uuid::text THEN RAISE EXCEPTION 'Provider order mismatch'; END IF;
 IF new_status NOT IN ('PAID','REFUNDED','PARTIALLY_REFUNDED','VOIDED','ABANDONED','AUTHORIZED','PENDING') THEN RAISE EXCEPTION 'Unsupported payment status'; END IF;
 IF jsonb_typeof(refund_rows)<>'array' OR jsonb_array_length(refund_rows)>1000 THEN RAISE EXCEPTION 'Invalid refunds'; END IF;
 captured:=coalesce(o.captured_amount_cents,CASE WHEN o.payment_status IN ('PAID','Apmokėta','PARTIALLY_REFUNDED','REFUNDED') THEN total_cents ELSE 0 END);
 FOR r IN SELECT value FROM jsonb_array_elements(refund_rows) LOOP
  IF (r->>'amount_cents')::bigint<=0 OR r->>'status' NOT IN ('PENDING','PROCESSING','SUCCESSFUL','REJECTED','CANCELED') THEN RAISE EXCEPTION 'Invalid refund'; END IF;
  SELECT * INTO previous FROM public.order_refunds WHERE montonio_refund_uuid=(r->>'uuid')::uuid;
  IF FOUND THEN
   IF previous.order_id<>o.id OR previous.amount_cents<>(r->>'amount_cents')::bigint THEN RAISE EXCEPTION 'Refund identity mismatch'; END IF;
   IF previous.status='SUCCESSFUL' OR (previous.event_at>(r->>'event_at')::timestamptz AND r->>'status'<>'SUCCESSFUL') THEN CONTINUE; END IF;
   IF previous.status IN ('REJECTED','CANCELED') AND r->>'status' IN ('PENDING','PROCESSING') THEN CONTINUE; END IF;
  END IF;
  INSERT INTO public.order_refunds(order_id,montonio_refund_uuid,amount_cents,status,status_description,provider_created_at,event_at)
  VALUES(o.id,(r->>'uuid')::uuid,(r->>'amount_cents')::bigint,r->>'status',r->>'description',(r->>'created_at')::timestamptz,(r->>'event_at')::timestamptz)
  ON CONFLICT(montonio_refund_uuid) DO UPDATE SET status=EXCLUDED.status,status_description=EXCLUDED.status_description,event_at=EXCLUDED.event_at,updated_at=now();
 END LOOP;
 SELECT coalesce(sum(amount_cents),0) INTO refunded FROM public.order_refunds WHERE order_id=o.id AND status='SUCCESSFUL';
 IF new_status IN ('PAID','REFUNDED','PARTIALLY_REFUNDED') AND o.payment_status<>'VOIDED' THEN captured:=total_cents; END IF;
 IF refunded>captured THEN RAISE EXCEPTION 'Refund exceeds captured amount'; END IF;
 IF new_status='VOIDED' OR o.payment_status='VOIDED' THEN
  IF refunded>0 THEN RAISE EXCEPTION 'Voided payment has refunds; reconciliation required'; END IF;
  captured:=0; effective:='VOIDED';
 ELSIF refunded>0 THEN effective:=CASE WHEN refunded=captured THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END;
 ELSIF captured>0 OR new_status='PAID' THEN effective:='PAID';
 ELSIF o.payment_event_at IS NOT NULL AND occurred_at<o.payment_event_at THEN effective:=o.payment_status;
 ELSE effective:=new_status;
 END IF;
 IF new_status IN ('REFUNDED','PARTIALLY_REFUNDED') AND refunded=0 THEN RAISE EXCEPTION 'Refund ledger not reconciled'; END IF;
 IF new_status='REFUNDED' AND refunded<>captured THEN RAISE EXCEPTION 'Full refund not reconciled'; END IF;
 INSERT INTO public.payment_events(order_id,event_key,payment_status,amount_cents,event_at,refund_snapshot) VALUES(o.id,event_key,new_status,total_cents,occurred_at,refund_rows) ON CONFLICT DO NOTHING;
 UPDATE public.orders SET payment_status=effective,captured_amount_cents=captured,refunded_amount_cents=refunded,
 montonio_uuid=provider_uuid::text,payment_event_at=greatest(coalesce(payment_event_at,occurred_at),occurred_at),
 paid_at=CASE WHEN captured>0 THEN coalesce(paid_at,occurred_at) ELSE paid_at END,
 refunded_at=CASE WHEN refunded>0 THEN (SELECT max(event_at) FROM public.order_refunds WHERE order_id=o.id AND status='SUCCESSFUL') ELSE refunded_at END WHERE id=o.id;
 RETURN jsonb_build_object('order_id',o.id,'payment_status',effective);
END $function$;
REVOKE ALL ON FUNCTION public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_montonio_event(text,uuid,text,bigint,timestamptz,text,jsonb) TO service_role;