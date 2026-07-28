-- ORIGENIX — Sprint 1: índices e políticas sem sobreposição

begin;

create index if not exists idx_anexos_documento_id
  on public.anexos (documento_id);
create index if not exists idx_auditorias_empresa_id
  on public.auditorias (empresa_id);
create index if not exists idx_auditorias_usuario_id
  on public.auditorias (usuario_id);
create index if not exists idx_tarefas_empresa_id
  on public.tarefas (empresa_id);
create index if not exists idx_tarefas_responsavel
  on public.tarefas (responsavel);
create index if not exists idx_usuarios_empresa_id
  on public.usuarios (empresa_id);

drop policy if exists perfis_admin_all on public.perfis;
create policy perfis_admin_insert on public.perfis for insert to authenticated
with check ((select private.eh_administrador()));
create policy perfis_admin_update on public.perfis for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));
create policy perfis_admin_delete on public.perfis for delete to authenticated
using ((select private.eh_administrador()));

drop policy if exists empresa_membros_admin_all on public.empresa_membros;
create policy empresa_membros_admin_insert on public.empresa_membros for insert to authenticated
with check ((select private.eh_administrador()));
create policy empresa_membros_admin_update on public.empresa_membros for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));
create policy empresa_membros_admin_delete on public.empresa_membros for delete to authenticated
using ((select private.eh_administrador()));

-- A tabela legada `usuarios` não participa do Supabase Auth e pode conter um
-- campo de senha. Ela fica indisponível pela Data API até sua remoção segura.
revoke all on public.usuarios from anon, authenticated;

commit;
