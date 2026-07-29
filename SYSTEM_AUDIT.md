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
