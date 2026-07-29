-- ORIGENIX: a RPC de exclusão também obedece aos privilégios e RLS do chamador.

alter function public.excluir_anexo_auditado(uuid)
security invoker;
