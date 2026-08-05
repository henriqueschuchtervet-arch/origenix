(function bootstrapOrigenix() {
  "use strict";

  const config = window.ORIGENIX_CONFIG;
  if (!config || !window.supabase?.createClient) {
    throw new Error("Não foi possível inicializar os serviços do ORIGENIX.");
  }

  const client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "origenix-auth",
      },
    },
  );

  const roles = Object.freeze(["admin", "consultor", "rt", "colaborador", "cliente"]);
  const normalizeRole = (role) => role === "administrador" ? "admin" : role;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const cleanText = (value, max = 4000) => String(value ?? "").trim().slice(0, max);
  const digits = (value) => String(value ?? "").replace(/\D/g, "");

  function validEmail(value) {
    const email = cleanText(value, 320);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validCnpj(value) {
    const cnpj = digits(value);
    if (!cnpj) return true;
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (base, weights) => {
      const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    const first = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
    const second = calc(cnpj.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return cnpj.endsWith(`${first}${second}`);
  }

  function formatCnpj(value) {
    const cnpj = digits(value).slice(0, 14);
    return cnpj
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function formatDate(value, options) {
    if (!value) return "—";
    const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
    const date = new Date(source);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", options ?? { dateStyle: "medium" }).format(date);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
  }

  function toast(message, type = "info") {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), 4800);
  }

  function setBusy(button, busy, busyText = "Aguarde...") {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function friendlyError(error) {
    const message = error?.message || "Não foi possível concluir a operação.";
    if (/invalid login credentials/i.test(message)) return "E-mail ou senha inválidos.";
    if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
    if (/duplicate key/i.test(message)) return "Já existe um registro com esses dados.";
    if (/row-level security|permission denied/i.test(message)) return "Você não tem permissão para esta operação.";
    if (/failed to fetch|network/i.test(message)) return "Falha de conexão. Verifique sua internet e tente novamente.";
    return message;
  }

  async function getAuthorizedContext(options = {}) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) return null;
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return null;
    const { data: profile, error: profileError } = await client
      .from("perfis")
      .select("user_id, nome, papel, ativo, status")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !profile.ativo || profile.status !== "ativo") {
      if (!options.allowPending) await client.auth.signOut();
      return { session: sessionData.session, user: userData.user, profile, authorized: false };
    }
    profile.papel = normalizeRole(profile.papel);
    if (!roles.includes(profile.papel)) return { session: sessionData.session, user: userData.user, profile, authorized: false };
    return { session: sessionData.session, user: userData.user, profile, authorized: true };
  }

  function redirectToLogin(reason = "session") {
    const next = `${window.location.pathname}${window.location.search}`;
    const url = new URL(config.loginPath, window.location.origin);
    url.searchParams.set("next", next);
    url.searchParams.set("reason", reason);
    window.location.replace(url.toString());
  }

  async function requireAuth() {
    try {
      const context = await getAuthorizedContext();
      if (!context?.authorized) {
        redirectToLogin(context?.profile ? "pending" : "session");
        return null;
      }
      return context;
    } catch (error) {
      console.error("Auth gate failed", error);
      redirectToLogin("error");
      return null;
    }
  }

  async function logout() {
    await client.auth.signOut({ scope: "local" });
    window.location.replace(config.loginPath);
  }

  function isAllowed(profile, allowed) {
    return allowed.includes(normalizeRole(profile?.papel));
  }

  window.ORIGENIX = Object.freeze({
    client,
    config,
    roles,
    normalizeRole,
    escapeHtml,
    cleanText,
    digits,
    validEmail,
    validCnpj,
    formatCnpj,
    formatDate,
    formatMoney,
    toast,
    setBusy,
    friendlyError,
    getAuthorizedContext,
    requireAuth,
    redirectToLogin,
    logout,
    isAllowed,
  });
})();
