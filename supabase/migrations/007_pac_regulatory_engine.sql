-- ORIGENIX — Motor regulatório de Programas de Autocontrole

begin;

create table if not exists public.pac_modelos (
  codigo text primary key,
  titulo text not null,
  categoria text not null,
  descricao text not null,
  aplicabilidade text[] not null default array['todos']::text[],
  especies text[] not null default array['todas']::text[],
  base_legal text,
  ordem integer not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.empresa_pacs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  modelo_codigo text not null references public.pac_modelos(codigo),
  versao integer not null default 1 check (versao > 0),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_revisao', 'aprovado', 'implantado', 'suspenso')),
  responsavel_user_id uuid references auth.users(id),
  aprovado_por uuid references auth.users(id),
  aprovado_em timestamptz,
  proxima_revisao date,
  conteudo jsonb not null default '{}'::jsonb,
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, modelo_codigo, versao)
);

create table if not exists public.pac_registros (
  id uuid primary key default gen_random_uuid(),
  empresa_pac_id uuid not null references public.empresa_pacs(id) on delete cascade,
  tipo text not null default 'monitoramento'
    check (tipo in ('monitoramento', 'verificacao', 'validacao', 'treinamento', 'evidencia')),
  data_registro date not null default current_date,
  resultado text not null default 'conforme'
    check (resultado in ('conforme', 'nao_conforme', 'nao_aplicavel')),
  descricao text not null,
  evidencia_url text,
  registrado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.pac_nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  empresa_pac_id uuid not null references public.empresa_pacs(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  causa text,
  acao_imediata text,
  acao_corretiva text,
  responsavel_user_id uuid references auth.users(id),
  prazo date,
  status text not null default 'aberta'
    check (status in ('aberta', 'em_tratamento', 'verificada', 'encerrada')),
  verificada_por uuid references auth.users(id),
  verificada_em timestamptz,
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_empresa_pacs_empresa on public.empresa_pacs (empresa_id);
create index if not exists idx_empresa_pacs_status on public.empresa_pacs (status);
create index if not exists idx_pac_registros_pac_data on public.pac_registros (empresa_pac_id, data_registro desc);
create index if not exists idx_pac_nc_pac_status on public.pac_nao_conformidades (empresa_pac_id, status);

create or replace function private.pode_acessar_pac(target_pac_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.empresa_pacs ep
    where ep.id = target_pac_id
      and (select private.pode_acessar_empresa(ep.empresa_id))
  );
$$;

revoke all on function private.pode_acessar_pac(uuid) from public, anon;
grant execute on function private.pode_acessar_pac(uuid) to authenticated;

alter table public.pac_modelos enable row level security;
alter table public.empresa_pacs enable row level security;
alter table public.pac_registros enable row level security;
alter table public.pac_nao_conformidades enable row level security;

drop policy if exists pac_modelos_select on public.pac_modelos;
drop policy if exists pac_modelos_admin_all on public.pac_modelos;
drop policy if exists empresa_pacs_select on public.empresa_pacs;
drop policy if exists empresa_pacs_insert on public.empresa_pacs;
drop policy if exists empresa_pacs_update on public.empresa_pacs;
drop policy if exists empresa_pacs_delete on public.empresa_pacs;
drop policy if exists pac_registros_select on public.pac_registros;
drop policy if exists pac_registros_insert on public.pac_registros;
drop policy if exists pac_registros_update on public.pac_registros;
drop policy if exists pac_registros_delete on public.pac_registros;
drop policy if exists pac_nc_select on public.pac_nao_conformidades;
drop policy if exists pac_nc_insert on public.pac_nao_conformidades;
drop policy if exists pac_nc_update on public.pac_nao_conformidades;
drop policy if exists pac_nc_delete on public.pac_nao_conformidades;

create policy pac_modelos_select on public.pac_modelos for select to authenticated
using (ativo or (select private.eh_administrador()));
create policy pac_modelos_admin_all on public.pac_modelos for all to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));

create policy empresa_pacs_select on public.empresa_pacs for select to authenticated
using ((select private.pode_acessar_empresa(empresa_id)));
create policy empresa_pacs_insert on public.empresa_pacs for insert to authenticated
with check (
  (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and criado_por = (select auth.uid())
);
create policy empresa_pacs_update on public.empresa_pacs for update to authenticated
using (
  (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
)
with check (
  (select private.pode_acessar_empresa(empresa_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);
create policy empresa_pacs_delete on public.empresa_pacs for delete to authenticated
using ((select private.eh_administrador()));

create policy pac_registros_select on public.pac_registros for select to authenticated
using ((select private.pode_acessar_pac(empresa_pac_id)));
create policy pac_registros_insert on public.pac_registros for insert to authenticated
with check (
  (select private.pode_acessar_pac(empresa_pac_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and registrado_por = (select auth.uid())
);
create policy pac_registros_update on public.pac_registros for update to authenticated
using (
  (select private.pode_acessar_pac(empresa_pac_id))
  and registrado_por = (select auth.uid())
)
with check (
  (select private.pode_acessar_pac(empresa_pac_id))
  and registrado_por = (select auth.uid())
);
create policy pac_registros_delete on public.pac_registros for delete to authenticated
using ((select private.eh_administrador()));

create policy pac_nc_select on public.pac_nao_conformidades for select to authenticated
using ((select private.pode_acessar_pac(empresa_pac_id)));
create policy pac_nc_insert on public.pac_nao_conformidades for insert to authenticated
with check (
  (select private.pode_acessar_pac(empresa_pac_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
  and criado_por = (select auth.uid())
);
create policy pac_nc_update on public.pac_nao_conformidades for update to authenticated
using (
  (select private.pode_acessar_pac(empresa_pac_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
)
with check (
  (select private.pode_acessar_pac(empresa_pac_id))
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);
create policy pac_nc_delete on public.pac_nao_conformidades for delete to authenticated
using ((select private.eh_administrador()));

grant select on public.pac_modelos to authenticated;
grant select, insert, update, delete on public.empresa_pacs to authenticated;
grant select, insert, update, delete on public.pac_registros to authenticated;
grant select, insert, update, delete on public.pac_nao_conformidades to authenticated;

insert into public.pac_modelos
  (codigo, titulo, categoria, descricao, aplicabilidade, especies, base_legal, ordem)
values
  ('PAC-01','Manutenção de instalações e equipamentos','Infraestrutura','Controle preventivo e corretivo da estrutura, máquinas, utensílios e equipamentos.',array['todos'],array['todas'],'RIISPOA, art. 74',1),
  ('PAC-02','Água de abastecimento','Utilidades','Potabilidade, reservação, distribuição, cloração, análises e ações corretivas.',array['todos'],array['todas'],'RIISPOA, arts. 42 e 74',2),
  ('PAC-03','Controle integrado de pragas','Higiene','Prevenção, monitoramento, barreiras, mapa de iscas e tratamento por empresa habilitada.',array['todos'],array['todas'],'RIISPOA, art. 74; BPF',3),
  ('PAC-04','PPHO — higiene industrial e operacional','Higiene','Procedimentos pré-operacionais e operacionais para evitar contaminação direta e cruzada.',array['todos'],array['todas'],'RIISPOA, art. 10, XVI, e art. 74',4),
  ('PAC-05','Higiene, hábitos e saúde dos colaboradores','Pessoas','Saúde ocupacional, uniformização, higienização das mãos, conduta e capacitação.',array['todos'],array['todas'],'RIISPOA, art. 74; BPF',5),
  ('PAC-06','Controle de temperaturas','Processo','Limites, monitoramento e correção para ambientes, matérias-primas e produtos.',array['todos'],array['todas'],'RIISPOA, art. 74',6),
  ('PAC-07','Calibração e aferição','Metrologia','Identificação, calibração, verificação e rastreabilidade de instrumentos de medição.',array['todos'],array['todas'],'RIISPOA, art. 74',7),
  ('PAC-08','Matérias-primas, ingredientes e embalagens','Suprimentos','Recepção, avaliação, aprovação de fornecedores, armazenamento e rastreabilidade.',array['todos'],array['todas'],'RIISPOA, arts. 73 e 74',8),
  ('PAC-09','APPCC','Segurança dos alimentos','Análise de perigos, pontos críticos, limites, monitoramento, correção e verificação.',array['abate','processamento'],array['todas'],'RIISPOA, art. 74, §1º',9),
  ('PAC-10','Análises laboratoriais','Verificação','Plano amostral e controle físico-químico, microbiológico e de água.',array['todos'],array['todas'],'RIISPOA, art. 475',10),
  ('PAC-11','Rastreabilidade e recolhimento','Rastreabilidade','Identificação de lotes, cadeia de custódia, simulado e recolhimento de produto.',array['todos'],array['todas'],'Lei 14.515/2022; RIISPOA',11),
  ('PAC-12','Resíduos e contaminantes','Segurança dos alimentos','Controle de resíduos químicos, medicamentos, contaminantes e atendimento a programas oficiais.',array['todos'],array['todas'],'RIISPOA; PNCRC',12),
  ('PAC-13','Bem-estar animal','Abate','Recepção, descarga, descanso, manejo, contenção, insensibilização e sangria.',array['abate'],array['bovinos','bubalinos','suinos','aves','ovinos','caprinos'],'RIISPOA, art. 74, §1º',13),
  ('PAC-14','Recepção, abate e inspeção','Abate','Fluxo de animais, documentação, inspeção ante e post mortem e correlação de lotes.',array['abate'],array['bovinos','bubalinos','suinos','aves','ovinos','caprinos'],'RIISPOA',14),
  ('PAC-15','Segregação e destinação de partes','Abate','Identificação, segregação, controle e destinação de carcaças, órgãos e partes condenadas.',array['abate'],array['bovinos','bubalinos','suinos','aves','ovinos','caprinos'],'RIISPOA; procedimentos oficiais de inspeção',15),
  ('PAC-16','Processamento de vísceras','Abate','Fluxo higiênico, correlação, inspeção, lavagem, resfriamento e prevenção de cruzamentos.',array['abate'],array['bovinos','bubalinos','suinos','aves','ovinos','caprinos'],'RIISPOA',16),
  ('PAC-17','Controle de contaminação cruzada','Processo','Separação de áreas, fluxos de pessoas e produtos, utensílios e barreiras sanitárias.',array['abate','processamento'],array['todas'],'RIISPOA; BPF; PPHO',17),
  ('PAC-18','Resíduos, efluentes e subprodutos','Ambiental','Coleta, armazenamento, transporte, destinação e prevenção de contaminação ambiental.',array['todos'],array['todas'],'RIISPOA e legislação ambiental aplicável',18),
  ('PAC-19','Rotulagem, carimbos e expedição','Produto','Aprovação de rótulos, identificação, marcas oficiais autorizadas, armazenagem e expedição.',array['todos'],array['todas'],'RIISPOA; normas do serviço de inspeção',19),
  ('PAC-20','Autocorreção, não conformidades e auditoria','Gestão','Detecção de desvios, causa, ação imediata, ação corretiva, verificação e eficácia.',array['todos'],array['todas'],'Lei 14.515/2022',20)
on conflict (codigo) do update set
  titulo = excluded.titulo,
  categoria = excluded.categoria,
  descricao = excluded.descricao,
  aplicabilidade = excluded.aplicabilidade,
  especies = excluded.especies,
  base_legal = excluded.base_legal,
  ordem = excluded.ordem,
  atualizado_em = now();

commit;
