-- ORIGENIX — Sprint 1: perfis, associações e RLS
-- IMPORTANTE: revisar e executar em janela controlada.
-- Não remove dados nem colunas existentes.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text not null default 'cliente'
    check (papel in ('administrador', 'rt', 'cliente', 'consultor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.empresa_membros (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null
    check (papel in ('administrador', 'rt', 'cliente', 'consultor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (empresa_id, user_id)
);

create index if not exists idx_empresa_membros_user_id
  on public.empresa_membros(user_id);

create index if not exists idx_empresa_membros_empresa_id
  on public.empresa_membros(empresa_id);

-- O primeiro usuário existente torna-se administrador.
-- Em instalações futuras, a promoção deve ser explícita.
insert into public.perfis (user_id, papel)
select id, 'administrador'
from auth.users
order by created_at
limit 1
on conflict (user_id) do nothing;

-- Preserva o acesso aos registros já vinculados.
insert into public.empresa_membros (empresa_id, user_id, papel)
select e.id, e.user_id, 'administrador'
from public.empresas e
where e.user_id is not null
on conflict (empresa_id, user_id) do nothing;

create or replace function private.usuario_ativo()
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
  );
$$;

create or replace function private.eh_administrador()
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
      and p.papel = 'administrador'
  );
$$;

create or replace function private.pode_acessar_empresa(target_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.eh_administrador())
    or exists (
      select 1
      from public.empresa_membros em
      where em.empresa_id = target_empresa_id
        and em.user_id = (select auth.uid())
        and em.ativo
    );
$$;

revoke all on function private.usuario_ativo() from public, anon;
revoke all on function private.eh_administrador() from public, anon;
revoke all on function private.pode_acessar_empresa(uuid) from public, anon;
grant execute on function private.usuario_ativo() to authenticated;
grant execute on function private.eh_administrador() to authenticated;
grant execute on function private.pode_acessar_empresa(uuid) to authenticated;

alter table public.perfis enable row level security;
alter table public.empresa_membros enable row level security;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select
on public.perfis for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.eh_administrador())
);

drop policy if exists perfis_admin_all on public.perfis;
create policy perfis_admin_all
on public.perfis for all
to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));

drop policy if exists empresa_membros_select on public.empresa_membros;
create policy empresa_membros_select
on public.empresa_membros for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.eh_administrador())
);

drop policy if exists empresa_membros_admin_all on public.empresa_membros;
create policy empresa_membros_admin_all
on public.empresa_membros for all
to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));

-- Remove somente políticas temporárias conhecidas.
drop policy if exists "Permitir tudo (temporário - fase de testes)" on public.empresas;
drop policy if exists empresas_authenticated_all on public.empresas;
drop policy if exists "Permitir tudo (temporário - fase de testes)" on public.documentos;
drop policy if exists documentos_authenticated_all on public.documentos;

drop policy if exists empresas_select on public.empresas;
create policy empresas_select
on public.empresas for select
to authenticated
using ((select private.pode_acessar_empresa(id)));

drop policy if exists empresas_insert on public.empresas;
create policy empresas_insert
on public.empresas for insert
to authenticated
with check (
  (select private.eh_administrador())
  or (
    (select private.usuario_ativo())
    and user_id = (select auth.uid())
  )
);

drop policy if exists empresas_update on public.empresas;
create policy empresas_update
on public.empresas for update
to authenticated
using ((select private.pode_acessar_empresa(id)))
with check ((select private.pode_acessar_empresa(id)));

drop policy if exists empresas_delete on public.empresas;
create policy empresas_delete
on public.empresas for delete
to authenticated
using ((select private.eh_administrador()));

drop policy if exists documentos_select on public.documentos;
create policy documentos_select
on public.documentos for select
to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
);

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert
on public.documentos for insert
to authenticated
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and user_id = (select auth.uid())
);

drop policy if exists documentos_update on public.documentos;
create policy documentos_update
on public.documentos for update
to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
);

drop policy if exists documentos_delete on public.documentos;
create policy documentos_delete
on public.documentos for delete
to authenticated
using ((select private.eh_administrador()));

-- Menor privilégio na Data API.
revoke all on table public.empresas from anon;
revoke all on table public.documentos from anon;
revoke all on table public.usuarios from anon;
revoke all on table public.auditorias from anon;
revoke all on table public.anexos from anon;
revoke all on table public.tarefas from anon;
revoke all on table public.leads from anon;

grant select, insert, update, delete on table public.empresas to authenticated;
grant select, insert, update, delete on table public.documentos to authenticated;
grant select, insert, update, delete on table public.perfis to authenticated;
grant select, insert, update, delete on table public.empresa_membros to authenticated;
grant insert on table public.leads to anon, authenticated;

commit;

-- Verificações posteriores:
-- 1. Executar Security Advisor.
-- 2. Confirmar que o administrador lê empresas e documentos.
-- 3. Confirmar que anon não lê empresas/documentos.
-- 4. Criar usuários de teste antes de promover outros papéis.
