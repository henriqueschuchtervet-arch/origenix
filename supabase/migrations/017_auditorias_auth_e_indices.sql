-- ORIGENIX: identidade correta do ator e índices da central de auditoria.

begin;

alter table public.auditorias
drop constraint if exists auditorias_usuario_id_fkey;

alter table public.auditorias
add constraint auditorias_usuario_id_fkey
foreign key (usuario_id)
references auth.users(id)
on delete set null;

create index if not exists idx_auditorias_created_at
on public.auditorias (created_at desc, id desc);

create index if not exists idx_auditorias_empresa_created_at
on public.auditorias (empresa_id, created_at desc, id desc);

create index if not exists idx_auditorias_acao_created_at
on public.auditorias (acao, created_at desc, id desc);

commit;
