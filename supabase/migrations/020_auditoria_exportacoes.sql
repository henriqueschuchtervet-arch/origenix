-- ORIGENIX: exportações rastreáveis, imutáveis e limitadas por RLS.

begin;

create table if not exists public.auditoria_exportacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  empresa_id uuid references public.empresas(id) on delete set null,
  filtros jsonb not null default '{}'::jsonb,
  total_registros integer not null
    check (total_registros between 0 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_exportacoes_usuario_created_at
on public.auditoria_exportacoes (usuario_id, created_at desc);

alter table public.auditoria_exportacoes enable row level security;

drop policy if exists auditoria_exportacoes_select
on public.auditoria_exportacoes;
create policy auditoria_exportacoes_select
on public.auditoria_exportacoes
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or (select private.eh_administrador())
);

drop policy if exists auditoria_exportacoes_insert
on public.auditoria_exportacoes;
create policy auditoria_exportacoes_insert
on public.auditoria_exportacoes
for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and (
    empresa_id is null
    or (select private.pode_acessar_empresa(empresa_id))
  )
);

revoke all on table public.auditoria_exportacoes
from anon, authenticated;
grant select, insert on table public.auditoria_exportacoes
to authenticated;

create or replace function private.auditar_exportacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditorias (
    empresa_id,
    usuario_id,
    acao,
    detalhes
  )
  values (
    new.empresa_id,
    new.usuario_id,
    'AUDITORIA_EXPORTADA',
    jsonb_build_object(
      'exportacao_id', new.id,
      'filtros', new.filtros,
      'total_registros', new.total_registros
    )::text
  );

  return new;
end;
$$;

revoke all on function private.auditar_exportacao()
from public, anon, authenticated;

drop trigger if exists auditar_exportacao
on public.auditoria_exportacoes;
create trigger auditar_exportacao
after insert on public.auditoria_exportacoes
for each row
execute function private.auditar_exportacao();

drop policy if exists auditorias_select on public.auditorias;
create policy auditorias_select
on public.auditorias
for select
to authenticated
using (
  (
    empresa_id is not null
    and (select private.pode_acessar_empresa(empresa_id))
  )
  or (
    empresa_id is null
    and (
      usuario_id = (select auth.uid())
      or (select private.eh_administrador())
    )
  )
);

commit;
