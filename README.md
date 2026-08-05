# ORIGENIX

Aplicação web estática para gestão da consultoria veterinária regulatória, sanitária e industrial. A interface usa HTML, CSS e JavaScript; Supabase fornece Auth, Postgres/RLS e Edge Functions; Netlify publica os arquivos estáticos.

## Rotas

- `/` — site institucional e captação real de leads.
- `/origenix-sistema-login.html` — login, recuperação de senha e solicitação de acesso.
- `/origenix-dashboard-v3.html` — dashboard e módulos operacionais.
- `/origenix-emissao-v3.html` — criação, emissão, versionamento e aprovação interna de documentos.

As URLs antigas sem `.html` continuam válidas por redirects do Netlify.

## Segurança e acesso

O navegador usa apenas a chave pública/publishable do Supabase. A segurança depende de grants explícitos e RLS no banco. Nenhuma chave `service_role` pode ser incluída nos arquivos estáticos.

Novos usuários não recebem acesso automaticamente. O fluxo é:

1. A pessoa envia `access_requests` sem informar senha.
2. `anon` pode inserir, mas não ler, alterar ou apagar solicitações.
3. Um administrador ativo analisa no dashboard.
4. A Edge Function `approve-access-request` valida o JWT e o papel do chamador.
5. A função convida o usuário usando a chave administrativa disponível somente no ambiente Supabase e ativa o perfil/papel aprovado.
6. Um cliente precisa ser vinculado a um estabelecimento; RLS limita a leitura a esse vínculo.

Papéis canônicos: `admin`, `consultor`, `rt`, `colaborador` e `cliente`. Perfis `pendente` ou `suspenso` são recusados pelo frontend e pelo banco.

Também desabilite **Allow new users to sign up** em Supabase Dashboard → Authentication → Sign In / Providers → Email. A migration mantém novos perfis bloqueados mesmo antes dessa configuração, mas desabilitar o signup elimina a superfície pública no Auth.

## Banco e deploy da função

As migrations versionadas estão em `supabase/migrations/20260805181345_production_hardening.sql` e `supabase/migrations/20260805183727_advisor_remediation.sql`. Antes de aplicar em outro ambiente, faça um backup lógico pelo painel ou CLI do Supabase.

```bash
supabase link --project-ref kdlyjcaxopypqeitazan
supabase db push
supabase functions deploy approve-access-request
```

Segredos/variáveis da função:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente do Supabase.
- `ALLOWED_ORIGINS` e `INVITE_REDIRECT_URL` podem ser configurados conforme `.env.example`.
- `ADMIN_APPROVAL_EMAIL` ficou reservado para uma futura integração de e-mail; nenhum endereço foi inventado.

## Desenvolvimento e testes

Não há etapa de compilação nem dependências de runtime locais. Use Node.js 20 ou superior:

```bash
npm test
npx serve .
```

O build do Netlify executa `npm test` antes de publicar. O arquivo `netlify.toml` também configura redirects, cache, `noindex` das páginas internas e cabeçalhos de segurança.

## Operação

- Empresas são arquivadas/restauradas; não são apagadas pela interface.
- Dashboard, filtros e contagens usam dados reais permitidos por RLS.
- Emissão registra checksum SHA-256 e uma linha em `documento_versoes` dentro da mesma transação.
- “Aprovação interna” é controle operacional e não é apresentada como assinatura ICP-Brasil.
- “Imprimir / salvar PDF” usa o diálogo nativo do navegador.
- A IA permanece identificada como “em desenvolvimento”; não há chave ou resposta simulada.

## Rollback

Rollback de aplicação: reverta o commit/PR e deixe o Netlify republicar o último commit estável. Não use `git reset --hard` em trabalho compartilhado.

Rollback de banco deve ser planejado a partir do backup. Como a migration é aditiva e normaliza dados existentes, a opção segura é manter colunas/tabelas novas e reverter somente políticas, grants e funções por uma nova migration revisada. Não remova `access_requests`, `status`, versões ou vínculos sem exportar os dados. Para uma emergência de autenticação, mantenha o signup desabilitado, restaure as políticas anteriores a partir do histórico de migrations e valide com os advisors do Supabase antes de reabrir o acesso.
