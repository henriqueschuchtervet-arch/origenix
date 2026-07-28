(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isHome = /(^|\/)index\.html$/.test(location.pathname) || location.pathname === "/";

  const style = document.createElement("style");
  style.textContent = `
    .ox-utility{position:fixed;right:18px;bottom:18px;z-index:190;display:flex;gap:8px;align-items:center}
    .ox-utility button,.ox-utility a,.ox-auth-link,.ox-secondary-action{
      border:1px solid rgba(255,60,60,.32);background:#151517;color:#fff;border-radius:9px;
      min-height:40px;padding:0 14px;font:600 12px Montserrat,Inter,sans-serif;cursor:pointer;
      display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;
      box-shadow:0 10px 28px rgba(0,0,0,.28);transition:.18s ease
    }
    .ox-utility button:hover,.ox-utility a:hover,.ox-auth-link:hover,.ox-secondary-action:hover{
      border-color:#ff1a1a;background:#241313;transform:translateY(-1px)
    }
    .ox-backtop{display:none!important}.ox-backtop.show{display:inline-flex!important}
    .ox-password-wrap{position:relative}.ox-password-wrap input{padding-right:48px!important}
    .ox-password-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:0;
      background:transparent;color:#aaa;padding:8px;cursor:pointer;font:600 11px Inter,sans-serif}
    .ox-auth-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
    .ox-auth-link{background:transparent;box-shadow:none;min-height:34px}
    .ox-cancel{width:100%;margin-top:8px}
    .ox-toast{position:fixed;left:50%;bottom:26px;z-index:260;transform:translate(-50%,20px);
      padding:12px 18px;border:1px solid rgba(255,60,60,.38);border-radius:9px;background:#171719;
      color:#fff;font:600 12px Montserrat,Inter,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);
      opacity:0;pointer-events:none;transition:.2s ease}.ox-toast.show{opacity:1;transform:translate(-50%,0)}
    .ox-refresh{border:1px solid rgba(255,60,60,.32);background:#151517;color:#fff;border-radius:9px;
      min-height:40px;padding:0 14px;font:600 12px Montserrat,Inter,sans-serif;cursor:pointer}
    .ox-menu-toggle{display:none;border:1px solid rgba(255,60,60,.32);background:#151517;color:#fff;
      border-radius:8px;width:42px;height:42px;font-size:20px;cursor:pointer}
    @media(max-width:880px){
      .ox-menu-toggle{display:block}.nav-links.ox-open{display:flex;position:absolute;left:40px;right:40px;top:78px;
        background:#121214;border:1px solid rgba(255,60,60,.28);border-radius:10px;padding:16px;
        flex-direction:column;gap:8px;box-shadow:0 22px 50px rgba(0,0,0,.5)}
      .nav-links.ox-open a{padding:11px;border-radius:7px}.nav-links.ox-open a:hover{background:#211}
      .ox-utility{right:10px;bottom:10px}.ox-utility a,.ox-utility button{min-height:44px}
    }
  `;
  document.head.appendChild(style);

  function addUtilityButtons() {
    if ($(".ox-utility")) return;
    const box = document.createElement("div");
    box.className = "ox-utility";

    if (!isHome) {
      const home = document.createElement("a");
      home.href = "index.html";
      home.textContent = "⌂ Início";
      home.setAttribute("aria-label", "Voltar ao site ORIGENIX");
      box.appendChild(home);

      const back = document.createElement("button");
      back.type = "button";
      back.textContent = "← Voltar";
      back.setAttribute("aria-label", "Voltar à tela anterior");
      back.addEventListener("click", () => history.length > 1 ? history.back() : location.assign("index.html"));
      box.appendChild(back);
    }

    const top = document.createElement("button");
    top.type = "button";
    top.className = "ox-backtop";
    top.textContent = "↑ Topo";
    top.setAttribute("aria-label", "Voltar ao topo");
    top.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    box.appendChild(top);
    document.body.appendChild(box);
    addEventListener("scroll", () => top.classList.toggle("show", scrollY > 500), { passive: true });
  }

  function enhancePasswordFields() {
    $$('input[type="password"]').forEach((input) => {
      if (input.dataset.oxEnhanced) return;
      input.dataset.oxEnhanced = "1";
      const parent = input.parentElement;
      parent.classList.add("ox-password-wrap");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ox-password-toggle";
      toggle.textContent = "Mostrar";
      toggle.setAttribute("aria-label", "Mostrar senha");
      toggle.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        toggle.textContent = show ? "Ocultar" : "Mostrar";
        toggle.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      });
      parent.appendChild(toggle);
    });
  }

  function enhanceAuth() {
    const password = $('input[type="password"]');
    if (!password || $(".ox-auth-actions")) return;
    const loginButton = $$("button").find((button) => button.textContent.trim().toLowerCase() === "entrar");
    if (!loginButton) return;
    const actions = document.createElement("div");
    actions.className = "ox-auth-actions";
    actions.innerHTML = `
      <a class="ox-auth-link" href="recuperar-senha.html">Esqueci minha senha</a>
      <a class="ox-auth-link" href="index.html">Voltar ao site</a>
    `;
    loginButton.insertAdjacentElement("afterend", actions);
  }

  function enhanceLeadModal() {
    const submit = $("#btnLeadSubmit");
    if (submit && !$(".ox-cancel", submit.parentElement)) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "ox-secondary-action ox-cancel";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => window.closeLeadModal?.());
      submit.insertAdjacentElement("afterend", cancel);
    }
    const close = $(".modal-close");
    if (close && !close.getAttribute("aria-label")) close.setAttribute("aria-label", "Fechar janela");
  }

  function enhanceMobileMenu() {
    const nav = $(".nav-glass");
    const links = $(".nav-links");
    if (!nav || !links || $(".ox-menu-toggle", nav)) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ox-menu-toggle";
    toggle.textContent = "☰";
    toggle.setAttribute("aria-label", "Abrir menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("ox-open");
      toggle.textContent = open ? "×" : "☰";
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.insertAdjacentElement("beforebegin", toggle);
    $$("a", links).forEach((link) => link.addEventListener("click", () => {
      links.classList.remove("ox-open");
      toggle.textContent = "☰";
      toggle.setAttribute("aria-expanded", "false");
    }));
  }

  function improveButtons() {
    $$("button").forEach((button) => {
      if (!button.getAttribute("type")) button.type = "button";
      if (!button.getAttribute("aria-label") && !button.textContent.trim()) {
        button.setAttribute("aria-label", button.title || "Ação");
      }
    });
  }

  function showToast(message) {
    let toast = $(".ox-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "ox-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function enhanceDashboard() {
    const app = $("#mainApp");
    if (!app) return;

    const date = $(".topbar .sub");
    if (date && !date.dataset.oxDate) {
      date.dataset.oxDate = "1";
      date.textContent = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric"
      }).format(new Date()).replace(/^./, (letter) => letter.toUpperCase());
    }

    const topbarRight = $(".topbar-right");
    if (topbarRight && !$(".ox-refresh", topbarRight)) {
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "ox-refresh";
      refresh.textContent = "↻ Atualizar";
      refresh.addEventListener("click", async () => {
        refresh.disabled = true;
        refresh.textContent = "Atualizando...";
        try {
          if (typeof window.loadDashboard === "function") await window.loadDashboard();
          else location.reload();
          showToast("Dados atualizados.");
        } finally {
          refresh.disabled = false;
          refresh.textContent = "↻ Atualizar";
        }
      });
      topbarRight.prepend(refresh);
    }

    const search = $(".search input");
    if (search && !search.dataset.oxSearch) {
      search.dataset.oxSearch = "1";
      search.setAttribute("aria-label", "Buscar no dashboard");
      search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase("pt-BR");
        $$("tbody tr").forEach((row) => {
          row.hidden = !!query && !row.textContent.toLocaleLowerCase("pt-BR").includes(query);
        });
      });
    }

    const notification = $('button[aria-label="Notificações"]');
    if (notification && !notification.dataset.oxNotification) {
      notification.dataset.oxNotification = "1";
      notification.addEventListener("click", () => showToast("Nenhuma nova notificação."));
    }

    const dashboardRoutes = [
      ["visão geral", "origenix-dashboard-v3.html"],
      ["clientes", "origenix-sistema-login.html"],
      ["projetos", "origenix-sistema-login.html"],
      ["documentos", "origenix-sistema-login.html"],
      ["rts & art", "origenix-emissao-v3.html"],
      ["licenças", "origenix-sistema-login.html"]
    ];

    $$(".nav-item").forEach((item) => {
      if (item.dataset.oxNav || item.closest("a")) return;
      item.dataset.oxNav = "1";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      const label = item.textContent.replace(/\s+/g, " ").trim();
      const normalizedLabel = label.toLocaleLowerCase("pt-BR");
      const route = dashboardRoutes.find(([prefix]) => normalizedLabel.startsWith(prefix))?.[1];
      if (route) {
        item.setAttribute("aria-label", `Abrir ${label}`);
        item.title = `Abrir ${label}`;
      } else {
        item.setAttribute("aria-label", `${label} — em preparação`);
        item.title = "Módulo em preparação";
      }
      const activate = () => {
        if (route) location.assign(route);
        else showToast(`${label} estará disponível em breve.`);
      };
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });

    const email = $("#userEmail");
    if (email && email.textContent.includes("@") && !email.dataset.oxAvatar) {
      email.dataset.oxAvatar = "1";
      const initials = email.textContent.split("@")[0].split(/[._-]/).filter(Boolean)
        .slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "OX";
      $$(".avatar").forEach((avatar) => {
        if (avatar.textContent !== initials) avatar.textContent = initials;
      });
    }
  }

  function run() {
    addUtilityButtons();
    enhancePasswordFields();
    enhanceAuth();
    enhanceLeadModal();
    enhanceMobileMenu();
    enhanceDashboard();
    improveButtons();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      window.closeLeadModal?.();
      $(".nav-links")?.classList.remove("ox-open");
    }
  });

  run();
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
})();
