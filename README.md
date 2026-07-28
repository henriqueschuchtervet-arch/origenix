# ORIGENIX

Plataforma de gestão regulatória, sanitária e documental para consultorias e estabelecimentos de produtos de origem animal.

## Estado atual

O sistema é composto por quatro páginas HTML estáticas integradas ao Supabase:

- `index.html`
- `origenix-dashboard-v3.html`
- `origenix-sistema-login.html`
- `origenix-emissao-v3.html`

A Sprint 1 estabelece autenticação, recuperação de senha, papéis, RLS e documentação. A modularização será realizada na Sprint 2.

## Serviços

- Frontend e hospedagem: Netlify
- Banco, autenticação e futura área de arquivos: Supabase
- Código e revisão: GitHub

## Configuração pública

O frontend utiliza:

- URL pública do projeto Supabase;
- chave publicável `sb_publishable_*`.

Nunca adicionar ao frontend:

- secret key;
- service role key;
- senha de banco;
- tokens administrativos.

## Recuperação de senha

Fluxo previsto:

1. Usuário informa o e-mail.
2. O frontend chama `resetPasswordForEmail`.
3. O Supabase envia o link de recuperação.
4. O usuário retorna para a página configurada.
5. Ao receber `PASSWORD_RECOVERY`, o frontend solicita a nova senha.
6. A senha é atualizada com `updateUser`.

O endereço de produção deve ser autorizado nas configurações de URL do Supabase Auth.

## Banco e migrations

As migrations ficam em `supabase/migrations`.

Antes de aplicar:

1. revisar o SQL;
2. confirmar backup;
3. verificar vínculos existentes;
4. executar em janela controlada;
5. testar o administrador;
6. executar Security e Performance Advisors.

## Regras de segurança

- RLS obrigatória em tabelas expostas.
- Menor privilégio para `anon` e `authenticated`.
- Autorização baseada em `auth.uid()` e associações do banco.
- Nenhuma autorização baseada em `user_metadata`.
- Nenhuma senha armazenada em tabelas públicas.
- Mudanças destrutivas exigem migration separada e rollback documentado.

## Roadmap

- Sprint 1: segurança, autenticação, papéis e documentação.
- Sprint 2: modularização, desempenho e dashboard.
- Sprint 3: emissão, PDFs, versionamento e numeração.
- Sprint 4: auditorias, tarefas, agenda e documentos técnicos.
- Sprint 5: IA, OCR, uploads e relatórios inteligentes.

