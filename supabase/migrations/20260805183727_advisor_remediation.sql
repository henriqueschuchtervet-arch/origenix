begin;

-- Keep the established indexes and remove duplicates introduced by hardening.
drop index if exists public.auditorias_usuario_id_idx;
drop index if exists public.empresas_user_id_idx;
drop index if exists public.faturamento_empresa_id_idx;
drop index if exists public.licencas_empresa_id_idx;
drop index if exists public.projetos_empresa_id_idx;

-- Cover the remaining foreign keys reported by the database advisor.
create index if not exists auditoria_exportacoes_empresa_id_idx
  on public.auditoria_exportacoes(empresa_id);
create index if not exists documentos_projeto_id_idx
  on public.documentos(projeto_id);
create index if not exists tarefas_criado_por_idx
  on public.tarefas(criado_por);

-- Avoid re-evaluating auth.uid() once per row and require an active profile.
drop policy if exists select_own on public.configuracoes;
drop policy if exists insert_own on public.configuracoes;
drop policy if exists update_own on public.configuracoes;

create policy configuracoes_select_own on public.configuracoes
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
);

create policy configuracoes_insert_own on public.configuracoes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
);

create policy configuracoes_update_own on public.configuracoes
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
)
with check (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
);

commit;
