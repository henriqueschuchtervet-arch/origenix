-- ORIGENIX: eventos de auditoria são produzidos internamente, nunca pelo cliente.

begin;

create or replace function private.auditar_exclusao_anexo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  empresa uuid;
begin
  select d.empresa_id
  into empresa
  from public.documentos d
  where d.id = old.documento_id;

  insert into public.auditorias (empresa_id, usuario_id, acao, detalhes)
  values (
    empresa,
    (select auth.uid()),
    'ANEXO_EXCLUIDO',
    jsonb_build_object(
      'anexo_id', old.id,
      'documento_id', old.documento_id,
      'nome_arquivo', old.nome_arquivo,
      'objeto', old.url
    )::text
  );

  return old;
end;
$$;

revoke all on function private.auditar_exclusao_anexo()
from public, anon, authenticated;

drop trigger if exists auditar_exclusao_anexo on public.anexos;
create trigger auditar_exclusao_anexo
after delete on public.anexos
for each row
execute function private.auditar_exclusao_anexo();

create or replace function public.excluir_anexo_auditado(anexo_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  anexo public.anexos%rowtype;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Sessão inválida.';
  end if;

  if not (select private.tem_papel(array['administrador', 'rt', 'consultor'])) then
    raise insufficient_privilege using message = 'Perfil sem permissão para excluir anexos.';
  end if;

  select a.*
  into anexo
  from public.anexos a
  where a.id = anexo_id;

  if not found then
    raise no_data_found using message = 'Anexo não encontrado.';
  end if;

  if anexo.documento_id is null
     or not (select private.pode_acessar_documento(anexo.documento_id)) then
    raise insufficient_privilege using message = 'Acesso negado ao documento.';
  end if;

  delete from public.anexos a
  where a.id = anexo.id;

  return jsonb_build_object(
    'id', anexo.id,
    'documento_id', anexo.documento_id,
    'nome_arquivo', anexo.nome_arquivo
  );
end;
$$;

drop policy if exists auditorias_insert on public.auditorias;
revoke insert on table public.auditorias from authenticated;
grant select on table public.auditorias to authenticated;

commit;
