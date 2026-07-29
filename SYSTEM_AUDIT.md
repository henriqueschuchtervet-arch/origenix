# ORIGENIX — Registro técnico V4

Data: 29 de julho de 2026  
Branch: `agent/sprint-1-foundation`

## Escopo deste lote

Este lote introduz uma camada visual e comportamental compartilhada sobre a
arquitetura HTML existente. Não troca tecnologias, não altera tabelas, não
modifica dados e mantém a integração atual com Supabase, GitHub e Netlify.

## Alterações

- Design tokens compartilhados para cor, foco, sombra, movimento e estados.
- Estados consistentes de hover, active, focus-visible e disabled.
- API compartilhada para loading de botões.
- Feedback tátil visual por ripple, respeitando preferência de movimento reduzido.
- Navegação por teclado no menu rápido.
- Breadcrumbs contextuais.
- Link para pular ao conteúdo principal.
- Identificação da rota ativa.
- Aviso de conectividade offline/online.
- MutationObserver restrito e agrupado por frame, eliminando a execução completa
  da camada de melhoria após cada mutação do DOM.

## Compatibilidade e risco

- O CSS utiliza seletores progressivos e preserva os estilos locais existentes.
- A camada compartilhada é carregada pelo `ui-enhancements.js`, já presente nas
  páginas integradas.
- Não há alteração de schema, RLS, autenticação ou consultas.
- Impressão oculta os elementos auxiliares de navegação.
- Animações são praticamente desativadas quando o sistema operacional solicita
  redução de movimento.

## Validações executadas

- Sintaxe JavaScript validada com `node --check`.
- Balanceamento estrutural do CSS conferido.
- Ausência de segredos ou chaves privadas nos arquivos adicionados.
- Nenhuma migration ou mutação de banco neste lote.

## Próximo lote recomendado

- Extrair componentes e serviços dos HTMLs monolíticos de forma incremental.
- Adicionar testes automatizados de navegação, autenticação e permissões.
- Fixar a versão do cliente Supabase carregado pelo CDN.

## Evolução do lote — diálogos operacionais

- `prompt` e `confirm` foram removidos dos fluxos de registros e não
  conformidades dos PACs.
- O novo diálogo compartilhado possui foco inicial, contenção de foco,
  fechamento por `Esc`, validação nativa, mensagem de erro, cancelamento e
  restauração do foco anterior.
- O registro de monitoramento agora coleta descrição e resultado numa única
  operação, reduzindo cliques e ambiguidades.
- Os assets compartilhados usados pelos PACs possuem versão de cache explícita,
  impedindo incompatibilidade temporária entre HTML, JavaScript e CSS após deploy.

## Correção emergencial — navegação e desempenho percebido

- O dashboard recebeu cinco ações rápidas operacionais e responsivas.
- Itens antigos da sidebar agora possuem comportamento, foco e feedback de
  navegação explícitos.
- O observador de interface deixou de executar em toda mutação do DOM e passa a
  reagir somente quando botões ou campos de senha são adicionados.
- Permanece planejada a extração das imagens Base64 repetidas, principal custo de
  transferência e análise inicial dos HTMLs monolíticos.

## Dashboard executivo — consultas

- Contadores utilizam `count: exact` e não dependem mais do tamanho das listas.
- Tabelas recentes carregam somente oito registros e apenas as colunas exibidas.
- Leads são consultados exclusivamente para administradores.
- Perfis sem acesso administrativo recebem estado explícito em vez de números
  enganosos.
- Foram eliminadas consultas `select('*')` no carregamento do dashboard.

## Gestão enterprise de estabelecimentos

- A listagem ganhou pesquisa instantânea por nome, CNPJ, município, responsável
  técnico e tipo de estabelecimento.
- Foram adicionados filtros de ativos, arquivados e todos, com estado visual
  explícito.
- O cadastro passou a oferecer edição no mesmo fluxo, cancelamento seguro,
  loading e mensagens de sucesso ou erro.
- A exclusão física foi substituída por arquivamento reversível, evitando perda
  acidental de histórico e documentos relacionados.
- A consulta deixou de usar `select('*')`, solicita somente os campos necessários
  e limita o lote inicial a 250 registros.
- A emissão documental e o versionamento atômico existentes foram preservados.

### Banco e compatibilidade

- A migration `011_empresas_arquivamento.sql` adiciona `ativo` e `arquivado_em`
  sem remover ou transformar dados existentes.
- O índice `idx_empresas_ativo_criado_em` prepara a listagem por situação e
  data de criação.
- A migration foi aplicada no projeto Supabase e validada por consulta ao
  catálogo do PostgreSQL.

### Validações deste ciclo

- JavaScript inline validado por parser, sem erro de sintaxe.
- Presença das rotinas de numeração automática e versionamento confirmada.
- Ausência de exclusão física no fluxo de estabelecimentos confirmada.
- Página publicada carregada no deploy de preview da Netlify.
- Advisors de segurança e desempenho do Supabase executados após o DDL.

### Riscos acompanhados

- A proteção contra senhas vazadas permanece desabilitada no Supabase Auth.
- A tabela legada `usuarios` possui RLS habilitado sem policy; o modelo ativo de
  autorização utiliza `profiles` e `empresa_membros`, portanto a correção exige
  confirmar primeiro se a tabela ainda possui consumidores.
- Índices recém-criados aparecem como não utilizados até haver tráfego suficiente;
  não devem ser removidos com base nesse aviso inicial.

## Escala da listagem de estabelecimentos

- A listagem deixou de carregar um lote fixo de 250 registros e passou a usar
  paginação real no Supabase, com 20 itens por página.
- A pesquisa por nome, CNPJ, município, responsável técnico e tipo de
  estabelecimento agora é executada no servidor.
- A entrada de pesquisa possui debounce de 320 ms, evitando uma consulta a cada
  tecla digitada.
- Respostas antigas são ignoradas por um identificador sequencial, impedindo que
  uma busca lenta sobrescreva resultados mais recentes.
- A interface informa o intervalo exibido, o total de resultados e a página
  atual, com botões anterior/próxima acessíveis e responsivos.
- A emissão documental reutiliza o estabelecimento já carregado e só consulta um
  registro individual quando necessário, evitando recarregar a listagem.

### Validações deste ciclo

- JavaScript inline analisado sem erros de sintaxe.
- Paginação, `count: exact`, busca remota, debounce e tratamento de corrida
  confirmados no código publicado.
- Numeração automática, versionamento documental e arquivamento reversível
  preservados.
- Novo SHA do arquivo confirmado na branch de trabalho.
- Tela de autenticação carregada com sucesso no deploy de preview da Netlify.

## Bloqueio da tabela legada de usuários

- A tabela `public.usuarios` foi confirmada vazia, sem policies e sem grants para
  `anon` ou `authenticated`.
- Nenhum consumidor da tabela foi encontrado no frontend; a identidade ativa usa
  `auth.users`, `profiles` e `empresa_membros`.
- A migration `012_usuarios_legacy_lockdown.sql` mantém a tabela por
  compatibilidade, revoga privilégios e adiciona uma policy restritiva que nega
  leitura e escrita.
- A coluna legada `senha` foi documentada como proibida para autenticação; nenhuma
  senha deve ser armazenada fora do Supabase Auth.

### Validações deste ciclo

- Migration aplicada com sucesso no Supabase.
- Policy `usuarios_legacy_deny_all` confirmada como `RESTRICTIVE`, para todas as
  operações, com `USING (false)` e `WITH CHECK (false)`.
- Security Advisor executado após o DDL: o alerta de RLS sem policy foi eliminado.
- Permanece apenas o aviso de proteção contra senhas vazadas, uma configuração
  administrativa do Supabase Auth.

## Visão 360° do estabelecimento

- Cada linha da gestão ganhou a ação `Ver detalhes`, que abre um painel lateral
  sem retirar o usuário do contexto da listagem.
- O painel consolida dados cadastrais, responsável técnico, inspeção, capacidade
  e área construída.
- Quatro consultas leves exibem as contagens de documentos, PACs, tarefas e
  auditorias, sempre filtradas por `empresa_id` e protegidas pelas RLS existentes.
- Os cinco documentos mais recentes são exibidos com código, versão e status.
- Ações de edição, emissão e acesso aos PACs permanecem disponíveis no próprio
  painel conforme o papel do usuário.
- O painel possui diálogo semântico, fechamento por `Esc`, clique no fundo,
  restauração de foco e adaptação para telas pequenas.

### Validações deste ciclo

- JavaScript inline analisado sem erros de sintaxe.
- Paginação, numeração automática, versionamento e arquivamento preservados.
- Novo arquivo publicado e SHA confirmado na branch.
- Deploy Preview da Netlify concluído com sucesso para o commit da visão 360°.

## Prontidão do pull request

- A branch foi comparada com `main`: está 53 commits à frente e zero atrás.
- Não há conflito de conteúdo; o bloqueio de merge era o estado de rascunho.
- As três verificações da Netlify foram concluídas sem falhas.
- Título, descrição, implantação e checklist do PR foram atualizados para refletir
  o estado real do sistema.
- O PR permanece como rascunho até haver evidência dos testes autenticados para
  Administrador, RT, Cliente e Consultor.

## Navegação contextual para PACs

- A ação `Abrir PACs` da visão 360° envia o identificador do estabelecimento na
  URL.
- A página de PACs valida esse identificador contra as empresas permitidas pela
  RLS antes de selecioná-lo.
- A troca manual de estabelecimento atualiza a URL sem recarregar a página,
  permitindo favoritos, retorno do navegador e compartilhamento do contexto.
- Parâmetros inválidos ou referentes a empresas sem acesso são ignorados.

### Validações deste ciclo

- JavaScript analisado sem erros de sintaxe.
- Leitura do parâmetro, validação na lista autorizada e atualização de URL
  confirmadas no arquivo publicado.

## Contratos automatizados e CI

- Foi criada uma suíte Node.js sem dependências externas para validar 13 contratos
  críticos da plataforma.
- A suíte analisa sintaxe do JavaScript compartilhado e de todos os scripts inline.
- Recuperação de senha, numeração, versionamento, arquivamento reversível,
  paginação, visão 360°, contexto dos PACs, acessibilidade, sequência de migrations,
  papéis e bloqueio da tabela legada possuem verificações explícitas.
- O workflow `Enterprise contracts` executa em pushes da branch e em pull requests,
  com permissão somente de leitura, timeout de cinco minutos e cancelamento de
  execuções obsoletas.
- A primeira execução encontrou um contrato impreciso, corrigido para validar
  `:focus-visible` no CSS compartilhado.
- A execução final aprovou 13 de 13 contratos em oito segundos, sem aviso de
  runtime obsoleto.

## Cabeçalhos de segurança da hospedagem

- O arquivo `_headers` versiona a política aplicada pela Netlify em todas as
  páginas.
- A Content Security Policy limita scripts, estilos, fontes, imagens e conexões
  às origens necessárias para a aplicação e o Supabase.
- `frame-ancestors 'none'` e `X-Frame-Options: DENY` reduzem risco de clickjacking.
- MIME sniffing, vazamento de referência, APIs sensíveis do navegador e abertura
  de contexto entre origens foram restringidos.
- HSTS é aplicado por um ano, incluindo subdomínios.
- HTML permanece sem cache persistente; JavaScript e CSS compartilhados possuem
  revalidação horária.
- O contrato automatizado passou a cobrir os cabeçalhos: 14 de 14 contratos
  aprovados.
- A verificação `Header rules` da Netlify foi concluída com sucesso e o preview
  foi publicado.

## Controles e atalhos operacionais

- Os seis módulos HTML foram auditados cruzando botões, links, identificadores e
  handlers JavaScript.
- Nenhum botão morto foi encontrado; o sino do dashboard é conectado pela camada
  compartilhada e deixou de ser tratado como falso positivo.
- Links internos com fragmento são validados contra o `id` de destino.
- Links `javascript:` e links `#` sem ação agora quebram o CI.
- O contrato automatizado passou a impedir a introdução de controles sem
  comportamento real.

### Correção de fluxo

- `Novo cadastro`, `Clientes` e `Documentos` deixaram de abrir a mesma tela
  genérica.
- Cada atalho agora transmite a intenção por `view=new`, `view=clients` ou
  `view=documents`.
- A área autenticada interpreta a rota, abre a aba correta e, no fluxo documental,
  orienta o usuário a selecionar o estabelecimento.
- O acesso direto ao sistema abre a lista de clientes por padrão; o formulário de
  cadastro é aberto somente quando solicitado.
- O CI final aprovou 16 de 16 contratos em quatro segundos e o deploy da Netlify
  foi concluído com sucesso.

## Biblioteca documental enterprise

- O sistema ganhou uma terceira área operacional dedicada a documentos.
- A biblioteca consulta apenas os campos necessários e usa paginação server-side
  de 20 registros.
- Pesquisa por título, tipo e código possui debounce e proteção contra respostas
  fora de ordem.
- Filtros de status cobrem documentos gerados, em revisão, assinados e arquivados.
- Cada linha apresenta estabelecimento, código, versão, data e status.
- O usuário pode copiar o código, abrir a visão 360° da empresa ou acessar a
  Central de Assinaturas.
- A relação `documentos_empresa_id_fkey` foi confirmada antes de usar a seleção
  relacional `empresas(nome)`.
- O atalho `Documentos` passa a abrir a biblioteca real, em vez de redirecionar
  para a lista de clientes.

### Validações deste ciclo

- JavaScript inline analisado sem erros de sintaxe.
- Numeração, versionamento, paginação de empresas, arquivamento e visão 360°
  preservados.
- O CI aprovou 17 de 17 contratos em quatro segundos.
- O deploy da Netlify foi concluído com sucesso.
