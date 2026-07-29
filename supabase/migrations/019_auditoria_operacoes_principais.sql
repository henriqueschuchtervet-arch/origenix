-- ORIGENIX: captura interna das operações centrais do sistema.

begin;

create or replace function private.auditar_empresa_operacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acao_evento text;
  alteracoes text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    acao_evento := 'EMPRESA_CRIADA';
  elsif old.ativo is distinct from new.ativo and new.ativo = false then
    acao_evento := 'EMPRESA_ARQUIVADA';
  elsif old.ativo is distinct from new.ativo and new.ativo = true then
    acao_evento := 'EMPRESA_RESTAURADA';
  else
    acao_evento := 'EMPRESA_ATUALIZADA';
  end if;

  if tg_op = 'UPDATE' then
    if old.nome is distinct from new.nome then alteracoes := array_append(alteracoes, 'nome'); end if;
    if old.municipio is distinct from new.municipio then alteracoes := array_append(alteracoes, 'municipio'); end if;
    if old.tipo_estabelecimento is distinct from new.tipo_estabelecimento then alteracoes := array_append(alteracoes, 'tipo_estabelecimento'); end if;
    if old.inspecao is distinct from new.inspecao then alteracoes := array_append(alteracoes, 'inspecao'); end if;
    if old.rt_nome is distinct from new.rt_nome then alteracoes := array_append(alteracoes, 'responsavel_tecnico'); end if;
    if old.ativo is distinct from new.ativo then alteracoes := array_append(alteracoes, 'situacao'); end if;
  end if;

  insert into public.auditorias (empresa_id, usuario_id, acao, detalhes)
  values (
    new.id,
    (select auth.uid()),
    acao_evento,
    jsonb_build_object(
      'empresa_id', new.id,
      'nome', new.nome,
      'campos_alterados', alteracoes
    )::text
  );

  return new;
end;
$$;

revoke all on function private.auditar_empresa_operacao()
from public, anon, authenticated;

drop trigger if exists auditar_empresa_operacao on public.empresas;
create trigger auditar_empresa_operacao
after insert or update on public.empresas
for each row
execute function private.auditar_empresa_operacao();

create or replace function private.auditar_documento_operacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acao_evento text;
begin
  if tg_op = 'INSERT' then
    acao_evento := 'DOCUMENTO_EMITIDO';
  elsif old.status is distinct from new.status then
    acao_evento := 'DOCUMENTO_STATUS_ALTERADO';
  else
    return new;
  end if;

  insert into public.auditorias (empresa_id, usuario_id, acao, detalhes)
  values (
    new.empresa_id,
    (select auth.uid()),
    acao_evento,
    jsonb_build_object(
      'documento_id', new.id,
      'codigo', new.codigo,
      'tipo', new.tipo,
      'versao', new.versao,
      'status_anterior', case when tg_op = 'UPDATE' then old.status else null end,
      'status_atual', new.status
    )::text
  );

  return new;
end;
$$;

revoke all on function private.auditar_documento_operacao()
from public, anon, authenticated;

drop trigger if exists auditar_documento_operacao on public.documentos;
create trigger auditar_documento_operacao
after insert or update of status on public.documentos
for each row
execute function private.auditar_documento_operacao();

commit;
