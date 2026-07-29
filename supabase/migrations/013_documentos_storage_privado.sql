-- ORIGENIX: bucket privado para anexos documentais.
-- O primeiro segmento do caminho é sempre o UUID do documento.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documentos',
  'documentos',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos'
  and exists (
    select 1
    from public.documentos documento
    where documento.id::text = (storage.foldername(name))[1]
      and (select private.pode_acessar_documento(documento.id))
  )
);

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos'
  and exists (
    select 1
    from public.documentos documento
    where documento.id::text = (storage.foldername(name))[1]
      and (select private.pode_acessar_documento(documento.id))
      and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  )
);

drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documentos'
  and exists (
    select 1
    from public.documentos documento
    where documento.id::text = (storage.foldername(name))[1]
      and (select private.pode_acessar_documento(documento.id))
      and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  )
);
