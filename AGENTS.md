# Regras para agentes de desenvolvimento

## Segurança

- Nunca expor secret key, service role, senhas ou tokens.
- Não aplicar DDL diretamente sem migration revisável.
- Não remover tabelas ou colunas na mesma migration que introduz substitutas.
- Executar os Advisors após qualquer mudança de schema ou RLS.
- Testar acesso permitido e negado para cada papel.

## Arquitetura

- Preservar comportamento existente durante a modularização.
- Separar interface, domínio, validação e acesso a dados.
- Evitar novos HTMLs monolíticos.
- Fixar dependências e manter lockfile.

## Banco

- RLS obrigatória em schemas expostos.
- Políticas de UPDATE devem possuir `USING` e `WITH CHECK`.
- Não usar `auth.role()` para autorização.
- Não usar `user_metadata` como fonte de papel.
- Evitar `SECURITY DEFINER`; quando indispensável, manter em schema privado, fixar `search_path` e revogar execução pública.

## Qualidade

- Mudanças pequenas e revisáveis.
- Build, lint, tipos e testes devem passar antes de merge.
- Não misturar refatoração ampla com correção crítica de segurança.
- Documentar riscos, migrations e testes em `SYSTEM_AUDIT.md`.

