(function () {
  "use strict";

  const sb = window.OrigenixSupabase.createClient();
  const EDIT_ROLES = new Set(["administrador", "rt", "consultor"]);
  const PAC_STATUSES = ["rascunho", "em_revisao", "aprovado", "implantado", "suspenso"];
  const $ = (id) => document.getElementById(id);
  let user = null;
  let role = "cliente";
  let models = [];
  let companyPacs = [];
  let openNc = 0;

  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2600);
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function canEdit() {
    return EDIT_ROLES.has(role);
  }

  function showLogin() {
    user = null;
    $("loginView").classList.remove("hidden");
    $("app").classList.add("hidden");
  }

  async function login() {
    const email = $("email");
    const password = $("password");
    const button = $("loginButton");
    $("loginMessage").textContent = "";
    if (!email.value.trim() || !email.checkValidity()) {
      $("loginMessage").textContent = "Informe um e-mail válido.";
      email.focus();
      return;
    }
    if (!password.value) {
      $("loginMessage").textContent = "Informe sua senha.";
      password.focus();
      return;
    }
    window.OrigenixUI?.setButtonLoading(button, true, "Entrando...");
    try {
      const { error } = await sb.auth.signInWithPassword({
        email: email.value.trim().toLowerCase(),
        password: password.value
      });
      if (error) {
        $("loginMessage").textContent = error.code === "invalid_credentials"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente.";
      }
    } catch (error) {
      console.error(error);
      $("loginMessage").textContent = "Não foi possível conectar. Verifique sua internet.";
    } finally {
      window.OrigenixUI?.setButtonLoading(button, false);
    }
  }

  async function start(authUser) {
    if (user?.id === authUser.id) return;
    user = authUser;
    const { data: profile } = await sb.from("perfis").select("papel").eq("user_id", user.id).maybeSingle();
    role = profile?.papel || "cliente";
    $("loginView").classList.add("hidden");
    $("app").classList.remove("hidden");

    const [{ data: companies, error }, { data: catalog }] = await Promise.all([
      sb.from("empresas").select("id,nome,tipo_estabelecimento").order("nome"),
      sb.from("pac_modelos").select("*").eq("ativo", true).order("ordem")
    ]);
    if (error) {
      toast("Não foi possível carregar os estabelecimentos.");
      return;
    }
    models = catalog || [];
    $("company").innerHTML = (companies || []).map((company) =>
      `<option value="${escapeHtml(company.id)}">${escapeHtml(company.nome)}</option>`
    ).join("");
    const requestedCompany = new URLSearchParams(location.search).get("empresa");
    if (requestedCompany && (companies || []).some((company) => company.id === requestedCompany)) {
      $("company").value = requestedCompany;
    }
    if (companies?.length) await loadCompany();
    else $("pacGrid").innerHTML = '<div class="empty">Nenhum estabelecimento acessível.</div>';
  }

  async function configurePacs() {
    if (!canEdit()) {
      toast("Seu perfil possui acesso somente para consulta.");
      return;
    }
    const companyId = $("company").value;
    if (!companyId) return;
    const button = $("configureButton");
    const activity = $("activity").value;
    const species = $("species").value;
    const applicable = models.filter((model) =>
      (model.aplicabilidade.includes("todos") || model.aplicabilidade.includes(activity))
      && (model.especies.includes("todas") || model.especies.includes(species))
    );
    const rows = applicable.map((model) => ({
      empresa_id: companyId,
      modelo_codigo: model.codigo,
      versao: 1,
      status: "rascunho",
      criado_por: user.id,
      conteudo: { servico_inspecao: $("service").value, atividade: activity, especie: species }
    }));
    window.OrigenixUI?.setButtonLoading(button, true, "Configurando...");
    try {
      const { error } = await sb.from("empresa_pacs").upsert(rows, {
        onConflict: "empresa_id,modelo_codigo,versao",
        ignoreDuplicates: true
      });
      if (error) throw error;
      toast(`${rows.length} programas configurados.`);
      await loadCompany();
    } catch (error) {
      console.error(error);
      toast("Falha ao configurar os PACs.");
    } finally {
      window.OrigenixUI?.setButtonLoading(button, false);
    }
  }

  async function loadCompany() {
    const companyId = $("company").value;
    if (!companyId) return;
    $("pacGrid").innerHTML = '<div class="empty">Carregando programas...</div>';
    const [{ data: pacs, error }, { data: ncs }] = await Promise.all([
      sb.from("empresa_pacs").select("*,pac_modelos(*)").eq("empresa_id", companyId).order("criado_em"),
      sb.from("pac_nao_conformidades").select("id,empresa_pac_id,status").neq("status", "encerrada")
    ]);
    if (error) {
      console.error(error);
      $("pacGrid").innerHTML = '<div class="empty">Não foi possível carregar os PACs.</div>';
      return;
    }
    companyPacs = pacs || [];
    openNc = (ncs || []).filter((item) => companyPacs.some((pac) => pac.id === item.empresa_pac_id)).length;
    $("context").textContent = `${$("company").selectedOptions[0]?.text || ""} · ${$("service").value} · ${$("activity").selectedOptions[0].text} · ${$("species").selectedOptions[0].text}`;
    updateStats();
    render();
  }

  function updateStats() {
    $("totalStat").textContent = companyPacs.length;
    $("implementedStat").textContent = companyPacs.filter((pac) => pac.status === "implantado").length;
    $("reviewStat").textContent = companyPacs.filter((pac) => pac.status === "em_revisao").length;
    $("ncStat").textContent = openNc;
  }

  function render() {
    const query = $("search").value.trim().toLocaleLowerCase("pt-BR");
    const rows = companyPacs.filter((pac) =>
      `${pac.modelo_codigo} ${pac.pac_modelos?.titulo} ${pac.pac_modelos?.categoria}`
        .toLocaleLowerCase("pt-BR").includes(query)
    );
    if (!rows.length) {
      $("pacGrid").innerHTML = '<div class="empty">Nenhum programa configurado. Use “Configurar PACs”.</div>';
      return;
    }
    $("pacGrid").innerHTML = rows.map((pac) => {
      const status = PAC_STATUSES.includes(pac.status) ? pac.status : "rascunho";
      const id = escapeHtml(pac.id);
      const options = PAC_STATUSES.map((item) =>
        `<option value="${item}" ${status === item ? "selected" : ""}>${item.replace("_", " ")}</option>`
      ).join("");
      return `<article class="pac">
        <div class="pac-head"><div><div class="code">${escapeHtml(pac.modelo_codigo)}</div><h3>${escapeHtml(pac.pac_modelos?.titulo)}</h3></div><span class="badge ${status}">${status.replace("_", " ")}</span></div>
        <p>${escapeHtml(pac.pac_modelos?.descricao)}</p>
        <div class="pac-meta"><span>${escapeHtml(pac.pac_modelos?.categoria)}</span><span>·</span><span>Versão ${escapeHtml(pac.versao)}</span><span>·</span><span>${escapeHtml(pac.pac_modelos?.base_legal)}</span></div>
        <div class="pac-actions">
          <select aria-label="Status do PAC" data-action="status" data-pac-id="${id}">${options}</select>
          <button type="button" data-action="record" data-pac-id="${id}">+ Registro</button>
          <button type="button" data-action="nc" data-pac-id="${id}">+ Não conformidade</button>
        </div></article>`;
    }).join("");
  }

  async function changeStatus(id, status) {
    if (!canEdit()) {
      toast("Acesso somente para consulta.");
      await loadCompany();
      return;
    }
    if (!PAC_STATUSES.includes(status)) {
      toast("Status inválido.");
      return;
    }
    const approved = status === "aprovado"
      ? { aprovado_por: user.id, aprovado_em: new Date().toISOString() }
      : {};
    const { error } = await sb.from("empresa_pacs").update({
      status,
      atualizado_em: new Date().toISOString(),
      ...approved
    }).eq("id", id);
    if (error) {
      toast("Falha ao alterar status.");
      await loadCompany();
      return;
    }
    toast("Status atualizado.");
    await loadCompany();
  }

  async function addRecord(id) {
    if (!canEdit()) {
      toast("Acesso somente para consulta.");
      return;
    }
    const values = await window.OrigenixUI.openFormDialog({
      title: "Novo registro de monitoramento",
      description: "Registre a verificação executada e o resultado encontrado.",
      confirmLabel: "Salvar registro",
      fields: [
        { name: "description", label: "Monitoramento ou verificação", type: "textarea", placeholder: "Descreva o procedimento, evidências e observações..." },
        { name: "result", label: "Resultado", type: "select", options: [
          { value: "conforme", label: "Conforme" },
          { value: "nao_conforme", label: "Não conforme" }
        ] }
      ]
    });
    if (!values) return;
    const { error } = await sb.from("pac_registros").insert({
      empresa_pac_id: id,
      tipo: "monitoramento",
      resultado: values.result,
      descricao: values.description,
      registrado_por: user.id
    });
    if (error) {
      toast("Falha ao salvar registro.");
      return;
    }
    toast("Registro auditável salvo.");
    if (values.result === "nao_conforme") await addNc(id);
  }

  async function addNc(id) {
    if (!canEdit()) {
      toast("Acesso somente para consulta.");
      return;
    }
    const values = await window.OrigenixUI.openFormDialog({
      title: "Abrir não conformidade",
      description: "Descreva o desvio de forma objetiva para permitir tratamento e verificação.",
      confirmLabel: "Abrir não conformidade",
      fields: [
        { name: "title", label: "Título", type: "text", placeholder: "Ex.: Temperatura fora do limite" },
        { name: "description", label: "Descrição do desvio", type: "textarea", placeholder: "Informe o local, evidência, limite e condição observada..." }
      ]
    });
    if (!values) return;
    const { error } = await sb.from("pac_nao_conformidades").insert({
      empresa_pac_id: id,
      titulo: values.title,
      descricao: values.description,
      criado_por: user.id
    });
    if (error) {
      toast("Falha ao registrar não conformidade.");
      return;
    }
    toast("Não conformidade aberta.");
    await loadCompany();
  }

  function bindEvents() {
    $("loginButton").addEventListener("click", login);
    $("password").addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
    $("logoutButton").addEventListener("click", () => sb.auth.signOut());
    $("printButton").addEventListener("click", () => window.print());
    $("company").addEventListener("change", () => {
      const url = new URL(location.href);
      url.searchParams.set("empresa", $("company").value);
      history.replaceState({}, "", url);
      loadCompany();
    });
    $("service").addEventListener("change", loadCompany);
    $("activity").addEventListener("change", loadCompany);
    $("species").addEventListener("change", loadCompany);
    $("search").addEventListener("input", render);
    $("configureButton").addEventListener("click", configurePacs);
    $("pacGrid").addEventListener("change", (event) => {
      const control = event.target.closest('[data-action="status"]');
      if (control) changeStatus(control.dataset.pacId, control.value);
    });
    $("pacGrid").addEventListener("click", (event) => {
      const control = event.target.closest("button[data-action]");
      if (!control) return;
      if (control.dataset.action === "record") addRecord(control.dataset.pacId);
      if (control.dataset.action === "nc") addNc(control.dataset.pacId);
    });
  }

  async function init() {
    bindEvents();
    sb.auth.onAuthStateChange((event, session) =>
      setTimeout(() => session?.user ? start(session.user) : showLogin(), 0)
    );
    const { data } = await sb.auth.getUser();
    data.user ? await start(data.user) : showLogin();
  }

  init();
})();
