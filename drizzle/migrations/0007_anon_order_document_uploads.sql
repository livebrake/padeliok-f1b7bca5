-- Allow anonymous visitors to upload order documents directly from the browser,
-- but only into the incoming/ folder of the private order-documents bucket.
-- Files stay private: no SELECT for anon; admins read via existing authenticated policies.
create policy "anon_uploads_order_documents_incoming"
on storage.objects for insert to anon
with check (
  bucket_id = 'order-documents'
  and (storage.foldername(name))[1] = 'incoming'
);