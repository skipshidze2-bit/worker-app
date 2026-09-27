-- Private bucket for ID photos and selfies. Each user writes to a folder named
-- after their user id; only they and admins can read it.
insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

create policy id_docs_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy id_docs_update_own on storage.objects for update to authenticated
  using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy id_docs_read_own_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'id-documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
