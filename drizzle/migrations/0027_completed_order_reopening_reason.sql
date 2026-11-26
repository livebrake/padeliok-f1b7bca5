CREATE OR REPLACE FUNCTION public.change_team_order(order_uuid uuid, work_status text DEFAULT NULL, member_uuid uuid DEFAULT NULL, change_assignment boolean DEFAULT false, note_text text DEFAULT NULL, response_path text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE actor text; current_status text; BEGIN
IF public.team_access() IS NULL THEN RAISE EXCEPTION 'Prieiga negalima'; END IF;
SELECT status INTO current_status FROM public.orders WHERE id=order_uuid FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Užsakymas nerastas'; END IF;
IF work_status IS NOT NULL THEN
IF work_status NOT IN ('Naujas','Vykdoma','Atlikta','Atšaukta') THEN RAISE EXCEPTION 'Netinkama darbo būsena'; END IF;
IF current_status='Atlikta' AND work_status<>'Atlikta' AND length(btrim(coalesce(note_text,'')))=0 THEN RAISE EXCEPTION 'Nurodykite būsenos keitimo priežastį.'; END IF;
UPDATE public.orders SET status=work_status WHERE id=order_uuid;
END IF;
IF change_assignment THEN IF member_uuid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.team_members WHERE id=member_uuid AND is_active) THEN RAISE EXCEPTION 'Darbuotojas neaktyvus'; END IF; UPDATE public.orders SET assigned_member_id=member_uuid WHERE id=order_uuid; END IF;
IF note_text IS NOT NULL THEN IF length(trim(note_text)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Pastaba turi būti 1–2000 simbolių'; END IF; SELECT name INTO actor FROM public.team_members WHERE user_id=auth.uid(); INSERT INTO public.order_audit_logs(order_id,actor_id,actor_name,action_type,description) VALUES(order_uuid,auth.uid(),actor,'NOTE',trim(note_text)); END IF;
IF response_path IS NOT NULL THEN IF response_path NOT LIKE 'responses/'||order_uuid::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='order-documents' AND name=response_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Dokumentas nerastas'; END IF; UPDATE public.orders SET response_file_paths=array_append(response_file_paths,response_path) WHERE id=order_uuid; END IF;
END $$;
REVOKE ALL ON FUNCTION public.change_team_order(uuid,text,uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_team_order(uuid,text,uuid,boolean,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_order_completed_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NEW.status IS DISTINCT FROM OLD.status THEN
IF NEW.status='Atlikta' THEN NEW.completed_at:=now(); ELSIF OLD.status='Atlikta' THEN NEW.completed_at:=NULL; END IF;
END IF;
RETURN NEW;
END $$;