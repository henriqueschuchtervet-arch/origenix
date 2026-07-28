-- ORIGENIX — Sprint 1: perfil automático para novos usuários
-- Mantém a autorização em public.perfis, sem confiar em user_metadata.

begin;

create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id, nome, papel, ativo)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    'cliente',
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.criar_perfil_novo_usuario() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_origenix on auth.users;
create trigger on_auth_user_created_origenix
after insert on auth.users
for each row execute function private.criar_perfil_novo_usuario();

-- Repara usuários existentes que ainda não possuem perfil.
insert into public.perfis (user_id, nome, papel, ativo)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'nome', '')), ''),
  'cliente',
  true
from auth.users u
left join public.perfis p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

commit;
