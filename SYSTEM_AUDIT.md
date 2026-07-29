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

## Dossiê e histórico documental

- Cada documento da biblioteca ganhou a ação `Abrir dossiê`.

## Ciclo 13 — anexos documentais privados

- Criado o bucket privado `documentos`, limitado a 10 MB e aos formatos documentais aprovados.
- O caminho de cada objeto começa pelo UUID do documento, permitindo que as políticas de Storage reutilizem o mesmo controle de acesso do dossiê.
- Leitura, envio e exclusão foram protegidos por políticas RLS; gravações exigem perfil Administrador, RT ou Consultor.
- O dossiê agora envia anexos com estado de carregamento, valida tamanho e formato antes do tráfego e exibe mensagens claras de sucesso ou erro.
- Downloads usam links assinados com validade de cinco minutos. URLs HTTPS legadas permanecem compatíveis.
- Se o registro do anexo falhar depois do upload, o objeto é removido automaticamente para impedir arquivos órfãos.
- A suíte passou a cobrir 20 contratos de segurança, navegação e operação.

### Verificações

- Bucket confirmado como privado, com limite de `10485760` bytes.
- Políticas `documentos_storage_select`, `documentos_storage_insert` e `documentos_storage_delete` confirmadas no banco.
- GitHub Actions aprovado após a publicação.
- Prévia do Netlify respondeu normalmente na rota da biblioteca documental.
- Advisor de segurança: nenhum alerta novo introduzido; permanece apenas a proteção contra senhas vazadas, dependente de configuração do plano.
- Advisor de desempenho: somente índices ainda não utilizados, classificados como informativos.

## Ciclo 14 — exclusão auditada e privilégio mínimo

- Anexos podem ser excluídos pelo dossiê somente após confirmação explícita.
- A interface informa o caráter permanente da ação, exibe carregamento no botão e restaura o estado em caso de erro.
- Administrador, RT e Consultor podem incluir ou excluir anexos; Cliente permanece somente leitura.
- A RPC `excluir_anexo_auditado` remove o registro e grava `ANEXO_EXCLUIDO` com usuário, empresa, documento, nome e caminho do objeto.
- A RPC executa como `SECURITY INVOKER`, preservando as RLS e os privilégios do usuário como segunda barreira.
- A trilha de auditoria tornou-se append-only: o papel autenticado possui exclusivamente `SELECT` e `INSERT`.
- A exclusão valida que o caminho privado pertence ao documento e rejeita segmentos suspeitos antes de acessar o Storage.

### Verificações

- Banco confirmou apenas políticas `SELECT` e `INSERT` na auditoria.
- Banco confirmou exclusivamente privilégios `SELECT` e `INSERT` para o papel autenticado.
- RPC confirmada como `SECURITY INVOKER`.
- Advisor de segurança voltou ao estado anterior, sem alerta introduzido por esta entrega.
- GitHub Actions aprovou 22 contratos de segurança e operação.

## Ciclo 15 — Central de Auditoria

- Adicionada uma área somente leitura na navegação principal para consultar eventos operacionais.
- A central possui pesquisa com debounce, filtros por empresa, ação e período, paginação no servidor e resumo dos resultados.
- Eventos exibem ação, detalhes relevantes, estabelecimento, ator e data sem expor dados sensíveis.
- O menu lateral passou a aceitar navegação por teclado em todas as áreas.
- A rota `?view=audit` abre diretamente a Central de Auditoria após a autenticação.
- A consulta usa campos explícitos, limite de 25 registros por página e proteção contra respostas obsoletas.
- Foram criados índices compostos para ordenação cronológica e filtros por empresa e ação.

### Integridade corrigida

- A chave `auditorias.usuario_id` deixou de apontar para a tabela legada vazia e agora referencia `auth.users(id)`.
- O cliente perdeu também o privilégio de inserir eventos: possui exclusivamente `SELECT`.
- Exclusões de anexos geram eventos por gatilho interno do banco, impedindo fabricação de registros pela aplicação.
- A RPC de exclusão continua como `SECURITY INVOKER` e a função de gatilho não pode ser executada diretamente.

### Verificações

- Supabase confirmou somente a policy `auditorias_select`.
- Supabase confirmou exclusivamente o privilégio `SELECT` para `authenticated`.
- Chave estrangeira confirmada contra `auth.users(id) ON DELETE SET NULL`.
- Gatilho `auditar_exclusao_anexo` e cinco índices de auditoria confirmados.
- Advisor de segurança sem novos alertas; permanece apenas a proteção opcional contra senhas vazadas.
- GitHub Actions aprovou 24 contratos automatizados.

## Ciclo 16 — cobertura automática das operações principais

- A criação, atualização, arquivamento e restauração de empresas agora geram eventos internos.
- A emissão e a mudança de status de documentos também passam a compor a trilha.
- Alterações de empresa registram apenas nomes de campos relevantes, evitando duplicação de dados pessoais.
- Eventos documentais registram código, tipo, versão e transição de status.
- Os novos eventos foram adicionados aos filtros e às descrições amigáveis da Central de Auditoria.
- As funções de gatilho não possuem permissão de execução para usuários autenticados.

### Verificações

- Três gatilhos ativos confirmados: exclusão de anexos, operações de empresas e operações de documentos.
- Supabase confirmou `authenticated_execute = false` nas três funções internas.
- Advisor de segurança permaneceu sem novos alertas.
- GitHub Actions aprovou 25 contratos automatizados.

## Ciclo 17 — exportação segura da auditoria

- A Central ganhou exportação CSV dos filtros atualmente aplicados.
- A geração é limitada aos 2.000 eventos mais recentes para proteger navegador, banco e rede.
- Todas as células neutralizam prefixos interpretados como fórmulas por Excel e aplicativos compatíveis.
- O arquivo utiliza BOM UTF-8, separador compatível com o locale brasileiro e descarte imediato da URL temporária.
- O botão apresenta loading, sucesso, limite atingido e erros de forma explícita.
- O download só é liberado depois que a exportação é registrada no banco.

### Rastreabilidade

- Criada a tabela append-only `auditoria_exportacoes`.
- O usuário pode inserir apenas registros em seu próprio nome e dentro das empresas acessíveis.
- Somente o próprio usuário ou Administrador consulta os registros de exportação.
- Um gatilho interno gera o evento `AUDITORIA_EXPORTADA`; sua função não pode ser executada pelo cliente.
- Exportações globais são visíveis apenas ao autor e a Administradores.

### Verificações

- Policies `SELECT` e `INSERT` confirmadas na tabela de exportações.
- Privilégios limitados a `SELECT` e `INSERT`; não há atualização, exclusão ou truncamento.
- Função interna confirmada sem permissão de execução para `authenticated`.
- Advisor de segurança permaneceu sem novos alertas.
- GitHub Actions aprovou 26 contratos automatizados.

## Ciclo 18 — Central de Notificações operacionais

- Adicionado um sino no cabeçalho e uma área dedicada na navegação principal.
- O badge apresenta a quantidade real de notificações não lidas.
- A central deriva alertas de tarefas abertas, prioridades, prazos e documentos pendentes.
- Tarefas vencidas ou críticas recebem destaque crítico; prazos próximos e documentos em revisão recebem atenção.
- Documentos gerados há mais de sete dias sem formalização também aparecem como acompanhamento.
- Pesquisa e filtros por tipo e estado de leitura funcionam sem novas consultas ao banco.
- Cada notificação conduz ao estabelecimento ou dossiê correspondente.
- A rota `?view=notifications` abre diretamente a central após autenticação.

### Persistência e isolamento

- Tarefas ganharam prioridade, prazo, conclusão e atualização com índices apropriados.
- Leituras persistem em `notificacao_leituras`, isoladas por `auth.uid()`.
- O usuário pode consultar, incluir e atualizar apenas os próprios recibos.
- Não há permissão para excluir ou truncar os registros de leitura.
- Consultas de tarefas e documentos continuam submetidas às RLS originais.

### Verificações

- Novas colunas e índices confirmados no Supabase.
- Policies `SELECT`, `INSERT` e `UPDATE` confirmadas para recibos de leitura.
- Privilégios limitados exatamente às três operações necessárias.
- Advisor de segurança permaneceu sem novos alertas.
- GitHub Actions aprovou 28 contratos automatizados.

## Ciclo 19 — Gestão de Tarefas & Agenda

- Adicionada uma área operacional para criar, editar, concluir e excluir tarefas.
- Cada tarefa possui estabelecimento, descrição, prioridade, prazo, status e responsável.
- A lista utiliza busca com debounce, filtros e paginação de 25 registros no servidor.
- A visualização Agenda organiza tarefas por dia e permite navegar entre meses.
- Indicadores mostram tarefas abertas, vencidas, previstas para hoje e concluídas.
- Conclusões atualizam imediatamente as notificações e os indicadores.
- Exclusões exigem confirmação e estão disponíveis apenas para Administradores.
- A rota `?view=tasks` abre diretamente a gestão após autenticação.

### Identidade, autorização e auditoria

- `tarefas.responsavel` deixou a tabela legada e passou a referenciar `auth.users(id)`.
- Administrador, RT e Consultor podem incluir e atualizar tarefas de empresas acessíveis.
- Cliente permanece somente leitura.
- Responsáveis são limitados ao próprio usuário, exceto para Administradores.
- Status e prioridade possuem constraints explícitas no banco.
- Gatilhos controlam atualização, conclusão e eventos `TAREFA_CRIADA`, `TAREFA_ATUALIZADA`, `TAREFA_CONCLUIDA` e `TAREFA_EXCLUIDA`.
- As funções internas dos gatilhos não podem ser executadas diretamente.

### Componente compartilhado

- Diálogos de edição agora preservam corretamente valores selecionados e conteúdo de campos multilinha.

### Verificações

- Chave estrangeira confirmada contra `auth.users(id) ON DELETE SET NULL`.
- Quatro policies e dois gatilhos confirmados diretamente no Supabase.
- Funções internas confirmadas sem permissão de execução para `authenticated`.
- Advisor de segurança permaneceu sem novos alertas.
- GitHub Actions aprovou 31 contratos automatizados.

## Ciclo 20 — Dashboard executivo operacional

- Indicadores de leads foram substituídos por tarefas vencidas e documentos em revisão.
- Os KPIs críticos são clicáveis e levam diretamente ao fluxo correspondente.
- Adicionada agenda dos próximos sete dias com prazo, empresa e destaque de criticidade.
- Adicionado painel consolidado de tarefas vencidas e documentos aguardando revisão.
- O sino superior abre a Central de Notificações e desaparece quando não há alertas.
- Contadores laterais exibem clientes, tarefas e alertas acessíveis ao usuário.
- Atalhos rápidos incluem Tarefas e Notificações.

### Navegação corrigida

- Todos os itens da barra lateral passaram a ser links reais.
- Itens provisórios sem módulo funcional foram removidos: Projetos genéricos, Licenças, Faturamento, IA Interna e Configurações.
- Permanecem apenas Dashboard, Clientes, Documentos, Emissão, Tarefas, Notificações, Auditoria e PACs/APPCC.

### Desempenho

- Contagens e listas são obtidas pelas mesmas consultas paginadas, evitando chamadas duplicadas.
- Agenda, vencimentos e revisões usam consultas limitadas e filtros executados pelo banco.
- Dados continuam isolados pelas RLS das tabelas de origem.

### Verificações

- JavaScript validado sem erros de sintaxe.
- GitHub Actions aprovou 32 contratos automatizados.
- Prévia do dashboard respondeu no Netlify.
- Nenhum item de navegação inerte permaneceu no HTML publicado.
- O painel consolida código, UUID, SHA-256, status, empresa, tipo, versão atual e
  data de emissão.
- A linha do tempo carrega todas as versões permitidas pela RLS, ordenadas da mais
  recente para a mais antiga.
- Cada versão apresenta número, código, status, data e hash de integridade.
- Anexos relacionados são listados com nome e data.
- URLs de anexos são analisadas pelo navegador e somente endereços HTTPS recebem
  link clicável.
- Código e hash podem ser copiados com feedback visual.
- O painel possui fechamento por `Esc`, clique no fundo e restauração do foco.

### Segurança e validações

- As policies de leitura de `documento_versoes` e `anexos` foram verificadas antes
  da implementação.
- As consultas usam campos explícitos e filtro obrigatório por `documento_id`.
- JavaScript inline analisado sem erros de sintaxe.
- O CI aprovou 18 de 18 contratos em oito segundos.
- O deploy da Netlify foi concluído com sucesso.


## Ciclo 21 — consistência visual e autenticação

### Problema identificado

- A camada compartilhada procurava o primeiro botão com o texto `Entrar`.
- Nas páginas com abas de autenticação, a aba `Entrar` era confundida com o botão principal do formulário.
- Isso inseria recuperação de senha e retorno ao site no meio das abas.
- O dashboard não carregava a superfície visual do painel antes da camada de melhorias, provocando inconsistência e sensação de lentidão.

### Correções implementadas

- O botão de autenticação passou a ser localizado prioritariamente pelo identificador estável `#btnAuth`.
- A busca alternativa ignora explicitamente elementos `.login-tab`.
- O design system compartilhado passou a ser carregado no `head` das duas páginas.
- A superfície `.panel` e o cartão de login do dashboard receberam acabamento consistente com o restante do produto.
- O JavaScript compartilhado recebeu versionamento `v4.4` para invalidar caches antigos.

### Verificações

- Login do dashboard validado visualmente no preview da Netlify.
- Login do sistema validado no DOM publicado: ações aparecem imediatamente depois de `#btnAuth` e as abas permanecem consecutivas.
- O preview publicou `ui-enhancements.js?v=4.4`.
- GitHub Actions concluiu com sucesso os 33 contratos enterprise.

## Ciclo 22 — assets compartilhados e redução de peso

### Diagnóstico

- Quatro páginas continham imagens PNG codificadas em Base64 dentro do próprio HTML.
- A mesma marca de 217.600 caracteres aparecia quatro vezes.
- A assinatura de 143.992 caracteres aparecia duas vezes.
- O HTML precisava baixar, analisar e decodificar essas cópias a cada navegação.

### Implementação

- As duas imagens foram extraídas para `assets/origenix-logo-v1.svg` e `assets/origenix-brand-v1.svg`.
- Página inicial, dashboard, emissão e sistema passaram a reutilizar os mesmos assets.
- Os nomes são versionados para permitir cache imutável sem impedir futuras atualizações.
- A Netlify recebeu política de cache de um ano para `/assets/*`.
- Um contrato automatizado impede o retorno de imagens Base64 nessas páginas.

### Resultado mensurável

- Peso conjunto dos quatro HTMLs: de 1.581.974 para 206.026 caracteres.
- Redução de 1.375.948 caracteres, aproximadamente 87% do conteúdo HTML.
- Todas as cinco referências visuais reutilizam apenas dois arquivos cacheáveis.
- O código visual e os fluxos de autenticação foram preservados.

### Verificações

- 34 contratos enterprise aprovados no GitHub Actions.
- Nenhuma ocorrência de `data:image/` permaneceu nas quatro páginas.
- Assets carregaram no preview da Netlify com dimensões válidas.
- Login do dashboard e do sistema continuou com ações abaixo de `#btnAuth`.

## Ciclo 23 — configuração Supabase modular

### Diagnóstico

- Seis páginas repetiam a mesma URL, chave publicável e inicialização do cliente Supabase.
- Mudanças de projeto ou rotação da chave exigiriam alterações em seis pontos.
- As páginas não compartilhavam uma validação única para indisponibilidade da biblioteca.

### Implementação

- Criado `origenix-supabase.js` como fonte única da configuração pública.
- O módulo valida a presença da fábrica Supabase antes de criar cada cliente.
- A API compartilhada é imutável por meio de `Object.freeze`.
- Cada página continua criando seu próprio cliente, preservando isolamento de sessão e comportamento.
- Página inicial, dashboard, emissão, sistema, PACs e recuperação de senha foram integrados.
- O módulo recebeu política explícita de cache com revalidação.

### Segurança e manutenção

- URL e chave publicável foram removidas de todos os HTMLs.
- Nenhuma service role ou credencial privada foi introduzida.
- RLS, policies, tabelas, dados e chamadas de autenticação não foram alterados.
- Um contrato impede que páginas voltem a inicializar o cliente diretamente.

### Verificações

- 35 contratos enterprise aprovados no GitHub Actions.
- As seis páginas carregaram `origenix-supabase.js?v=1.0` no preview da Netlify.
- Página inicial abriu o diagnóstico normalmente.
- Dashboard e sistema alternaram entre Entrar e Criar Conta.
- Recuperação de senha permaneceu disponível.
- Tela de emissão manteve o fluxo de autenticação.

## Ciclo 24 — serviço compartilhado de autenticação

### Diagnóstico

- Dashboard, emissão e sistema repetiam validação de credenciais, mensagens, login, cadastro, sessão e logout.
- As regras específicas de interface representavam apenas uma pequena parte de cada fluxo.

### Implementação

- Criado `origenix-auth.js` com validação, normalização de e-mail, mensagens e operações Auth.
- Login e cadastro compartilham tratamento de indisponibilidade, rede e erros do Supabase.
- A observação da sessão mantém `setTimeout` no callback para evitar trabalho assíncrono dentro do evento Auth.
- Cada página preserva seus callbacks `onAuthenticated`, painéis, permissões e carregamentos próprios.
- O dashboard preserva o redirecionamento de confirmação de e-mail.
- Logout utiliza uma operação compartilhada com retorno explícito de erro.

### Garantias de regressão

- O contrato exige o serviço compartilhado e proíbe chamadas Auth duplicadas nas três páginas.
- Uma substituição inicial removeu acidentalmente rotas após um logout compacto.
- Os contratos identificaram imediatamente a ausência das rotas de tarefas, auditoria e notificações.
- O sistema foi restaurado a partir do ciclo anterior e a transformação foi refeita com análise segura de blocos.

### Verificações

- 36 contratos enterprise aprovados no GitHub Actions.
- Rotas iniciais, tarefas, auditoria e notificações permanecem no sistema.
- Dashboard, sistema e emissão exibiram mensagens corretas para credenciais inválidas.
- O foco foi direcionado ao campo com erro.
- Botões retornaram ao estado habilitado e ao texto original.
- Nenhuma conta ou sessão real foi criada durante os testes.

## Ciclo 25 — dependência Supabase determinística

### Diagnóstico

- As seis páginas carregavam `@supabase/supabase-js@2`, uma referência flutuante.
- Uma nova versão compatível com o major poderia ser entregue sem revisão do projeto.

### Implementação

- Confirmada a release estável `2.111.0`, publicada em 28 de julho de 2026.
- As seis páginas passaram a carregar o bundle exato `dist/umd/supabase.js`.
- A tag registra a versão em `data-supabase-version`.
- A requisição usa `crossorigin="anonymous"` e `referrerpolicy="no-referrer"`.
- Um contrato automatizado proíbe o retorno da referência flutuante `@2`.
- O README documenta o procedimento de atualização da dependência.

### Integridade e proveniência

- A release oficial é imutável e assinada no GitHub.
- O registro npm publica integridade do tarball e atestação de proveniência.
- O hash do tarball não foi usado como SRI do bundle UMD, pois são arquivos diferentes.
- SRI somente deverá ser aplicado após hash do bundle exato ou vendorização no domínio próprio.

### Verificações

- 37 contratos enterprise aprovados no GitHub Actions.
- O preview carregou `2.111.0` com os atributos esperados.
- Autenticação continuou validando mensagem, foco e botão.
- Recuperação de senha permaneceu disponível.
- Formulário de diagnóstico continuou abrindo normalmente.
