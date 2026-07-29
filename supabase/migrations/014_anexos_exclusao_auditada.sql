-- ORIGENIX: exclusão de anexos com trilha imutável de auditoria.

begin;

drop policy if exists anexos_insert on public.anexos;
create policy anexos_insert
on public.anexos
for insert
to authenticated
with check (
  documento_id is not null
  and (select private.pode_acessar_documento(documento_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);

drop policy if exists anexos_delete on public.anexos;
create policy anexos_delete
on public.anexos
for delete
to authenticated
using (
  documento_id is not null
  and (select private.pode_acessar_documento(documento_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);

-- Registros de auditoria são append-only para os usuários da aplicação.
drop policy if exists auditorias_update on public.auditorias;
drop policy if exists auditorias_delete on public.auditorias;
revoke update, delete on table public.auditorias from authenticated;

create or replace function public.excluir_anexo_auditado(anexo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  anexo public.anexos%rowtype;
  empresa uuid;
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

  select d.empresa_id
  into empresa
  from public.documentos d
  where d.id = anexo.documento_id;

  delete from public.anexos a
  where a.id = anexo.id;

  insert into public.auditorias (empresa_id, usuario_id, acao, detalhes)
  values (
    empresa,
    (select auth.uid()),
    'ANEXO_EXCLUIDO',
    jsonb_build_object(
      'anexo_id', anexo.id,
      'documento_id', anexo.documento_id,
      'nome_arquivo', anexo.nome_arquivo,
      'objeto', anexo.url
    )::text
  );

  return jsonb_build_object(
    'id', anexo.id,
    'documento_id', anexo.documento_id,
    'nome_arquivo', anexo.nome_arquivo
  );
end;
$$;

revoke all on function public.excluir_anexo_auditado(uuid)
from public, anon;
grant execute on function public.excluir_anexo_auditado(uuid)
to authenticated;

commit;
