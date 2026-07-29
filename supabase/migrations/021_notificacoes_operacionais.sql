-- ORIGENIX: base operacional para prazos, prioridades e leitura de alertas.

begin;

alter table public.tarefas
add column if not exists prioridade text not null default 'media',
add column if not exists prazo timestamptz,
add column if not exists concluida_em timestamptz,
add column if not exists atualizado_em timestamptz not null default now();

alter table public.tarefas
drop constraint if exists tarefas_prioridade_check;
alter table public.tarefas
add constraint tarefas_prioridade_check
check (prioridade in ('baixa', 'media', 'alta', 'critica'));

create index if not exists idx_tarefas_empresa_status_prazo
on public.tarefas (empresa_id, status, prazo);

create index if not exists idx_tarefas_responsavel_status_prazo
on public.tarefas (responsavel, status, prazo);

create table if not exists public.notificacao_leituras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  tipo text not null
    check (tipo in ('tarefa', 'documento')),
  referencia_id uuid not null,
  lida_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (usuario_id, tipo, referencia_id)
);

create index if not exists idx_notificacao_leituras_usuario
on public.notificacao_leituras (usuario_id, lida_em desc);

alter table public.notificacao_leituras enable row level security;

drop policy if exists notificacao_leituras_select
on public.notificacao_leituras;
create policy notificacao_leituras_select
on public.notificacao_leituras
for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists notificacao_leituras_insert
on public.notificacao_leituras;
create policy notificacao_leituras_insert
on public.notificacao_leituras
for insert
to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists notificacao_leituras_update
on public.notificacao_leituras;
create policy notificacao_leituras_update
on public.notificacao_leituras
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

revoke all on table public.notificacao_leituras
from anon, authenticated;
grant select, insert, update on table public.notificacao_leituras
to authenticated;

commit;
