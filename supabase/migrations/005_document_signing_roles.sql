-- ORIGENIX — Sprint 1: autorização profissional para documentos e assinaturas

begin;

create or replace function private.tem_papel(papeis_permitidos text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.user_id = (select auth.uid())
      and p.ativo
      and p.papel = any (papeis_permitidos)
  );
$$;

revoke all on function private.tem_papel(text[]) from public, anon;
grant execute on function private.tem_papel(text[]) to authenticated;

drop policy if exists documentos_update on public.documentos;
create policy documentos_update on public.documentos for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);

create or replace function private.proteger_assinatura_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'assinado'
     and old.status is distinct from new.status
     and not (select private.tem_papel(array['administrador', 'rt'])) then
    raise insufficient_privilege
      using message = 'Somente Administrador ou RT pode assinar documentos.';
  end if;

  return new;
end;
$$;

revoke all on function private.proteger_assinatura_documento() from public, anon, authenticated;

drop trigger if exists proteger_assinatura_documento on public.documentos;
create trigger proteger_assinatura_documento
before update on public.documentos
for each row execute function private.proteger_assinatura_documento();

commit;
