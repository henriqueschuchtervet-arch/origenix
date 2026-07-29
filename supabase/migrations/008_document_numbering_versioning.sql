-- ORIGENIX — Numeração atômica e histórico de versões documentais

begin;

create table if not exists public.documento_contadores (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_codigo text not null,
  ano integer not null,
  ultimo_numero bigint not null default 0 check (ultimo_numero >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, tipo_codigo, ano)
);

create table if not exists public.documento_versoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  numero_versao integer not null check (numero_versao > 0),
  codigo text not null,
  status text not null,
  hash_sha256 text,
  conteudo jsonb not null default '{}'::jsonb,
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  unique (documento_id, numero_versao)
);

create index if not exists idx_documento_versoes_documento
  on public.documento_versoes (documento_id, numero_versao desc);

alter table public.documento_contadores enable row level security;
alter table public.documento_versoes enable row level security;

drop policy if exists documento_contadores_select on public.documento_contadores;
create policy documento_contadores_select on public.documento_contadores for select to authenticated
using (
  (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);

drop policy if exists documento_versoes_select on public.documento_versoes;
create policy documento_versoes_select on public.documento_versoes for select to authenticated
using ((select private.pode_acessar_documento(documento_id)));

drop policy if exists documento_versoes_insert on public.documento_versoes;
create policy documento_versoes_insert on public.documento_versoes for insert to authenticated
with check (
  (select private.pode_acessar_documento(documento_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and criado_por = (select auth.uid())
);

drop policy if exists documento_versoes_delete on public.documento_versoes;
create policy documento_versoes_delete on public.documento_versoes for delete to authenticated
using ((select private.eh_administrador()));

grant select on public.documento_contadores to authenticated;
grant select, insert, delete on public.documento_versoes to authenticated;

create or replace function private.gerar_proximo_codigo_documento(
  target_empresa_id uuid,
  target_tipo_codigo text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ano_atual integer := extract(year from current_date)::integer;
  proximo_numero bigint;
  tipo_normalizado text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Autenticação obrigatória.';
  end if;

  if not (select private.pode_acessar_empresa(target_empresa_id))
     or not (select private.tem_papel(array['administrador', 'rt', 'consultor'])) then
    raise insufficient_privilege using message = 'Perfil sem permissão para emitir documentos.';
  end if;

  tipo_normalizado := regexp_replace(upper(coalesce(target_tipo_codigo, '')), '[^A-Z0-9]+', '-', 'g');
  tipo_normalizado := trim(both '-' from tipo_normalizado);
  if tipo_normalizado = '' or length(tipo_normalizado) > 20 then
    raise invalid_parameter_value using message = 'Código de tipo documental inválido.';
  end if;

  insert into public.documento_contadores
    (empresa_id, tipo_codigo, ano, ultimo_numero)
  values
    (target_empresa_id, tipo_normalizado, ano_atual, 1)
  on conflict (empresa_id, tipo_codigo, ano)
  do update set
    ultimo_numero = public.documento_contadores.ultimo_numero + 1,
    atualizado_em = now()
  returning ultimo_numero into proximo_numero;

  return format(
    'ORX-%s-%s-%s',
    tipo_normalizado,
    ano_atual,
    lpad(proximo_numero::text, 6, '0')
  );
end;
$$;

revoke all on function private.gerar_proximo_codigo_documento(uuid, text)
  from public, anon;
grant execute on function private.gerar_proximo_codigo_documento(uuid, text)
  to authenticated;

create or replace function public.proximo_codigo_documento(
  empresa_id uuid,
  tipo_codigo text
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.gerar_proximo_codigo_documento(empresa_id, tipo_codigo);
$$;

revoke all on function public.proximo_codigo_documento(uuid, text)
  from public, anon;
grant execute on function public.proximo_codigo_documento(uuid, text)
  to authenticated;

commit;
