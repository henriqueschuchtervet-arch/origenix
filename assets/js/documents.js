document.addEventListener("DOMContentLoaded", async () => {
  "use strict";
  const app = window.ORIGENIX;
  const root = document.querySelector("#documentsApp");
  const list = document.querySelector("#documentList");
  const editor = document.querySelector("#editorPanel");
  let context;
  let documents = [];
  let companies = [];
  let current = null;
  const editableRoles = ["admin", "consultor", "rt", "colaborador"];

  const statusLabel = { rascunho: "Rascunho", emitido: "Emitido", assinado: "Aprovado internamente", arquivado: "Arquivado" };
  const canEdit = () => editableRoles.includes(context.profile.papel);

  function statusBadge(status) {
    const style = status === "assinado" || status === "emitido" ? "success" : status === "arquivado" ? "danger" : "warning";
    return `<span class="badge badge-${style}">${app.escapeHtml(statusLabel[status] || status || "Rascunho")}</span>`;
  }

  async function loadData(selectId) {
    list.innerHTML = `<div class="loading">Carregando documentos...</div>`;
    try {
      const [documentResult, companyResult] = await Promise.all([
        app.client.from("documentos").select("*, empresas(nome)").order("atualizado_em", { ascending: false }),
        app.client.from("empresas").select("id,nome,ativo").eq("ativo", true).order("nome"),
      ]);
      if (documentResult.error) throw documentResult.error;
      if (companyResult.error) throw companyResult.error;
      documents = documentResult.data || [];
      companies = companyResult.data || [];
      renderList(documents);
      const target = selectId || new URLSearchParams(window.location.search).get("id");
      if (target) selectDocument(target);
    } catch (error) {
      console.error(error);
      list.innerHTML = `<div class="error-state"><div><strong class="danger-text">Falha ao carregar.</strong><p>${app.escapeHtml(app.friendlyError(error))}</p><button class="button" id="retryDocuments">Tentar novamente</button></div></div>`;
      document.querySelector("#retryDocuments")?.addEventListener("click", () => loadData());
    }
  }

  function renderList(items) {
    if (!items.length) {
      list.innerHTML = `<div class="empty">Nenhum documento encontrado.</div>`;
      return;
    }
    list.innerHTML = items.map((document) => `
      <button class="document-item ${current?.id === document.id ? "active" : ""}" type="button" data-id="${document.id}">
        <strong>${app.escapeHtml(document.titulo)}</strong>
        <span class="small muted">${app.escapeHtml(document.empresas?.nome || "Sem estabelecimento")}</span>
        <span>${statusBadge(document.status)} <span class="small muted">${app.escapeHtml(document.versao || "v0")}</span></span>
      </button>`).join("");
  }

  function selectDocument(id) {
    current = documents.find((document) => document.id === id) || null;
    renderList(filteredDocuments());
    current ? renderEditor(current) : renderEmpty();
  }

  function renderEmpty() {
    editor.innerHTML = `<div class="empty"><div><strong>Documento não encontrado.</strong><br><span class="small">Talvez você não tenha acesso ao estabelecimento vinculado.</span></div></div>`;
  }

  function companyOptions(selected) {
    return `<option value="">Selecione</option>${companies.map((company) => `<option value="${company.id}" ${company.id === selected ? "selected" : ""}>${app.escapeHtml(company.nome)}</option>`).join("")}`;
  }

  function renderEditor(document) {
    const readonly = !canEdit() || document.status === "arquivado";
    editor.innerHTML = `
      <div class="panel-head">
        <div><h2>${app.escapeHtml(document.titulo || "Novo documento")}</h2><span class="small muted">${app.escapeHtml(document.codigo || "Sem código")} · ${app.escapeHtml(document.versao || "v0")}</span></div>
        ${statusBadge(document.status)}
      </div>
      <form id="documentForm" class="document-editor" novalidate>
        <div class="form-grid">
          <div class="field"><label for="docTitle">Título *</label><input id="docTitle" name="titulo" maxlength="240" value="${app.escapeHtml(document.titulo || "")}" ${readonly ? "disabled" : ""} required></div>
          <div class="field"><label for="docCompany">Estabelecimento *</label><select id="docCompany" name="empresa_id" ${readonly ? "disabled" : ""} required>${companyOptions(document.empresa_id)}</select></div>
          <div class="field"><label for="docType">Tipo / pasta regulatória</label><input id="docType" name="tipo" maxlength="160" value="${app.escapeHtml(document.tipo || "")}" ${readonly ? "disabled" : ""}></div>
          <div class="field"><label>Última atualização</label><input value="${app.escapeHtml(app.formatDate(document.atualizado_em || document.criado_em, { dateStyle: "medium", timeStyle: "short" }))}" disabled></div>
          <div class="field field-full"><label for="docContent">Conteúdo técnico *</label><textarea id="docContent" name="conteudo" maxlength="100000" ${readonly ? "disabled" : ""} required>${app.escapeHtml(document.conteudo || "")}</textarea></div>
        </div>
        ${document.hash_sha256 ? `<div class="notice"><strong>Checksum SHA-256</strong><br><code class="small">${app.escapeHtml(document.hash_sha256)}</code></div>` : ""}
        ${document.assinado_em ? `<div class="notice notice-success">Aprovação interna registrada em ${app.escapeHtml(app.formatDate(document.assinado_em, { dateStyle: "medium", timeStyle: "short" }))}.</div>` : ""}
        <div class="form-actions" style="flex-wrap:wrap">
          <button class="button" type="button" data-doc-action="preview">Pré-visualizar</button>
          <button class="button" type="button" data-doc-action="download">Baixar texto</button>
          <button class="button" type="button" data-doc-action="print">Imprimir / salvar PDF</button>
          ${canEdit() && document.status !== "arquivado" ? `<button class="button" type="submit" id="saveDocument">Salvar rascunho</button><button class="button button-primary" type="button" data-doc-action="emit">Emitir versão</button>` : ""}
          ${canEdit() && document.status === "emitido" ? `<button class="button" type="button" data-doc-action="approve">Registrar aprovação interna</button>` : ""}
          ${canEdit() && document.status !== "arquivado" ? `<button class="button button-danger" type="button" data-doc-action="archive">Arquivar</button>` : ""}
        </div>
      </form>`;
  }

  function newDraft() {
    if (!canEdit()) return app.toast("Seu perfil possui acesso somente para consulta.", "error");
    current = { id: null, titulo: "Novo documento", empresa_id: companies[0]?.id || "", tipo: "", conteudo: "", status: "rascunho", versao: "v0" };
    renderList(filteredDocuments());
    renderEditor(current);
    document.querySelector("#docTitle")?.select();
  }

  function formPayload() {
    const title = app.cleanText(document.querySelector("#docTitle")?.value, 240);
    const companyId = document.querySelector("#docCompany")?.value;
    const type = app.cleanText(document.querySelector("#docType")?.value, 160) || null;
    const body = app.cleanText(document.querySelector("#docContent")?.value, 100000);
    if (title.length < 2 || !companyId || !body) throw new Error("Preencha título, estabelecimento e conteúdo técnico.");
    return { titulo: title, empresa_id: companyId, tipo: type, conteudo: body };
  }

  async function saveDraft(event) {
    event?.preventDefault();
    if (!canEdit()) return null;
    let payload;
    try { payload = formPayload(); } catch (error) { app.toast(error.message, "error"); return null; }
    const button = document.querySelector("#saveDocument");
    app.setBusy(button, true, "Salvando...");
    try {
      const query = current.id
        ? app.client.from("documentos").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", current.id).select("id").single()
        : app.client.from("documentos").insert({ ...payload, status: "rascunho", user_id: context.user.id }).select("id").single();
      const { data, error } = await query;
      if (error) throw error;
      app.toast("Rascunho salvo.", "success");
      await loadData(data.id);
      return data.id;
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
      return null;
    } finally {
      app.setBusy(button, false);
    }
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function emitDocument(button) {
    let payload;
    try { payload = formPayload(); } catch (error) { app.toast(error.message, "error"); return; }
    let id = current.id;
    if (!id) {
      id = await saveDraft();
      if (!id) return;
      payload = formPayload();
    }
    app.setBusy(button, true, "Emitindo...");
    try {
      const checksum = await sha256(JSON.stringify({ id, ...payload }));
      const { data, error } = await app.client.rpc("emitir_documento", {
        p_documento_id: id,
        p_titulo: payload.titulo,
        p_tipo: payload.tipo,
        p_conteudo: payload.conteudo,
        p_hash_sha256: checksum,
      });
      if (error) throw error;
      app.toast(`Versão ${data?.versao || ""} emitida e registrada.`, "success");
      await loadData(id);
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
    } finally {
      app.setBusy(button, false);
    }
  }

  async function approveDocument(button) {
    app.setBusy(button, true, "Registrando...");
    try {
      const { error } = await app.client.from("documentos").update({
        status: "assinado",
        assinado_por: context.user.id,
        assinado_em: new Date().toISOString(),
        assinatura_tipo: "aprovacao_interna",
        atualizado_em: new Date().toISOString(),
      }).eq("id", current.id);
      if (error) throw error;
      app.toast("Aprovação interna registrada.", "success");
      await loadData(current.id);
    } catch (error) {
      app.toast(app.friendlyError(error), "error");
    } finally { app.setBusy(button, false); }
  }

  async function archiveDocument(button) {
    app.setBusy(button, true, "Arquivando...");
    try {
      const { error } = await app.client.from("documentos").update({ status: "arquivado", arquivado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", current.id);
      if (error) throw error;
      app.toast("Documento arquivado sem exclusão de histórico.", "success");
      await loadData(current.id);
    } catch (error) { app.toast(app.friendlyError(error), "error"); }
    finally { app.setBusy(button, false); }
  }

  function previewHtml() {
    const title = app.cleanText(document.querySelector("#docTitle")?.value || current?.titulo, 240);
    const body = app.cleanText(document.querySelector("#docContent")?.value || current?.conteudo, 100000);
    const company = companies.find((item) => item.id === (document.querySelector("#docCompany")?.value || current?.empresa_id));
    return `<article class="document-preview"><p class="small">ORIGENIX · DOCUMENTO TÉCNICO</p><h1>${app.escapeHtml(title)}</h1><p><strong>Estabelecimento:</strong> ${app.escapeHtml(company?.nome || current?.empresas?.nome || "—")}</p><p><strong>Código:</strong> ${app.escapeHtml(current?.codigo || "Rascunho")} · <strong>Versão:</strong> ${app.escapeHtml(current?.versao || "v0")}</p><hr><div>${app.escapeHtml(body)}</div></article>`;
  }

  function showPreview() {
    editor.innerHTML = `${previewHtml()}<div class="form-actions"><button class="button" type="button" id="backToEditor">Voltar à edição</button><button class="button button-primary" type="button" data-doc-action="print">Imprimir / salvar PDF</button></div>`;
    document.querySelector("#backToEditor").addEventListener("click", () => renderEditor(current));
  }

  function printDocument() {
    const existing = document.querySelector(".document-preview");
    if (existing) return window.print();
    const container = document.createElement("div");
    container.innerHTML = previewHtml();
    document.body.append(container.firstElementChild);
    window.print();
    document.body.lastElementChild?.classList.contains("document-preview") && document.body.lastElementChild.remove();
  }

  function downloadDocument() {
    const title = app.cleanText(document.querySelector("#docTitle")?.value || current?.titulo, 240) || "documento";
    const body = app.cleanText(document.querySelector("#docContent")?.value || current?.conteudo, 100000);
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "documento"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function filteredDocuments() {
    const term = app.cleanText(document.querySelector("#documentSearch")?.value || "", 200).toLocaleLowerCase("pt-BR");
    return documents.filter((document) => !term || [document.titulo, document.tipo, document.codigo, document.empresas?.nome].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term)));
  }

  list.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (item) selectDocument(item.dataset.id);
  });
  document.querySelector("#documentSearch").addEventListener("input", () => renderList(filteredDocuments()));
  document.querySelector("#newDocument").addEventListener("click", newDraft);
  document.querySelector("#documentLogout").addEventListener("click", app.logout);
  editor.addEventListener("submit", (event) => { if (event.target.id === "documentForm") saveDraft(event); });
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-doc-action]");
    if (!button) return;
    const actions = {
      preview: showPreview, download: downloadDocument, print: printDocument,
      emit: () => emitDocument(button), approve: () => approveDocument(button), archive: () => archiveDocument(button),
    };
    actions[button.dataset.docAction]?.();
  });

  context = await app.requireAuth();
  if (!context) return;
  root.hidden = false;
  document.querySelector("#documentUser").textContent = `${context.profile.nome || context.user.email} · ${context.profile.papel}`;
  document.querySelector("#newDocument").hidden = !canEdit();
  await loadData();
});
