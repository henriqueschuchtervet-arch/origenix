document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const app = window.ORIGENIX;
  const content = document.querySelector("#pageContent");
  const shell = document.querySelector("#appShell");
  const recordModal = document.querySelector("#recordModal");
  const recordForm = document.querySelector("#recordForm");
  const inviteModal = document.querySelector("#inviteModal");
  let context;
  let currentModule = "overview";
  let currentRecords = [];
  let editingId = null;
  let lookups = { empresas: [], rts: [] };
  let currentPage = 1;
  let sortState = { key: null, direction: "asc" };
  let previousFocus = null;
  const uiReview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get("ui-review") === "1";

  const roleLabel = {
    admin: "Administrador",
    consultor: "Consultor",
    rt: "Responsável técnico",
    colaborador: "Colaborador",
    cliente: "Cliente",
  };
  const operationalRoles = ["admin", "consultor", "rt", "colaborador"];

  const commonStatus = {
    ativo: "Ativo", ativa: "Ativa", inativo: "Inativo", rascunho: "Rascunho",
    emitido: "Emitido", assinado: "Assinado internamente", arquivado: "Arquivado",
    em_andamento: "Em andamento", concluido: "Concluído", pausado: "Pausado",
    planejada: "Planejada", em_execucao: "Em execução", finalizada: "Finalizada",
    pendente: "Pendente", pago: "Pago", vencido: "Vencido", cancelado: "Cancelado",
    novo: "Novo", contatado: "Contatado", convertido: "Convertido", descartado: "Descartado",
    em_analise: "Em análise", aprovado: "Aprovado", convidado: "Convidado", rejeitado: "Rejeitado",
  };

  const modules = {
    empresas: {
      title: "Estabelecimentos", singular: "estabelecimento", table: "empresas", select: "*",
      createRoles: ["admin"], editRoles: ["admin", "consultor"], search: ["nome", "cnpj", "municipio", "estado"],
      fields: [
        { name: "nome", label: "Razão social / nome", required: true, max: 200 },
        { name: "cnpj", label: "CNPJ", max: 18, cnpj: true },
        { name: "email", label: "E-mail", type: "email", max: 320 },
        { name: "telefone", label: "Telefone", max: 30 },
        { name: "municipio", label: "Município", max: 120 },
        { name: "estado", label: "UF", max: 2 },
        { name: "tipo_estabelecimento", label: "Tipo de estabelecimento", max: 120 },
        { name: "inspecao", label: "Tipo de inspeção", type: "select", options: ["SIM", "SIE", "SIF", "SISBI", "Outro"] },
        { name: "capacidade", label: "Capacidade produtiva", max: 120 },
        { name: "area", label: "Área", max: 120 },
        { name: "rt_id", label: "Responsável técnico", type: "lookup", lookup: "rts" },
      ],
      columns: [
        ["nome", "Estabelecimento"], ["cnpj", "CNPJ", (v) => app.formatCnpj(v)],
        ["municipio", "Local", (_v, r) => [r.municipio, r.estado].filter(Boolean).join(" / ") || "—"],
        ["inspecao", "Inspeção"], ["ativo", "Status", (_v, r) => statusBadge(r.ativo ? "ativo" : "arquivado")],
      ],
    },
    projetos: {
      title: "Projetos sanitários", singular: "projeto", table: "projetos", select: "*, empresas(nome), rts(nome)",
      createRoles: operationalRoles, editRoles: operationalRoles, search: ["titulo", "etapa", "status"],
      fields: [
        { name: "empresa_id", label: "Estabelecimento", type: "lookup", lookup: "empresas", required: true },
        { name: "titulo", label: "Título", required: true, max: 200 },
        { name: "etapa", label: "Etapa atual", max: 160 },
        { name: "status", label: "Status", type: "select", options: ["em_andamento", "pausado", "concluido"], default: "em_andamento" },
        { name: "progresso", label: "Progresso (%)", type: "number", min: 0, maxNumber: 100, default: 0 },
        { name: "prazo", label: "Prazo", type: "date" },
        { name: "rt_id", label: "Responsável técnico", type: "lookup", lookup: "rts" },
        { name: "observacoes", label: "Observações", type: "textarea", full: true, max: 4000 },
      ],
      columns: [
        ["titulo", "Projeto"], ["empresa_id", "Estabelecimento", (_v, r) => r.empresas?.nome || "—"],
        ["etapa", "Etapa"], ["progresso", "Progresso", (v) => `${Number(v) || 0}%`],
        ["prazo", "Prazo", (v) => app.formatDate(v)], ["status", "Status", statusBadge],
      ],
    },
    documentos: {
      title: "Documentos", singular: "documento", table: "documentos", select: "*, empresas(nome)",
      createRoles: operationalRoles, editRoles: operationalRoles, customCreate: true, search: ["titulo", "tipo", "codigo", "status"],
      fields: [],
      columns: [
        ["titulo", "Documento"], ["empresa_id", "Estabelecimento", (_v, r) => r.empresas?.nome || "—"],
        ["tipo", "Tipo / pasta"], ["versao", "Versão"], ["criado_em", "Criado em", (v) => app.formatDate(v)],
        ["status", "Status", statusBadge],
      ],
    },
    rts: {
      title: "Responsáveis técnicos", singular: "responsável técnico", table: "rts", select: "*",
      createRoles: ["admin", "consultor", "rt"], editRoles: ["admin", "consultor", "rt"], search: ["nome", "crmv", "email"],
      fields: [
        { name: "nome", label: "Nome", required: true, max: 160 },
        { name: "crmv", label: "CRMV", required: true, max: 40 },
        { name: "uf_conselho", label: "UF do conselho", max: 2 },
        { name: "telefone", label: "Telefone", max: 30 },
        { name: "email", label: "E-mail", type: "email", max: 320 },
        { name: "ativo", label: "Status", type: "boolean", default: true },
      ],
      columns: [
        ["nome", "Nome"], ["crmv", "CRMV", (_v, r) => [r.crmv, r.uf_conselho].filter(Boolean).join(" / ") || "—"],
        ["email", "E-mail"], ["telefone", "Telefone"], ["ativo", "Status", (v) => statusBadge(v ? "ativo" : "inativo")],
      ],
    },
    licencas: {
      title: "Licenças e ARTs", singular: "licença ou ART", table: "licencas", select: "*, empresas(nome)",
      createRoles: operationalRoles, editRoles: operationalRoles, search: ["tipo", "numero", "orgao", "status"],
      fields: [
        { name: "empresa_id", label: "Estabelecimento", type: "lookup", lookup: "empresas", required: true },
        { name: "tipo", label: "Tipo", required: true, max: 120 },
        { name: "numero", label: "Número", max: 120 },
        { name: "orgao", label: "Órgão", max: 120 },
        { name: "data_emissao", label: "Data de emissão", type: "date" },
        { name: "data_vencimento", label: "Data de vencimento", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["ativa", "pendente", "vencida", "cancelada"], default: "ativa" },
        { name: "anexo_url", label: "URL do anexo", type: "url", max: 1000 },
        { name: "observacoes", label: "Observações", type: "textarea", full: true, max: 4000 },
      ],
      columns: [
        ["tipo", "Tipo"], ["empresa_id", "Estabelecimento", (_v, r) => r.empresas?.nome || "—"],
        ["numero", "Número"], ["orgao", "Órgão"], ["data_vencimento", "Vencimento", dueDate],
        ["status", "Status", statusBadge],
      ],
    },
    auditorias: {
      title: "Auditorias", singular: "auditoria", table: "auditorias", select: "*, empresas(nome), rts(nome)",
      createRoles: operationalRoles, editRoles: operationalRoles, search: ["tipo", "resultado", "status"],
      fields: [
        { name: "empresa_id", label: "Estabelecimento", type: "lookup", lookup: "empresas", required: true },
        { name: "tipo", label: "Tipo", required: true, max: 120 },
        { name: "data_auditoria", label: "Data", type: "date", required: true },
        { name: "status", label: "Status", type: "select", options: ["planejada", "em_execucao", "finalizada"], default: "planejada" },
        { name: "resultado", label: "Resultado", max: 240 },
        { name: "rt_id", label: "Responsável técnico", type: "lookup", lookup: "rts" },
        { name: "observacoes", label: "Observações", type: "textarea", full: true, max: 4000 },
        { name: "nao_conformidades", label: "Não conformidades", type: "textarea", full: true, max: 4000 },
        { name: "plano_acao", label: "Plano de ação", type: "textarea", full: true, max: 4000 },
        { name: "anexo_url", label: "URL do anexo", type: "url", max: 1000 },
      ],
      columns: [
        ["tipo", "Tipo"], ["empresa_id", "Estabelecimento", (_v, r) => r.empresas?.nome || "—"],
        ["data_auditoria", "Data", (v) => app.formatDate(v)], ["resultado", "Resultado"],
        ["status", "Status", statusBadge],
      ],
    },
    leads: {
      title: "Leads", singular: "lead", table: "leads", select: "*", createRoles: [], editRoles: ["admin"],
      search: ["nome", "empresa", "email", "telefone", "status"], fields: [],
      columns: [
        ["nome", "Nome"], ["empresa", "Empresa"], ["email", "E-mail"], ["telefone", "Telefone"],
        ["origem", "Origem"], ["criado_em", "Recebido", (v) => app.formatDate(v)], ["status", "Status", statusBadge],
      ],
    },
    faturamento: {
      title: "Faturamento", singular: "lançamento", table: "faturamento", select: "*, empresas(nome)",
      createRoles: ["admin", "consultor"], editRoles: ["admin", "consultor"], search: ["descricao", "status"],
      fields: [
        { name: "empresa_id", label: "Estabelecimento", type: "lookup", lookup: "empresas", required: true },
        { name: "descricao", label: "Descrição", required: true, max: 240 },
        { name: "valor", label: "Valor", type: "number", step: ".01", min: 0, required: true },
        { name: "data_vencimento", label: "Vencimento", type: "date", required: true },
        { name: "data_pagamento", label: "Pagamento", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["pendente", "pago", "vencido", "cancelado"], default: "pendente" },
        { name: "observacoes", label: "Observações", type: "textarea", full: true, max: 4000 },
      ],
      columns: [
        ["descricao", "Descrição"], ["empresa_id", "Estabelecimento", (_v, r) => r.empresas?.nome || "—"],
        ["valor", "Valor", app.formatMoney], ["data_vencimento", "Vencimento", (v) => app.formatDate(v)],
        ["status", "Status", statusBadge],
      ],
    },
    access_requests: {
      title: "Solicitações de acesso", singular: "solicitação", table: "access_requests", select: "*, empresas(nome)",
      createRoles: [], editRoles: ["admin"], search: ["nome", "email", "empresa", "cnpj", "status"], fields: [],
      columns: [
        ["nome", "Solicitante"], ["empresa", "Empresa"], ["email", "E-mail"], ["cargo", "Relação"],
        ["criado_em", "Solicitado", (v) => app.formatDate(v)], ["status", "Status", statusBadge],
      ],
    },
  };

  function statusBadge(status) {
    const normalized = String(status ?? "").toLowerCase();
    const danger = ["vencido", "vencida", "rejeitado", "cancelado", "cancelada", "arquivado", "inativo"];
    const success = ["ativo", "ativa", "pago", "concluido", "finalizada", "convidado", "convertido"];
    const info = ["em_andamento", "em_execucao", "contatado", "aprovado"];
    const type = danger.includes(normalized) ? "danger" : success.includes(normalized) ? "success" : info.includes(normalized) ? "info" : "warning";
    return `<span class="badge badge-${type}">${app.escapeHtml(commonStatus[normalized] || normalized || "—")}</span>`;
  }

  function dueDate(value) {
    if (!value) return "—";
    const days = Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86_400_000);
    const label = app.formatDate(value);
    if (days < 0) return `<span class="danger-text">${label} · vencida</span>`;
    if (days <= 30) return `<span class="warning-text">${label} · ${days}d</span>`;
    return label;
  }

  function can(roles) { return roles.includes(context.profile.papel); }

  function setPageTitle(title) {
    document.querySelector("#topbarModule").textContent = title;
    document.title = `${title} | ORIGENIX`;
  }

  function safeValue(value) { return value === null || value === undefined || value === "" ? "—" : app.escapeHtml(value); }

  async function loadLookups() {
    const [companies, rts] = await Promise.all([
      app.client.from("empresas").select("id,nome,ativo").order("nome"),
      app.client.from("rts").select("id,nome,crmv,ativo").order("nome"),
    ]);
    lookups.empresas = companies.data || [];
    lookups.rts = rts.data || [];
  }

  async function renderOverview() {
    setPageTitle("Visão geral");
    content.innerHTML = `<div class="loading"><div class="skeleton-lines"><i></i><i></i><i></i></div><span>Carregando indicadores reais...</span></div>`;
    const count = (table, configure) => {
      let query = app.client.from(table).select("id", { count: "exact", head: true });
      if (configure) query = configure(query);
      return query;
    };
    try {
      const today = new Date().toISOString().slice(0, 10);
      const nextThirtyDays = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const [empresas, projetos, documentos, licencas, auditorias, pendencias, recentProjects, dueLicenses, recentDocuments, recentCompanies] = await Promise.all([
        count("empresas", (query) => query.eq("ativo", true)),
        count("projetos", (query) => query.eq("status", "em_andamento")),
        count("documentos", (query) => query.eq("status", "rascunho")),
        count("licencas", (query) => query.gte("data_vencimento", today).lte("data_vencimento", nextThirtyDays)),
        count("auditorias", (query) => query.in("status", ["planejada", "em_execucao"])),
        count("projetos", (query) => query.eq("status", "pausado")),
        app.client.from("projetos").select("id,titulo,status,progresso,atualizado_em,empresas(nome)").order("atualizado_em", { ascending: false }).limit(5),
        app.client.from("licencas").select("id,tipo,data_vencimento,status,empresas(nome)").not("data_vencimento", "is", null).order("data_vencimento").limit(5),
        app.client.from("documentos").select("id,titulo,status,versao,atualizado_em,empresas(nome)").order("atualizado_em", { ascending: false }).limit(4),
        app.client.from("empresas").select("id,nome,municipio,estado,inspecao,criado_em").order("criado_em", { ascending: false }).limit(4),
      ]);
      const results = [empresas, projetos, documentos, licencas, auditorias, pendencias, recentProjects, dueLicenses, recentDocuments, recentCompanies];
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
      const projectRows = (recentProjects.data || []).map((item) => `<tr><td data-label="Projeto">${safeValue(item.titulo)}</td><td data-label="Estabelecimento">${safeValue(item.empresas?.nome)}</td><td data-label="Status">${statusBadge(item.status)}</td><td data-label="Progresso">${Number(item.progresso) || 0}%</td></tr>`).join("");
      const licenseRows = (dueLicenses.data || []).map((item) => `<tr><td data-label="Tipo">${safeValue(item.tipo)}</td><td data-label="Estabelecimento">${safeValue(item.empresas?.nome)}</td><td data-label="Vencimento">${dueDate(item.data_vencimento)}</td></tr>`).join("");
      const documentActivity = (recentDocuments.data || []).map((item) => `<div class="activity-item"><span class="activity-mark">DOC</span><div><strong>${safeValue(item.titulo)}</strong><small>${safeValue(item.empresas?.nome)} · ${safeValue(item.versao || "v0")}</small></div><span>${app.formatDate(item.atualizado_em)}</span></div>`).join("");
      const companyActivity = (recentCompanies.data || []).map((item) => `<div class="activity-item"><span class="activity-mark">EMP</span><div><strong>${safeValue(item.nome)}</strong><small>${safeValue([item.municipio, item.estado].filter(Boolean).join(" / "))} · ${safeValue(item.inspecao)}</small></div><span>${app.formatDate(item.criado_em)}</span></div>`).join("");
      content.innerHTML = `
        <header class="page-head"><div><span class="eyebrow">Centro de comando regulatório</span><h1>Visão geral</h1><p>Indicadores calculados a partir dos registros permitidos ao seu perfil — sem valores simulados.</p></div><div class="page-context"><i></i> Dados sincronizados</div></header>
        <div class="stat-grid">
          ${statCard("Estabelecimentos ativos", empresas.count, "01", "Base operacional")}
          ${statCard("Projetos em andamento", projetos.count, "02", "Execução técnica")}
          ${statCard("Documentos pendentes", documentos.count, "03", "Rascunhos")}
          ${statCard("Licenças a vencer", licencas.count, "04", "Próximos 30 dias")}
          ${statCard("Auditorias abertas", auditorias.count, "05", "Planejadas ou em curso")}
          ${statCard("Pendências", pendencias.count, "06", "Projetos pausados")}
        </div>
        <div class="panel-grid">
          <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">EXECUÇÃO</span><h2>Projetos recentes</h2><p>Andamento das frentes técnicas visíveis.</p></div><button class="button button-small" data-go="projetos">Ver todos</button></div>${miniTable(["Projeto","Estabelecimento","Status","Progresso"], projectRows, "Nenhum projeto acessível.")}</section>
          <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">AGENDA REGULATÓRIA</span><h2>Próximos vencimentos</h2><p>Licenças e ARTs ordenadas por data.</p></div><button class="button button-small" data-go="licencas">Ver todos</button></div>${miniTable(["Tipo","Estabelecimento","Vencimento"], licenseRows, "Nenhum vencimento registrado.")}</section>
        </div>
        <div class="panel-grid panel-grid-wide">
          <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ATIVIDADE</span><h2>Documentos recentes</h2></div><button class="button button-small" data-go="documentos">Abrir acervo</button></div><div class="activity-list">${documentActivity || `<div class="empty"><strong>Nenhum documento recente.</strong></div>`}</div></section>
          <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ESTRUTURA</span><h2>Empresas recentes</h2></div><button class="button button-small" data-go="empresas">Ver empresas</button></div><div class="activity-list">${companyActivity || `<div class="empty"><strong>Nenhuma empresa recente.</strong></div>`}</div></section>
          <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ACESSO DIRETO</span><h2>Atalhos operacionais</h2></div></div><div class="shortcut-grid"><button data-go="projetos"><span>01 →</span>Novo acompanhamento de projeto</button><button data-go="auditorias"><span>02 →</span>Consultar auditorias</button><button data-go="licencas"><span>03 →</span>Ver agenda de licenças</button><button data-go="documentos"><span>04 →</span>Abrir central documental</button></div></section>
        </div>`;
    } catch (error) {
      renderError(error, renderOverview);
    }
  }

  function statCard(label, value, index, contextLabel) {
    return `<article class="stat-card"><span class="stat-card-label"><span>${app.escapeHtml(label)}</span><i class="stat-card-index">${index}</i></span><strong>${Number(value) || 0}</strong><small>${app.escapeHtml(contextLabel)}</small><span class="stat-card-line"><i></i></span></article>`;
  }

  function renderOverviewReview() {
    setPageTitle("Visão geral");
    content.innerHTML = `
      <header class="page-head"><div><span class="eyebrow">Centro de comando regulatório</span><h1>Visão geral</h1><p>Revisão visual local — nenhum dado de produção é carregado neste modo.</p></div><div class="page-context"><i></i> Ambiente de revisão</div></header>
      <div class="stat-grid">
        ${statCard("Estabelecimentos ativos", 0, "01", "Base operacional")}
        ${statCard("Projetos em andamento", 0, "02", "Execução técnica")}
        ${statCard("Documentos pendentes", 0, "03", "Rascunhos")}
        ${statCard("Licenças a vencer", 0, "04", "Próximos 30 dias")}
        ${statCard("Auditorias abertas", 0, "05", "Planejadas ou em curso")}
        ${statCard("Pendências", 0, "06", "Projetos pausados")}
      </div>
      <div class="panel-grid">
        <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">EXECUÇÃO</span><h2>Projetos recentes</h2><p>Andamento das frentes técnicas visíveis.</p></div><button class="button button-small" data-go="projetos">Ver todos</button></div><div class="empty"><div><strong>Nenhum projeto carregado.</strong><br><span class="small">Os dados aparecem após autenticação.</span></div></div></section>
        <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">AGENDA REGULATÓRIA</span><h2>Próximos vencimentos</h2><p>Licenças e ARTs ordenadas por data.</p></div><button class="button button-small" data-go="licencas">Ver todos</button></div><div class="empty"><div><strong>Nenhum vencimento carregado.</strong><br><span class="small">Os dados aparecem após autenticação.</span></div></div></section>
      </div>
      <div class="panel-grid panel-grid-wide">
        <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ATIVIDADE</span><h2>Documentos recentes</h2></div></div><div class="empty"><strong>Sem atividade local.</strong></div></section>
        <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ESTRUTURA</span><h2>Empresas recentes</h2></div></div><div class="empty"><strong>Sem atividade local.</strong></div></section>
        <section class="panel-card"><div class="panel-head"><div><span class="panel-kicker">ACESSO DIRETO</span><h2>Atalhos operacionais</h2></div></div><div class="shortcut-grid"><button data-go="projetos"><span>01 →</span>Projetos sanitários</button><button data-go="auditorias"><span>02 →</span>Auditorias</button><button data-go="licencas"><span>03 →</span>Licenças e ARTs</button><button data-go="documentos"><span>04 →</span>Central documental</button></div></section>
      </div>`;
  }

  function miniTable(headers, rows, empty) {
    return rows ? `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${empty}</div>`;
  }

  async function renderModule(name) {
    const config = modules[name];
    if (!config) return renderOverview();
    currentModule = name;
    currentPage = 1;
    sortState = { key: null, direction: "asc" };
    setPageTitle(config.title);
    content.innerHTML = `<div class="loading"><div class="skeleton-lines"><i></i><i></i><i></i></div><span>Carregando ${app.escapeHtml(config.title.toLowerCase())}...</span></div>`;
    try {
      const { data, error } = await app.client.from(config.table).select(config.select).order(name === "access_requests" ? "criado_em" : (name === "empresas" ? "nome" : "criado_em"), { ascending: name === "empresas" });
      if (error) throw error;
      currentRecords = data || [];
      renderModuleTable(config, currentRecords);
    } catch (error) {
      renderError(error, () => renderModule(name));
    }
  }

  function renderModuleTable(config, records) {
    const createAllowed = can(config.createRoles);
    const createLabel = config.customCreate ? "Novo documento" : `Novo ${config.singular}`;
    content.innerHTML = `
      <header class="page-head">
        <div><span class="eyebrow">Módulo operacional</span><h1>${app.escapeHtml(config.title)}</h1><p>${records.length} registro(s) visível(is) para o seu perfil.</p></div>
        ${createAllowed ? `<button class="button button-primary" id="createRecord">${app.escapeHtml(createLabel)}</button>` : ""}
      </header>
      <div class="toolbar">
        <input class="search-input" id="recordSearch" type="search" placeholder="Pesquisar..." aria-label="Pesquisar registros">
        ${config.fields.some((field) => field.name === "status") || ["leads", "access_requests"].includes(currentModule) ? `<select id="statusFilter" aria-label="Filtrar por status"><option value="">Todos os status</option>${statusOptions(records)}</select>` : ""}
      </div>
      <div id="recordsTable">${tableHtml(config, records)}</div>`;
  }

  function statusOptions(records) {
    return [...new Set(records.map((record) => record.status).filter(Boolean))]
      .sort().map((status) => `<option value="${app.escapeHtml(status)}">${app.escapeHtml(commonStatus[status] || status)}</option>`).join("");
  }

  function tableHtml(config, records) {
    if (!records.length) return `<div class="empty"><div><strong>Nenhum registro encontrado.</strong><br><span class="small">Use “Novo” quando seu perfil permitir.</span></div></div>`;
    const sorted = [...records];
    if (sortState.key) {
      sorted.sort((left, right) => {
        const a = String(left[sortState.key] ?? "").toLocaleLowerCase("pt-BR");
        const b = String(right[sortState.key] ?? "").toLocaleLowerCase("pt-BR");
        return a.localeCompare(b, "pt-BR", { numeric: true }) * (sortState.direction === "asc" ? 1 : -1);
      });
    }
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const pageRecords = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const headers = config.columns.map(([key, label]) => `<th><button class="sort-button" type="button" data-sort="${app.escapeHtml(key)}">${app.escapeHtml(label)}<span>${sortState.key === key ? (sortState.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>`).join("");
    const rows = pageRecords.map((record) => {
      const cells = config.columns.map(([key, label, formatter]) => `<td data-label="${app.escapeHtml(label)}">${formatter ? formatter(record[key], record) : safeValue(record[key])}</td>`).join("");
      return `<tr data-id="${record.id}">${cells}<td data-label="Ações"><div class="table-actions">${rowActions(config, record)}</div></td></tr>`;
    }).join("");
    const pagination = totalPages > 1 ? `<div class="pagination"><span>${sorted.length} registros · página ${currentPage} de ${totalPages}</span><div><button class="button button-small" type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button><button class="button button-small" type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Próxima</button></div></div>` : "";
    return `<div class="table-wrap"><table><thead><tr>${headers}<th>Ações</th></tr></thead><tbody>${rows}</tbody></table>${pagination}</div>`;
  }

  function rowActions(config, record) {
    if (currentModule === "documentos") return `<a class="button button-small" href="${app.config.documentsPath}?id=${encodeURIComponent(record.id)}">Abrir</a>`;
    if (currentModule === "access_requests") {
      if (record.status === "convidado" || record.status === "rejeitado") return "";
      return `<button class="button button-small button-primary" data-action="invite">Aprovar</button><button class="button button-small button-danger" data-action="reject">Rejeitar</button>`;
    }
    if (currentModule === "leads") {
      return record.status === "contatado" ? "" : `<button class="button button-small" data-action="contacted">Marcar contato</button>`;
    }
    const actions = [];
    if (can(config.editRoles)) actions.push(`<button class="button button-small" data-action="edit">Editar</button>`);
    if (currentModule === "empresas" && can(config.editRoles)) actions.push(`<button class="button button-small ${record.ativo ? "button-danger" : ""}" data-action="${record.ativo ? "archive" : "restore"}">${record.ativo ? "Arquivar" : "Restaurar"}</button>`);
    return actions.join("");
  }

  function renderError(error, retry) {
    console.error(error);
    content.innerHTML = `<div class="error-state"><div><strong class="danger-text">Não foi possível carregar este módulo.</strong><p>${app.escapeHtml(app.friendlyError(error))}</p><button class="button" id="retryLoad">Tentar novamente</button></div></div>`;
    document.querySelector("#retryLoad")?.addEventListener("click", retry, { once: true });
  }

  function inputHtml(field, value) {
    const id = `field-${field.name}`;
    const current = value ?? field.default ?? "";
    let control;
    if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${field.name}" maxlength="${field.max || 4000}" ${field.required ? "required" : ""}>${app.escapeHtml(current)}</textarea>`;
    } else if (field.type === "select") {
      control = `<select id="${id}" name="${field.name}" ${field.required ? "required" : ""}><option value="">Selecione</option>${field.options.map((option) => `<option value="${option}" ${String(current) === option ? "selected" : ""}>${app.escapeHtml(commonStatus[option] || option)}</option>`).join("")}</select>`;
    } else if (field.type === "lookup") {
      const items = lookups[field.lookup] || [];
      control = `<select id="${id}" name="${field.name}" ${field.required ? "required" : ""}><option value="">Selecione</option>${items.filter((item) => item.ativo !== false).map((item) => `<option value="${item.id}" ${String(current) === item.id ? "selected" : ""}>${app.escapeHtml(item.nome || item.id)}</option>`).join("")}</select>`;
    } else if (field.type === "boolean") {
      control = `<select id="${id}" name="${field.name}"><option value="true" ${current !== false ? "selected" : ""}>Ativo</option><option value="false" ${current === false ? "selected" : ""}>Inativo</option></select>`;
    } else {
      control = `<input id="${id}" name="${field.name}" type="${field.type || "text"}" value="${app.escapeHtml(field.cnpj ? app.formatCnpj(current) : current)}" ${field.required ? "required" : ""} ${field.max ? `maxlength="${field.max}"` : ""} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.maxNumber !== undefined ? `max="${field.maxNumber}"` : ""} ${field.step ? `step="${field.step}"` : ""}>`;
    }
    return `<div class="field ${field.full ? "field-full" : ""}"><label for="${id}">${app.escapeHtml(field.label)}${field.required ? " *" : ""}</label>${control}</div>`;
  }

  function formFieldsHtml(config, record) {
    if (config.fields.length <= 4) return `<div class="form-grid">${config.fields.map((field) => inputHtml(field, record?.[field.name])).join("")}</div>`;
    const split = Math.ceil(config.fields.length / 2);
    const labels = currentModule === "empresas"
      ? ["Dados gerais", "Informações sanitárias e responsáveis"]
      : currentModule === "auditorias"
        ? ["Dados da auditoria", "Não conformidades e plano de ação"]
        : ["Dados gerais", "Acompanhamento e observações"];
    return config.fields.reduce((html, field, index) => {
      if (index === 0 || index === split) html += `<section class="form-group"><div class="form-section-label"><span>${index === 0 ? "01" : "02"}</span>${labels[index === 0 ? 0 : 1]}</div><div class="form-grid">`;
      html += inputHtml(field, record?.[field.name]);
      if (index === split - 1 || index === config.fields.length - 1) html += `</div></section>`;
      return html;
    }, "");
  }

  function openRecordModal(record = null) {
    const config = modules[currentModule];
    previousFocus = document.activeElement;
    editingId = record?.id || null;
    document.querySelector("#recordModalTitle").textContent = editingId ? `Editar ${config.singular}` : `Novo ${config.singular}`;
    recordForm.innerHTML = `${formFieldsHtml(config, record)}<div class="form-actions"><button class="button" type="button" data-close-modal>Cancelar</button><button class="button button-primary" id="saveRecord" type="submit">Salvar registro</button></div>`;
    recordModal.hidden = false;
    recordForm.querySelector("input,select,textarea")?.focus();
    config.fields.filter((field) => field.cnpj).forEach((field) => {
      recordForm.elements[field.name]?.addEventListener("input", (event) => { event.target.value = app.formatCnpj(event.target.value); });
    });
    config.fields.filter((field) => field.name === "telefone").forEach((field) => {
      recordForm.elements[field.name]?.addEventListener("input", (event) => {
        const digits = app.digits(event.target.value).slice(0, 11);
        event.target.value = digits.length > 10
          ? digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3")
          : digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
      });
    });
  }

  function closeRecordModal() { recordModal.hidden = true; editingId = null; previousFocus?.focus?.(); }
  function closeInviteModal() { inviteModal.hidden = true; previousFocus?.focus?.(); }

  async function saveRecord(event) {
    event.preventDefault();
    const config = modules[currentModule];
    const payload = {};
    for (const field of config.fields) {
      const raw = recordForm.elements[field.name]?.value ?? "";
      if (field.required && !String(raw).trim()) {
        app.toast(`Preencha: ${field.label}.`, "error");
        return;
      }
      if (field.cnpj && raw && !app.validCnpj(raw)) {
        app.toast("Informe um CNPJ válido.", "error");
        return;
      }
      if (field.type === "number") payload[field.name] = raw === "" ? null : Number(raw);
      else if (field.type === "boolean") payload[field.name] = raw === "true";
      else if (field.cnpj) payload[field.name] = app.digits(raw) || null;
      else payload[field.name] = app.cleanText(raw, field.max || 4000) || null;
    }
    if (!editingId) {
      payload.user_id = context.user.id;
      if (currentModule === "auditorias") {
        payload.usuario_id = context.user.id;
        payload.acao = "Auditoria registrada";
      }
    }
    const button = document.querySelector("#saveRecord");
    app.setBusy(button, true, "Salvando...");
    try {
      const query = editingId
        ? app.client.from(config.table).update(payload).eq("id", editingId)
        : app.client.from(config.table).insert(payload);
      const { error } = await query;
      if (error) throw error;
      closeRecordModal();
      app.toast(`${config.singular} salvo com sucesso.`, "success");
      await Promise.all([loadLookups(), renderModule(currentModule)]);
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
    } finally {
      app.setBusy(button, false);
    }
  }

  async function performRowAction(action, id) {
    const record = currentRecords.find((item) => item.id === id);
    if (!record) return;
    if (action === "edit") return openRecordModal(record);
    if (action === "invite") return openInvite(record);
    try {
      if (action === "archive" || action === "restore") {
        const active = action === "restore";
        const { error } = await app.client.from("empresas").update({ ativo: active, arquivado_em: active ? null : new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        app.toast(active ? "Estabelecimento restaurado." : "Estabelecimento arquivado.", "success");
      } else if (action === "contacted") {
        const { error } = await app.client.from("leads").update({ status: "contatado", atualizado_em: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        app.toast("Lead marcado como contatado.", "success");
      } else if (action === "reject") {
        const { error } = await app.client.from("access_requests").update({ status: "rejeitado", revisado_por: context.user.id, revisado_em: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        app.toast("Solicitação rejeitada.", "success");
      }
      await renderModule(currentModule);
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
    }
  }

  function openInvite(record) {
    previousFocus = document.activeElement;
    document.querySelector("#inviteRequestId").value = record.id;
    document.querySelector("#inviteModalTitle").textContent = `Convidar ${record.nome}`;
    document.querySelector("#inviteCompany").innerHTML = `<option value="">Sem vínculo inicial</option>${lookups.empresas.filter((item) => item.ativo).map((item) => `<option value="${item.id}">${app.escapeHtml(item.nome)}</option>`).join("")}`;
    inviteModal.hidden = false;
    document.querySelector("#inviteRole").focus();
  }

  async function submitInvite(event) {
    event.preventDefault();
    const requestId = document.querySelector("#inviteRequestId").value;
    const papel = document.querySelector("#inviteRole").value;
    const empresaId = document.querySelector("#inviteCompany").value || null;
    if (papel === "cliente" && !empresaId) {
      app.toast("Vincule o cliente ao estabelecimento que ele poderá consultar.", "error");
      return;
    }
    const button = document.querySelector("#inviteSubmit");
    app.setBusy(button, true, "Enviando...");
    try {
      const { data, error } = await app.client.functions.invoke("approve-access-request", { body: { requestId, papel, empresaId } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "O convite não foi concluído.");
      closeInviteModal();
      app.toast(data.message || "Convite enviado.", "success");
      await renderModule("access_requests");
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
    } finally {
      app.setBusy(button, false);
    }
  }

  function filterRecords() {
    const config = modules[currentModule];
    if (!config) return;
    const term = app.cleanText(document.querySelector("#recordSearch")?.value || "", 200).toLocaleLowerCase("pt-BR");
    const status = document.querySelector("#statusFilter")?.value || "";
    const filtered = currentRecords.filter((record) => {
      const matchesText = !term || config.search.some((key) => String(record[key] ?? "").toLocaleLowerCase("pt-BR").includes(term));
      return matchesText && (!status || record.status === status);
    });
    document.querySelector("#recordsTable").innerHTML = tableHtml(config, filtered);
  }

  function navigate(module) {
    document.body.classList.remove("menu-open");
    document.querySelector("#globalSearch").value = "";
    document.querySelectorAll(".nav-item").forEach((item) => item.setAttribute("aria-current", item.dataset.module === module ? "page" : "false"));
    history.replaceState(null, "", `#${module}`);
    currentModule = module;
    module === "overview" ? renderOverview() : renderModule(module);
  }

  content.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) return navigate(go.dataset.go);
    const sortButton = event.target.closest("[data-sort]");
    if (sortButton) {
      const key = sortButton.dataset.sort;
      sortState = { key, direction: sortState.key === key && sortState.direction === "asc" ? "desc" : "asc" };
      currentPage = 1;
      return filterRecords();
    }
    const pageButton = event.target.closest("[data-page]");
    if (pageButton && !pageButton.disabled) {
      currentPage = Number(pageButton.dataset.page) || 1;
      return filterRecords();
    }
    if (event.target.closest("#createRecord")) {
      if (modules[currentModule].customCreate) return window.location.assign(app.config.documentsPath);
      return openRecordModal();
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) performRowAction(actionButton.dataset.action, actionButton.closest("tr")?.dataset.id);
  });
  content.addEventListener("input", (event) => { if (event.target.id === "recordSearch") { currentPage = 1; filterRecords(); } });
  content.addEventListener("change", (event) => { if (event.target.id === "statusFilter") { currentPage = 1; filterRecords(); } });
  document.querySelector("#mainNav").addEventListener("click", (event) => {
    const item = event.target.closest("[data-module]");
    if (item && !item.hidden) navigate(item.dataset.module);
  });
  document.querySelector("#logoutButton").addEventListener("click", app.logout);
  document.querySelector("#openMenu").addEventListener("click", () => document.body.classList.add("menu-open"));
  document.querySelector("#closeMenu").addEventListener("click", () => document.body.classList.remove("menu-open"));
  document.querySelector("#mobileOverlay").addEventListener("click", () => document.body.classList.remove("menu-open"));
  document.querySelector("#globalSearch").addEventListener("input", (event) => {
    const moduleSearch = document.querySelector("#recordSearch");
    if (!moduleSearch) return;
    moduleSearch.value = event.target.value;
    currentPage = 1;
    filterRecords();
  });
  recordModal.addEventListener("click", (event) => { if (event.target === recordModal || event.target.closest("[data-close-modal]")) closeRecordModal(); });
  inviteModal.addEventListener("click", (event) => { if (event.target === inviteModal || event.target.closest("[data-close-invite]")) closeInviteModal(); });
  recordForm.addEventListener("submit", saveRecord);
  document.querySelector("#inviteForm").addEventListener("submit", submitInvite);

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("#globalSearch").focus();
      return;
    }
    const activeModal = !recordModal.hidden ? recordModal : !inviteModal.hidden ? inviteModal : null;
    if (!activeModal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      activeModal === recordModal ? closeRecordModal() : closeInviteModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...activeModal.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  if (uiReview) {
    context = { user: { id: "local-review", email: "revisao@origenix.local" }, profile: { nome: "Equipe ORIGENIX", papel: "admin" } };
    shell.hidden = false;
    document.querySelector("#currentDate").textContent = app.formatDate(new Date().toISOString(), { dateStyle: "full" });
    document.querySelector("#userName").textContent = context.profile.nome;
    document.querySelector("#userRole").textContent = "Revisão visual local";
    document.querySelector("#userAvatar").textContent = "OX";
    renderOverviewReview();
    return;
  }

  context = await app.requireAuth();
  if (!context) return;
  shell.hidden = false;
  document.querySelector("#currentDate").textContent = app.formatDate(new Date().toISOString(), { dateStyle: "full" });
  document.querySelector("#userName").textContent = context.profile.nome || context.user.email || "Usuário";
  document.querySelector("#userRole").textContent = roleLabel[context.profile.papel] || context.profile.papel;
  document.querySelector("#userAvatar").textContent = (context.profile.nome || context.user.email || "OX").split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.querySelectorAll("[data-roles]").forEach((item) => { item.hidden = !item.dataset.roles.split(",").includes(context.profile.papel); });

  await loadLookups();
  const requested = window.location.hash.slice(1);
  const allowedItem = document.querySelector(`[data-module="${CSS.escape(requested)}"]:not([hidden])`);
  navigate(requested && (requested === "overview" || allowedItem) ? requested : "overview");

  app.client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") app.redirectToLogin("session");
  });
});
