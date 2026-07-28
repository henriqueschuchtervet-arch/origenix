-- ORIGENIX — Sprint 1: emissão restrita a perfis profissionais

begin;

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert on public.documentos for insert to authenticated
with check (
  empresa_id is not null
  and (select private.pode_acessar_empresa(empresa_id))
  and user_id = (select auth.uid())
  and (select private.tem_papel(array['administrador', 'rt', 'consultor']))
);

commit;
