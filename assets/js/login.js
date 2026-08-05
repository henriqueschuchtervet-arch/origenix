document.addEventListener("DOMContentLoaded", async () => {
  "use strict";
  const app = window.ORIGENIX;
  const $ = (selector) => document.querySelector(selector);
  const loginTab = $("#loginTab");
  const requestTab = $("#requestTab");
  const loginPanel = $("#loginPanel");
  const requestPanel = $("#requestPanel");
  const recoveryPanel = $("#recoveryPanel");
  const tabs = $(".auth-tabs");
  const notice = $("#pageNotice");
  const params = new URLSearchParams(window.location.search);

  function showNotice(message, type = "info") {
    notice.hidden = !message;
    notice.textContent = message || "";
    notice.className = `notice notice-${type}`;
  }

  function setPanel(name) {
    const request = name === "request";
    loginTab.setAttribute("aria-selected", String(!request));
    requestTab.setAttribute("aria-selected", String(request));
    loginPanel.hidden = request;
    requestPanel.hidden = !request;
    recoveryPanel.hidden = true;
    showNotice("");
  }

  function safeNext() {
    const next = params.get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) return app.config.dashboardPath;
    return next;
  }

  loginTab.addEventListener("click", () => setPanel("login"));
  requestTab.addEventListener("click", () => setPanel("request"));
  if (params.get("tab") === "request") setPanel("request");

  const reason = params.get("reason");
  if (reason === "pending") showNotice("Seu acesso ainda não está ativo. Aguarde a aprovação administrativa.", "info");
  if (reason === "session") showNotice("Entre para continuar na área restrita.", "info");
  if (reason === "error") showNotice("Não foi possível validar a sessão. Entre novamente.", "error");

  const isRecovery = params.get("type") === "recovery" || window.location.hash.includes("type=recovery");
  if (isRecovery) {
    tabs.hidden = true;
    loginPanel.hidden = true;
    requestPanel.hidden = true;
    recoveryPanel.hidden = false;
    $("#authTitle").textContent = "Criar nova senha";
    $("#authSubtitle").textContent = "Conclua a recuperação da sua conta.";
  } else {
    try {
      const context = await app.getAuthorizedContext({ allowPending: true });
      if (context?.authorized) window.location.replace(safeNext());
    } catch (error) {
      console.error("Session check failed", error);
    }
  }

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("");
    const email = app.cleanText($("#loginEmail").value, 320).toLowerCase();
    const password = $("#loginPassword").value;
    if (!app.validEmail(email) || password.length < 8) {
      showNotice("Informe um e-mail válido e sua senha.", "error");
      return;
    }
    const button = $("#loginSubmit");
    app.setBusy(button, true, "Validando...");
    try {
      const { error } = await app.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const context = await app.getAuthorizedContext({ allowPending: true });
      if (!context?.authorized) {
        await app.client.auth.signOut({ scope: "local" });
        showNotice("Conta pendente, suspensa ou sem perfil autorizado. Fale com um administrador.", "error");
        return;
      }
      window.location.replace(safeNext());
    } catch (error) {
      showNotice(app.friendlyError(error), "error");
    } finally {
      app.setBusy(button, false);
    }
  });

  $("#forgotPassword").addEventListener("click", async () => {
    const email = app.cleanText($("#loginEmail").value, 320).toLowerCase();
    if (!app.validEmail(email)) {
      showNotice("Informe seu e-mail antes de solicitar a recuperação.", "error");
      $("#loginEmail").focus();
      return;
    }
    const button = $("#forgotPassword");
    button.disabled = true;
    try {
      const redirectTo = new URL(app.config.loginPath, window.location.origin);
      redirectTo.searchParams.set("type", "recovery");
      const { error } = await app.client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
      if (error) throw error;
      showNotice("Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.", "success");
    } catch (error) {
      showNotice(app.friendlyError(error), "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#requestCnpj").addEventListener("input", (event) => {
    event.target.value = app.formatCnpj(event.target.value);
  });

  $("#requestPhone").addEventListener("input", (event) => {
    const digits = app.digits(event.target.value).slice(0, 11);
    event.target.value = digits.length > 10
      ? digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3")
      : digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  });

  $("#requestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showNotice("");
    if ($("#requestWebsite").value) return;

    const lastRequest = Number(sessionStorage.getItem("origenix-last-access-request") || 0);
    if (Date.now() - lastRequest < 60_000) {
      showNotice("Aguarde um minuto antes de enviar outra solicitação.", "error");
      return;
    }

    const data = {
      nome: app.cleanText($("#requestName").value, 160),
      email: app.cleanText($("#requestEmail").value, 320).toLowerCase(),
      telefone: app.cleanText($("#requestPhone").value, 30) || null,
      empresa: app.cleanText($("#requestCompany").value, 200),
      cnpj: app.digits($("#requestCnpj").value) || null,
      cargo: app.cleanText($("#requestRole").value, 120) || null,
      motivo: app.cleanText($("#requestReason").value, 4000) || null,
      status: "pendente",
    };
    if (data.nome.length < 2 || data.empresa.length < 2 || !app.validEmail(data.email)) {
      showNotice("Preencha nome, e-mail válido e empresa.", "error");
      return;
    }
    if (data.cnpj && !app.validCnpj(data.cnpj)) {
      showNotice("O CNPJ informado não é válido.", "error");
      return;
    }

    const button = $("#requestSubmit");
    app.setBusy(button, true, "Enviando...");
    try {
      const { error } = await app.client.from("access_requests").insert(data);
      if (error) throw error;
      sessionStorage.setItem("origenix-last-access-request", String(Date.now()));
      event.target.reset();
      showNotice("Solicitação registrada. Um administrador analisará seus dados e enviará um convite se aprovada.", "success");
    } catch (error) {
      if (/access_requests_email_pending_uidx|duplicate key/i.test(error?.message || "")) {
        showNotice("Já existe uma solicitação ativa para este e-mail.", "error");
      } else {
        showNotice(app.friendlyError(error), "error");
      }
    } finally {
      app.setBusy(button, false);
    }
  });

  $("#recoveryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#newPassword").value;
    const confirmation = $("#confirmPassword").value;
    if (password.length < 10 || password !== confirmation) {
      showNotice("As senhas devem ser iguais e ter pelo menos 10 caracteres.", "error");
      return;
    }
    const button = $("#recoverySubmit");
    app.setBusy(button, true, "Atualizando...");
    try {
      const { error } = await app.client.auth.updateUser({ password });
      if (error) throw error;
      showNotice("Senha atualizada. Você já pode entrar.", "success");
      window.setTimeout(() => window.location.replace(app.config.loginPath), 1200);
    } catch (error) {
      showNotice(app.friendlyError(error), "error");
    } finally {
      app.setBusy(button, false);
    }
  });
});
