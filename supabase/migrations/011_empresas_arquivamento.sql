-- Arquivamento reversível de estabelecimentos.
-- Evita perda de histórico documental e preserva referências existentes.
alter table public.empresas
  add column if not exists ativo boolean not null default true,
  add column if not exists arquivado_em timestamptz;

create index if not exists idx_empresas_ativo_criado_em
  on public.empresas (ativo, criado_em desc);

comment on column public.empresas.ativo is
  'Indica se o estabelecimento está ativo nas rotinas operacionais.';

comment on column public.empresas.arquivado_em is
  'Data do arquivamento reversível do estabelecimento.';
