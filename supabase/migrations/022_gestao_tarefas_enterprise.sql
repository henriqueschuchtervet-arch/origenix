-- ORIGENIX: identidade, autorização e auditoria da gestão de tarefas.

begin;

alter table public.tarefas
drop constraint if exists tarefas_responsavel_fkey;

alter table public.tarefas
add constraint tarefas_responsavel_fkey
foreign key (responsavel)
references auth.users(id)
on delete set null;

alter table public.tarefas
add column if not exists criado_por uuid default auth.uid()
  references auth.users(id) on delete set null;

update public.tarefas
set status = 'pendente'
where status is null;

alter table public.tarefas
alter column status set default 'pendente',
alter column status set not null;

alter table public.tarefas
drop constraint if exists tarefas_status_check;
alter table public.tarefas
add constraint tarefas_status_check
check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada'));

drop policy if exists tarefas_insert on public.tarefas;
create policy tarefas_insert
on public.tarefas
for insert
to authenticated
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and (
    responsavel is null
    or responsavel = (select auth.uid())
    or (select private.eh_administrador())
  )
);

drop policy if exists tarefas_update on public.tarefas;
create policy tarefas_update
on public.tarefas
for update
to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and (
    responsavel is null
    or responsavel = (select auth.uid())
    or (select private.eh_administrador())
  )
);

create or replace function private.preparar_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();

  if new.status = 'concluida'
     and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    new.concluida_em := now();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
  end if;

  return new;
end;
$$;

revoke all on function private.preparar_tarefa()
from public, anon, authenticated;

drop trigger if exists preparar_tarefa on public.tarefas;
create trigger preparar_tarefa
before insert or update on public.tarefas
for each row
execute function private.preparar_tarefa();

create or replace function private.auditar_tarefa_operacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registro public.tarefas%rowtype;
  acao_evento text;
begin
  if tg_op = 'DELETE' then
    registro := old;
  else
    registro := new;
  end if;

  if tg_op = 'INSERT' then
    acao_evento := 'TAREFA_CRIADA';
  elsif tg_op = 'DELETE' then
    acao_evento := 'TAREFA_EXCLUIDA';
  elsif old.status is distinct from new.status
        and new.status = 'concluida' then
    acao_evento := 'TAREFA_CONCLUIDA';
  else
    acao_evento := 'TAREFA_ATUALIZADA';
  end if;

  insert into public.auditorias (
    empresa_id,
    usuario_id,
    acao,
    detalhes
  )
  values (
    registro.empresa_id,
    (select auth.uid()),
    acao_evento,
    jsonb_build_object(
      'tarefa_id', registro.id,
      'titulo', registro.titulo,
      'status', registro.status,
      'prioridade', registro.prioridade,
      'prazo', registro.prazo,
      'responsavel', registro.responsavel
    )::text
  );

  return registro;
end;
$$;

revoke all on function private.auditar_tarefa_operacao()
from public, anon, authenticated;

drop trigger if exists auditar_tarefa_operacao on public.tarefas;
create trigger auditar_tarefa_operacao
after insert or update or delete on public.tarefas
for each row
execute function private.auditar_tarefa_operacao();

commit;
