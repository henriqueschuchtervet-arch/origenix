-- ORIGENIX — Sprint 1: RLS dos módulos operacionais

begin;

create or replace function private.pode_acessar_documento(target_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = target_documento_id
      and (select private.pode_acessar_empresa(d.empresa_id))
  );
$$;

revoke all on function private.pode_acessar_documento(uuid) from public, anon;
grant execute on function private.pode_acessar_documento(uuid) to authenticated;

alter table public.auditorias enable row level security;
alter table public.tarefas enable row level security;
alter table public.anexos enable row level security;

drop policy if exists auditorias_select on public.auditorias;
create policy auditorias_select on public.auditorias for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
drop policy if exists auditorias_insert on public.auditorias;
create policy auditorias_insert on public.auditorias for insert to authenticated
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
);
drop policy if exists auditorias_update on public.auditorias;
create policy auditorias_update on public.auditorias for update to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)))
with check (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
drop policy if exists auditorias_delete on public.auditorias;
create policy auditorias_delete on public.auditorias for delete to authenticated
using ((select private.eh_administrador()));

drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
drop policy if exists tarefas_insert on public.tarefas;
create policy tarefas_insert on public.tarefas for insert to authenticated
with check (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
drop policy if exists tarefas_update on public.tarefas;
create policy tarefas_update on public.tarefas for update to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)))
with check (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
drop policy if exists tarefas_delete on public.tarefas;
create policy tarefas_delete on public.tarefas for delete to authenticated
using ((select private.eh_administrador()));

drop policy if exists anexos_select on public.anexos;
create policy anexos_select on public.anexos for select to authenticated
using (documento_id is not null and (select private.pode_acessar_documento(documento_id)));
drop policy if exists anexos_insert on public.anexos;
create policy anexos_insert on public.anexos for insert to authenticated
with check (documento_id is not null and (select private.pode_acessar_documento(documento_id)));
drop policy if exists anexos_delete on public.anexos;
create policy anexos_delete on public.anexos for delete to authenticated
using (
  (select private.eh_administrador())
  or (documento_id is not null and (select private.pode_acessar_documento(documento_id)))
);

drop policy if exists "Apenas usuários autenticados atualizam leads" on public.leads;
drop policy if exists "Apenas usuários autenticados veem leads" on public.leads;
drop policy if exists "Qualquer um pode enviar um lead" on public.leads;
drop policy if exists leads_authenticated_delete on public.leads;
drop policy if exists leads_authenticated_select on public.leads;
drop policy if exists leads_authenticated_update on public.leads;
drop policy if exists leads_public_insert on public.leads;

create policy leads_public_insert on public.leads for insert to anon, authenticated
with check (
  length(trim(nome)) between 2 and 160
  and (email is null or length(email) <= 320)
  and (mensagem is null or length(mensagem) <= 4000)
);
create policy leads_admin_select on public.leads for select to authenticated
using ((select private.eh_administrador()));
create policy leads_admin_update on public.leads for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));
create policy leads_admin_delete on public.leads for delete to authenticated
using ((select private.eh_administrador()));

grant select, insert, update, delete on public.auditorias to authenticated;
grant select, insert, update, delete on public.tarefas to authenticated;
grant select, insert, delete on public.anexos to authenticated;
grant select, update, delete on public.leads to authenticated;
grant insert on public.leads to anon;

commit;
