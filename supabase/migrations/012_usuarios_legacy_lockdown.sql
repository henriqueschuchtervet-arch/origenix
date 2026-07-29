-- ORIGENIX: bloqueio explícito da tabela legada de usuários.
--
-- A identidade ativa do sistema vive em auth.users + public.profiles.
-- public.usuarios está vazia, não possui consumidores no frontend e contém uma
-- coluna legada chamada senha, portanto não deve ser exposta pela API.

alter table public.usuarios enable row level security;

revoke all on table public.usuarios from anon, authenticated;

drop policy if exists usuarios_legacy_deny_all on public.usuarios;
create policy usuarios_legacy_deny_all
on public.usuarios
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on table public.usuarios is
  'Tabela legada bloqueada. Use auth.users, public.profiles e public.empresa_membros.';

comment on column public.usuarios.senha is
  'Campo legado proibido para autenticação. Senhas são gerenciadas exclusivamente pelo Supabase Auth.';
