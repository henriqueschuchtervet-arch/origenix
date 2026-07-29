(() => {
  "use strict";

  const messages = Object.freeze({
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar.",
    user_already_exists: "Este e-mail já possui uma conta.",
    email_exists: "Este e-mail já possui uma conta.",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos.",
    weak_password: "Use uma senha mais forte, com pelo menos 8 caracteres.",
  });

  function errorMessage(error) {
    if (error) console.error("Falha de autenticação", error);
    return messages[error?.code] || "Não foi possível concluir. Tente novamente.";
  }

  function normalizeCredentials(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { ok: false, field: "email", message: "Informe um e-mail válido." };
    }
    if (normalizedPassword.length < 6) {
      return {
        ok: false,
        field: "password",
        message: "A senha deve ter pelo menos 6 caracteres.",
      };
    }

    return { ok: true, email: normalizedEmail, password: normalizedPassword };
  }

  async function authenticate({ client, mode, email, password, emailRedirectTo }) {
    const credentials = normalizeCredentials(email, password);
    if (!credentials.ok) return credentials;
    if (!client?.auth) {
      return { ok: false, message: "Serviço temporariamente indisponível." };
    }

    try {
      const response = mode === "signup"
        ? await client.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: emailRedirectTo ? { emailRedirectTo } : undefined,
          })
        : await client.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

      if (response.error) {
        return { ok: false, error: response.error, message: errorMessage(response.error) };
      }

      return {
        ok: true,
        data: response.data,
        requiresEmailConfirmation: mode === "signup" && !response.data?.session,
      };
    } catch (error) {
      console.error("Falha de conexão com a autenticação", error);
      return {
        ok: false,
        error,
        message: "Falha de conexão. Verifique sua internet e tente novamente.",
      };
    }
  }

  async function observeSession({
    client,
    onAuthenticated,
    onSignedOut,
    onMissingSession,
    onUnavailable,
    onError,
  }) {
    if (!client?.auth) {
      onUnavailable?.();
      return null;
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (session?.user) onAuthenticated?.(session.user);
        else if (event === "SIGNED_OUT") onSignedOut?.();
      }, 0);
    });

    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") onError?.(error);
    if (data?.user) await onAuthenticated?.(data.user);
    else onMissingSession?.();

    return listener?.subscription || null;
  }

  async function signOut(client) {
    if (!client?.auth) return { error: new Error("Serviço de autenticação indisponível.") };
    try {
      return await client.auth.signOut();
    } catch (error) {
      return { error };
    }
  }

  window.OrigenixAuth = Object.freeze({
    authenticate,
    errorMessage,
    normalizeCredentials,
    observeSession,
    signOut,
  });
})();
