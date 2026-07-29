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

- Substituir `prompt` e `confirm` nativos por diálogos acessíveis.
- Extrair componentes e serviços dos HTMLs monolíticos de forma incremental.
- Adicionar testes automatizados de navegação, autenticação e permissões.
- Fixar a versão do cliente Supabase carregado pelo CDN.
