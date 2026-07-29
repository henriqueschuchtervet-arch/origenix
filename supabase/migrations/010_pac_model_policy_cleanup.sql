-- Mantém uma única política de leitura e separa as escritas administrativas.
-- Evita avaliação duplicada de políticas permissivas em SELECT.

drop policy if exists pac_modelos_admin_all on public.pac_modelos;
drop policy if exists pac_modelos_admin_insert on public.pac_modelos;
drop policy if exists pac_modelos_admin_update on public.pac_modelos;
drop policy if exists pac_modelos_admin_delete on public.pac_modelos;

create policy pac_modelos_admin_insert
on public.pac_modelos for insert to authenticated
with check ((select private.eh_administrador()));

create policy pac_modelos_admin_update
on public.pac_modelos for update to authenticated
using ((select private.eh_administrador()))
with check ((select private.eh_administrador()));

create policy pac_modelos_admin_delete
on public.pac_modelos for delete to authenticated
using ((select private.eh_administrador()));
