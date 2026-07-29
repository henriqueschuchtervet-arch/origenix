(() => {
  "use strict";

  const supa = window.OrigenixSupabase.createClient();
  const requestView = document.getElementById("requestView");
  const updateView = document.getElementById("updateView");
  const message = document.getElementById("message");
  const loginLink = document.getElementById("loginLink");

  function showMessage(text, type = "") {
    message.textContent = text;
    message.className = type;
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    if (label) button.textContent = label;
  }

  function showUpdateForm() {
    requestView.hidden = true;
    updateView.hidden = false;
    loginLink.hidden = true;
    showMessage("");
    requestAnimationFrame(() => document.getElementById("password").focus());
  }

  supa.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showUpdateForm();
  });

  document.getElementById("requestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("requestButton");
    const email = document.getElementById("email").value.trim().toLowerCase();
    const redirectTo = new URL("recuperar-senha.html", window.location.href).href;

    setBusy(button, true, "Enviando...");
    showMessage("Enviando...");
    try {
      const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      showMessage("Se existir uma conta para esse e-mail, o link será enviado.", "success");
    } catch (error) {
      console.error("Falha ao solicitar recuperação", error);
      showMessage("Não foi possível enviar o link. Tente novamente em instantes.", "error");
    } finally {
      setBusy(button, false, "Enviar link de recuperação");
    }
  });

  document.getElementById("updateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("password").value;
    const confirmation = document.getElementById("passwordConfirm").value;
    if (password !== confirmation) {
      showMessage("As senhas não coincidem.", "error");
      document.getElementById("passwordConfirm").focus();
      return;
    }

    const button = document.getElementById("updateButton");
    setBusy(button, true, "Atualizando...");
    showMessage("Atualizando...");
    try {
      const { error } = await supa.auth.updateUser({ password });
      if (error) throw error;
      document.getElementById("updateForm").reset();
      showMessage("Senha atualizada. Você já pode entrar no ORIGENIX.", "success");
      loginLink.hidden = false;
      loginLink.focus();
    } catch (error) {
      console.error("Falha ao atualizar senha", error);
      showMessage("O link pode ter expirado. Solicite uma nova recuperação.", "error");
    } finally {
      setBusy(button, false, "Atualizar senha");
    }
  });
})();
