-- Índices para as chaves estrangeiras dos módulos de PAC e versionamento.
-- Evitam varreduras completas em exclusões, auditorias e filtros por responsável.

create index if not exists idx_documento_versoes_criado_por
  on public.documento_versoes (criado_por);

create index if not exists idx_empresa_pacs_aprovado_por
  on public.empresa_pacs (aprovado_por);
create index if not exists idx_empresa_pacs_criado_por
  on public.empresa_pacs (criado_por);
create index if not exists idx_empresa_pacs_modelo_codigo
  on public.empresa_pacs (modelo_codigo);
create index if not exists idx_empresa_pacs_responsavel_user_id
  on public.empresa_pacs (responsavel_user_id);

create index if not exists idx_pac_nc_criado_por
  on public.pac_nao_conformidades (criado_por);
create index if not exists idx_pac_nc_responsavel_user_id
  on public.pac_nao_conformidades (responsavel_user_id);
create index if not exists idx_pac_nc_verificada_por
  on public.pac_nao_conformidades (verificada_por);

create index if not exists idx_pac_registros_registrado_por
  on public.pac_registros (registrado_por);
