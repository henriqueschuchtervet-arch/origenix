-- ORIGENIX: privilégio mínimo para a trilha de auditoria append-only.

begin;

revoke all on table public.auditorias from authenticated;
grant select, insert on table public.auditorias to authenticated;

commit;
