# Matriz de permissões ORIGENIX

| Recurso | Administrador | Consultor | RT | Cliente |
|---|---|---|---|---|
| Empresas associadas | Todas | Leitura e edição | Leitura | Leitura própria |
| Documentos | Total | Criar e editar | Criar, revisar e emitir | Ler os liberados |
| Usuários e papéis | Total | Não | Não | Não |
| Auditorias | Total | Criar e editar | Participar | Ler as próprias |
| Tarefas | Total | Criar e editar | Atualizar atribuídas | Atualizar atribuídas |
| Anexos | Total | Empresas associadas | Empresas associadas | Própria empresa |
| Leads | Total | Conforme atribuição futura | Não | Não |

## Regras essenciais

- A autorização é aplicada no banco por RLS.
- Ocultar botões no frontend não concede segurança.
- Papéis não são lidos de `user_metadata`.
- Todo acesso de Consultor, RT e Cliente depende de associação ativa em `empresa_membros`.
- Exclusões de empresas e documentos são exclusivas do Administrador durante a Sprint 1.

