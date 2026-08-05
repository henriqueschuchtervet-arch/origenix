-- ORIGENIX production hardening
-- Non-destructive migration: preserves all existing business records.

begin;

-- Canonical roles and an explicit account lifecycle.
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.empresa_membros drop constraint if exists empresa_membros_papel_check;

update public.perfis
set papel = 'admin'
where papel = 'administrador';

update public.empresa_membros
set papel = 'admin'
where papel = 'administrador';

alter table public.perfis
  add column if not exists status text not null default 'pendente';

update public.perfis
set status = case when ativo then 'ativo' else 'suspenso' end
where status = 'pendente' and criado_em < now();

alter table public.perfis
  add constraint perfis_papel_check
  check (papel = any (array['admin', 'consultor', 'rt', 'colaborador', 'cliente']::text[])),
  add constraint perfis_status_check
  check (status = any (array['pendente', 'ativo', 'suspenso']::text[]));

alter table public.empresa_membros
  add constraint empresa_membros_papel_check
  check (papel = any (array['admin', 'consultor', 'rt', 'colaborador', 'cliente']::text[]));

-- Public access requests contain no password and are reviewed by an administrator.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  empresa text not null,
  cnpj text,
  cargo text,
  motivo text,
  papel_solicitado text not null default 'cliente'
    check (papel_solicitado = any (array['consultor', 'rt', 'colaborador', 'cliente']::text[])),
  empresa_id uuid references public.empresas(id) on delete set null,
  status text not null default 'pendente'
    check (status = any (array['pendente', 'em_analise', 'aprovado', 'convidado', 'rejeitado']::text[])),
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_em timestamptz,
  convidado_user_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint access_requests_nome_length check (char_length(btrim(nome)) between 2 and 160),
  constraint access_requests_email_length check (char_length(btrim(email)) between 5 and 320),
  constraint access_requests_empresa_length check (char_length(btrim(empresa)) between 2 and 200),
  constraint access_requests_motivo_length check (motivo is null or char_length(motivo) <= 4000)
);

create unique index if not exists access_requests_email_pending_uidx
  on public.access_requests (lower(btrim(email)))
  where status in ('pendente', 'em_analise', 'aprovado', 'convidado');
create index if not exists access_requests_status_criado_idx
  on public.access_requests (status, criado_em desc);

-- Fields needed by the production workflows.
alter table public.rts
  add column if not exists uf_conselho text,
  add column if not exists ativo boolean not null default true;

alter table public.empresas
  add column if not exists estado text;

alter table public.projetos
  add column if not exists prazo date,
  add column if not exists responsavel_user_id uuid references auth.users(id) on delete set null;

alter table public.licencas
  add column if not exists anexo_url text,
  add column if not exists observacoes text;

alter table public.auditorias
  add column if not exists nao_conformidades text,
  add column if not exists plano_acao text,
  add column if not exists status text not null default 'planejada',
  add column if not exists responsavel_user_id uuid references auth.users(id) on delete set null,
  add column if not exists anexo_url text;

alter table public.faturamento
  add column if not exists observacoes text;

alter table public.documentos
  add column if not exists arquivado_em timestamptz,
  add column if not exists assinado_por uuid references auth.users(id) on delete set null,
  add column if not exists assinado_em timestamptz,
  add column if not exists assinatura_tipo text;

alter table public.leads
  add column if not exists origem text not null default 'site';

-- New Auth users never receive application access automatically.
create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id, nome, papel, ativo, status)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    'cliente',
    false,
    'pendente'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function private.eh_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid())
      and p.ativo
      and p.status = 'ativo'
      and p.papel = 'admin'
  );
$$;

create or replace function private.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid())
      and p.ativo
      and p.status = 'ativo'
  );
$$;

-- Normalizes the legacy word "administrador" while old policies are phased out.
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
      and p.status = 'ativo'
      and p.papel = any (
        array(
          select case when papel = 'administrador' then 'admin' else papel end
          from unnest(papeis_permitidos) as papel
        )
      )
  );
$$;

create or replace function private.pode_acessar_empresa(target_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.usuario_ativo())
    and (
      (select private.eh_administrador())
      or exists (
        select 1
        from public.empresa_membros em
        where em.empresa_id = target_empresa_id
          and em.user_id = (select auth.uid())
          and em.ativo
      )
    );
$$;

create or replace function private.set_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- Atomic emission: updates the document and records an immutable version together.
create or replace function public.emitir_documento(
  p_documento_id uuid,
  p_titulo text,
  p_tipo text,
  p_conteudo text,
  p_hash_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  documento_atual public.documentos%rowtype;
  proxima_versao integer;
  codigo_final text;
begin
  if char_length(btrim(coalesce(p_titulo, ''))) < 2
     or char_length(coalesce(p_conteudo, '')) < 1
     or p_hash_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Documento inválido para emissão';
  end if;

  select * into documento_atual
  from public.documentos
  where id = p_documento_id
  for update;

  if documento_atual.id is null then
    raise exception 'Documento não encontrado';
  end if;

  select coalesce(max(numero_versao), 0) + 1
  into proxima_versao
  from public.documento_versoes
  where documento_id = p_documento_id;

  codigo_final := coalesce(
    documento_atual.codigo,
    'ORI-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(p_documento_id::text, '-', ''), 1, 8))
  );

  update public.documentos
  set titulo = btrim(p_titulo),
      tipo = nullif(btrim(coalesce(p_tipo, '')), ''),
      conteudo = p_conteudo,
      status = 'emitido',
      hash_sha256 = p_hash_sha256,
      codigo = codigo_final,
      versao = 'v' || proxima_versao::text || '.0',
      atualizado_em = now()
  where id = p_documento_id;

  insert into public.documento_versoes (
    documento_id, numero_versao, codigo, status, hash_sha256, conteudo, criado_por
  ) values (
    p_documento_id,
    proxima_versao,
    codigo_final,
    'emitido',
    p_hash_sha256,
    jsonb_build_object('titulo', btrim(p_titulo), 'tipo', p_tipo, 'conteudo', p_conteudo),
    (select auth.uid())
  );

  return jsonb_build_object(
    'id', p_documento_id,
    'codigo', codigo_final,
    'versao', 'v' || proxima_versao::text || '.0',
    'hash_sha256', p_hash_sha256,
    'status', 'emitido'
  );
end;
$$;

drop trigger if exists access_requests_set_atualizado_em on public.access_requests;
create trigger access_requests_set_atualizado_em
before update on public.access_requests
for each row execute function private.set_atualizado_em();

-- Replace the permissive legacy policies on core modules.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'access_requests', 'auditorias', 'documentos', 'documento_versoes',
        'empresas', 'faturamento', 'licencas', 'perfis', 'projetos', 'rts'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

alter table public.access_requests enable row level security;
create policy access_requests_public_insert on public.access_requests
for insert to anon, authenticated
with check (
  status = 'pendente'
  and revisado_por is null
  and revisado_em is null
  and convidado_user_id is null
  and char_length(btrim(nome)) between 2 and 160
  and char_length(btrim(email)) between 5 and 320
  and position('@' in email) > 1
);
create policy access_requests_admin_select on public.access_requests
for select to authenticated using ((select private.eh_administrador()));
create policy access_requests_admin_update on public.access_requests
for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));
create policy access_requests_admin_delete on public.access_requests
for delete to authenticated using ((select private.eh_administrador()));

create policy perfis_select on public.perfis
for select to authenticated
using (user_id = (select auth.uid()) or (select private.eh_administrador()));
create policy perfis_admin_insert on public.perfis
for insert to authenticated with check ((select private.eh_administrador()));
create policy perfis_admin_update on public.perfis
for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));
create policy perfis_admin_delete on public.perfis
for delete to authenticated using ((select private.eh_administrador()));

create policy empresas_select on public.empresas
for select to authenticated using ((select private.pode_acessar_empresa(id)));
create policy empresas_insert on public.empresas
for insert to authenticated
with check (
  (select private.eh_administrador())
  and user_id = (select auth.uid())
);
create policy empresas_update on public.empresas
for update to authenticated
using (
  (select private.pode_acessar_empresa(id))
  and (select private.tem_papel(array['admin', 'consultor']))
)
with check (
  (select private.pode_acessar_empresa(id))
  and (select private.tem_papel(array['admin', 'consultor']))
);

create policy documentos_select on public.documentos
for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
create policy documentos_insert on public.documentos
for insert to authenticated
with check (
  empresa_id is not null
  and user_id = (select auth.uid())
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy documentos_update on public.documentos
for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy documentos_delete on public.documentos
for delete to authenticated using ((select private.eh_administrador()));

create policy documento_versoes_select on public.documento_versoes
for select to authenticated
using ((select private.pode_acessar_documento(documento_id)));
create policy documento_versoes_insert on public.documento_versoes
for insert to authenticated
with check (
  criado_por = (select auth.uid())
  and (select private.pode_acessar_documento(documento_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy documento_versoes_delete on public.documento_versoes
for delete to authenticated using ((select private.eh_administrador()));

create policy projetos_select on public.projetos
for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
create policy projetos_insert on public.projetos
for insert to authenticated
with check (
  empresa_id is not null
  and user_id = (select auth.uid())
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy projetos_update on public.projetos
for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy projetos_delete on public.projetos
for delete to authenticated
using ((select private.eh_administrador()));

create policy licencas_select on public.licencas
for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
create policy licencas_insert on public.licencas
for insert to authenticated
with check (
  empresa_id is not null
  and user_id = (select auth.uid())
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy licencas_update on public.licencas
for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy licencas_delete on public.licencas
for delete to authenticated using ((select private.eh_administrador()));

create policy auditorias_select on public.auditorias
for select to authenticated
using (empresa_id is not null and (select private.pode_acessar_empresa(empresa_id)));
create policy auditorias_insert on public.auditorias
for insert to authenticated
with check (
  empresa_id is not null
  and user_id = (select auth.uid())
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy auditorias_update on public.auditorias
for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor', 'rt', 'colaborador']))
);
create policy auditorias_delete on public.auditorias
for delete to authenticated using ((select private.eh_administrador()));

create policy faturamento_select on public.faturamento
for select to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor']))
);
create policy faturamento_insert on public.faturamento
for insert to authenticated
with check (
  empresa_id is not null
  and user_id = (select auth.uid())
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor']))
);
create policy faturamento_update on public.faturamento
for update to authenticated
using (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor']))
)
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['admin', 'consultor']))
);
create policy faturamento_delete on public.faturamento
for delete to authenticated using ((select private.eh_administrador()));

-- RT records are visible only through a company the current user can access.
create policy rts_select on public.rts
for select to authenticated
using (
  (select private.eh_administrador())
  or exists (
    select 1 from public.empresas e
    where e.rt_id = rts.id and (select private.pode_acessar_empresa(e.id))
  )
);
create policy rts_insert on public.rts
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.tem_papel(array['admin', 'consultor', 'rt']))
);
create policy rts_update on public.rts
for update to authenticated
using (
  (select private.eh_administrador())
  or (
    user_id = (select auth.uid())
    and (select private.tem_papel(array['consultor', 'rt']))
  )
)
with check (
  (select private.eh_administrador())
  or (
    user_id = (select auth.uid())
    and (select private.tem_papel(array['consultor', 'rt']))
  )
);
create policy rts_delete on public.rts
for delete to authenticated using ((select private.eh_administrador()));

-- Helpful FK/query indexes and removal of one known duplicate index.
create index if not exists empresas_user_id_idx on public.empresas(user_id);
create index if not exists empresas_rt_id_idx on public.empresas(rt_id);
create index if not exists projetos_empresa_id_idx on public.projetos(empresa_id);
create index if not exists projetos_rt_id_idx on public.projetos(rt_id);
create index if not exists projetos_user_id_idx on public.projetos(user_id);
create index if not exists projetos_responsavel_user_id_idx on public.projetos(responsavel_user_id);
create index if not exists licencas_empresa_id_idx on public.licencas(empresa_id);
create index if not exists licencas_user_id_idx on public.licencas(user_id);
create index if not exists faturamento_empresa_id_idx on public.faturamento(empresa_id);
create index if not exists faturamento_user_id_idx on public.faturamento(user_id);
create index if not exists auditorias_rt_id_idx on public.auditorias(rt_id);
create index if not exists auditorias_user_id_idx on public.auditorias(user_id);
create index if not exists auditorias_usuario_id_idx on public.auditorias(usuario_id);
create index if not exists auditorias_responsavel_user_id_idx on public.auditorias(responsavel_user_id);
create index if not exists rts_user_id_idx on public.rts(user_id);
create index if not exists documentos_assinado_por_idx on public.documentos(assinado_por);
create index if not exists access_requests_empresa_id_idx on public.access_requests(empresa_id);
create index if not exists access_requests_revisado_por_idx on public.access_requests(revisado_por);
create index if not exists access_requests_convidado_user_id_idx on public.access_requests(convidado_user_id);
drop index if exists public.idx_auditorias_empresa;

-- Explicit Data API grants. RLS remains the row-level enforcement layer.
do $$
declare table_row record;
begin
  for table_row in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all privileges on table public.%I from anon', table_row.tablename);
    execute format('revoke all privileges on table public.%I from authenticated', table_row.tablename);
  end loop;
end;
$$;

grant insert on public.leads, public.access_requests to anon;

grant insert on public.leads, public.access_requests to authenticated;
grant select, insert, update, delete on public.access_requests to authenticated;
grant select, insert, update, delete on public.auditorias to authenticated;
grant select, insert, delete on public.anexos to authenticated;
grant select, insert on public.auditoria_exportacoes to authenticated;
grant select, insert, update on public.configuracoes to authenticated;
grant select on public.documento_contadores to authenticated;
grant select, insert, delete on public.documento_versoes to authenticated;
grant select, insert, update, delete on public.documentos to authenticated;
grant select, insert, update, delete on public.empresa_membros to authenticated;
grant select, insert, update, delete on public.empresa_pacs to authenticated;
grant select, insert, update on public.empresas to authenticated;
grant select, insert, update, delete on public.faturamento to authenticated;
grant select, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.licencas to authenticated;
grant select, insert, update on public.notificacao_leituras to authenticated;
grant select, insert, update, delete on public.pac_modelos to authenticated;
grant select, insert, update, delete on public.pac_nao_conformidades to authenticated;
grant select, insert, update, delete on public.pac_registros to authenticated;
grant select, insert, update, delete on public.perfis to authenticated;
grant select, insert, update, delete on public.projetos to authenticated;
grant select, insert, update, delete on public.rts to authenticated;
grant select, insert, update, delete on public.tarefas to authenticated;

revoke execute on function public.origenix_set_atualizado_em() from anon, authenticated;
revoke execute on function public.emitir_documento(uuid, text, text, text, text) from public, anon;
grant execute on function public.emitir_documento(uuid, text, text, text, text) to authenticated;
revoke execute on function private.set_atualizado_em() from public, anon, authenticated;

commit;
