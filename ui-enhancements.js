(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isHome = /(^|\/)index\.html$/.test(location.pathname) || location.pathname === "/";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!$('link[data-ox-v4]')) {
    const designSystem = document.createElement("link");
    designSystem.rel = "stylesheet";
    designSystem.href = "origenix-v4.css?v=4.3";
    designSystem.dataset.oxV4 = "1";
    document.head.appendChild(designSystem);
  }

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
    .ox-command-overlay{position:fixed;inset:0;z-index:280;background:rgba(0,0,0,.76);backdrop-filter:blur(8px);
      display:none;align-items:flex-start;justify-content:center;padding:12vh 18px 24px}.ox-command-overlay.show{display:flex}
    .ox-command{width:min(620px,100%);background:#121214;border:1px solid rgba(255,60,60,.34);
      border-radius:14px;box-shadow:0 34px 90px rgba(0,0,0,.72);overflow:hidden}
    .ox-command-head{display:flex;align-items:center;gap:12px;padding:15px;border-bottom:1px solid rgba(255,60,60,.2)}
    .ox-command-head input{flex:1;min-width:0;background:#090909;border:1px solid rgba(255,60,60,.25);
      color:#fff;border-radius:9px;padding:13px 14px;font:500 14px Inter,sans-serif;outline:none}
    .ox-command-head input:focus{border-color:#ff1a1a}.ox-command-close{border:0;background:transparent;color:#aaa;
      width:38px;height:38px;border-radius:8px;font-size:20px;cursor:pointer}.ox-command-close:hover{background:#242426;color:#fff}
    .ox-command-list{padding:9px;max-height:54vh;overflow:auto}.ox-command-item{display:flex;align-items:center;
      justify-content:space-between;gap:16px;padding:13px 14px;border-radius:9px;color:#fff;text-decoration:none;
      font:600 13px Montserrat,Inter,sans-serif}.ox-command-item:hover,.ox-command-item:focus{background:#241313;outline:none}
    .ox-command-item span{color:#8d8d93;font:500 11px Inter,sans-serif}.ox-command-empty{padding:26px;text-align:center;color:#929297;
      font:500 13px Inter,sans-serif}.ox-command-hint{padding:10px 14px;border-top:1px solid rgba(255,60,60,.16);
      color:#777;font:500 10px Montserrat,Inter,sans-serif;text-align:right}
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

    const menu = document.createElement("button");
    menu.type = "button";
    menu.textContent = "⌘ Menu";
    menu.setAttribute("aria-label", "Abrir menu rápido");
    menu.addEventListener("click", openCommandMenu);
    box.appendChild(menu);

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

  function hydrateSharedImages() {
    const source = $('img[src^="data:image/"]');
    if (!source) return;
    $$("img[data-ox-logo-copy]").forEach((image) => {
      if (!image.getAttribute("src")) image.src = source.src;
    });
  }

  const commandItems = [
    ["Dashboard", "Visão geral e indicadores", "origenix-dashboard-v3.html"],
    ["Novo cadastro", "Cadastrar estabelecimento", "origenix-sistema-login.html?view=new"],
    ["Clientes e documentos", "Gerenciar estabelecimentos", "origenix-sistema-login.html?view=clients"],
    ["Programas de autocontrole", "PAC, APPCC, PPHO e auditorias", "origenix-pacs.html"],
    ["Emissão e assinatura", "Documentos prontos para assinatura", "origenix-emissao-v3.html"],
    ["Recuperar senha", "Redefinir acesso", "recuperar-senha.html"],
    ["Site institucional", "Voltar ao site público", "index.html"]
  ];

  function ensureCommandMenu() {
    if ($("#oxCommandOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "oxCommandOverlay";
    overlay.className = "ox-command-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Menu rápido");
    overlay.innerHTML = `
      <div class="ox-command">
        <div class="ox-command-head">
          <input id="oxCommandSearch" type="search" placeholder="Buscar tela ou ação..." autocomplete="off">
          <button class="ox-command-close" type="button" aria-label="Fechar menu">×</button>
        </div>
        <div class="ox-command-list" id="oxCommandList"></div>
        <div class="ox-command-hint">Ctrl + K para abrir · Esc para fechar</div>
      </div>
    `;
    document.body.appendChild(overlay);
    $(".ox-command-close", overlay).addEventListener("click", closeCommandMenu);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeCommandMenu();
    });
    $("#oxCommandSearch", overlay).addEventListener("input", renderCommandItems);
    $("#oxCommandSearch", overlay).addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const selected = $('.ox-command-item[aria-selected="true"]', overlay);
        if (selected) selected.click();
      }
    });
    renderCommandItems();
  }

  function renderCommandItems() {
    const list = $("#oxCommandList");
    if (!list) return;
    const query = ($("#oxCommandSearch")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const filtered = commandItems.filter(([title, detail]) =>
      `${title} ${detail}`.toLocaleLowerCase("pt-BR").includes(query)
    );
    list.innerHTML = filtered.length
      ? filtered.map(([title, detail, href]) =>
        `<a class="ox-command-item" href="${href}" role="option" aria-selected="false">${title}<span>${detail}</span></a>`
      ).join("")
      : '<div class="ox-command-empty">Nenhuma ação encontrada.</div>';
    selectCommandItem(0);
  }

  function selectCommandItem(index) {
    const items = $$(".ox-command-item");
    if (!items.length) return;
    const normalized = (index + items.length) % items.length;
    items.forEach((item, itemIndex) =>
      item.setAttribute("aria-selected", String(itemIndex === normalized))
    );
    items[normalized].scrollIntoView({ block: "nearest" });
  }

  function openCommandMenu() {
    ensureCommandMenu();
    $("#oxCommandOverlay").classList.add("show");
    document.body.style.overflow = "hidden";
    const input = $("#oxCommandSearch");
    input.value = "";
    renderCommandItems();
    setTimeout(() => input.focus(), 0);
  }

  function closeCommandMenu() {
    $("#oxCommandOverlay")?.classList.remove("show");
    document.body.style.overflow = "";
  }

  function enhancePasswordFields() {
    $$('input[type="password"]').forEach((input) => {
      if (input.dataset.oxEnhanced) return;
      input.dataset.oxEnhanced = "1";
      const originalParent = input.parentElement;
      const needsWrapper = originalParent.querySelectorAll("input, select, textarea").length > 1;
      const parent = needsWrapper ? document.createElement("div") : originalParent;
      if (needsWrapper) {
        originalParent.insertBefore(parent, input);
        parent.appendChild(input);
      }
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
      if (button.dataset.oxButton) return;
      button.dataset.oxButton = "1";
      if (!button.getAttribute("type")) button.type = "button";
      if (!button.getAttribute("aria-label") && !button.textContent.trim()) {
        button.setAttribute("aria-label", button.title || "Ação");
      }
      button.addEventListener("pointerdown", (event) => {
        if (reduceMotion || button.disabled) return;
        const bounds = button.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "ox-ripple";
        ripple.style.left = `${event.clientX - bounds.left}px`;
        ripple.style.top = `${event.clientY - bounds.top}px`;
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
        button.appendChild(ripple);
      });
    });
  }

  function setButtonLoading(button, loading, label = "Processando...") {
    if (!button) return;
    if (loading) {
      if (button.dataset.oxLoading === "1") return;
      button.dataset.oxLoading = "1";
      button.dataset.oxLabel = button.innerHTML;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.innerHTML = `<span class="ox-button-spinner" aria-hidden="true"></span><span>${label}</span>`;
      return;
    }
    if (button.dataset.oxLoading !== "1") return;
    button.innerHTML = button.dataset.oxLabel || button.textContent;
    delete button.dataset.oxLabel;
    delete button.dataset.oxLoading;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }

  function openFormDialog(options = {}) {
    const {
      title = "Confirmar ação",
      description = "",
      fields = [],
      confirmLabel = "Confirmar",
      cancelLabel = "Cancelar",
      danger = false
    } = options;
    const activeElement = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "ox-dialog-overlay";
    const fieldMarkup = fields.map((field, index) => {
      const id = `oxDialogField${Date.now()}${index}`;
      const required = field.required === false ? "" : "required";
      if (field.type === "select") {
        const choices = (field.options || []).map((choice) =>
          `<option value="${escapeAttribute(choice.value)}"${String(choice.value) === String(field.value ?? "") ? " selected" : ""}>${escapeHtmlText(choice.label)}</option>`
        ).join("");
        return `<div class="ox-dialog-field"><label for="${id}">${escapeHtmlText(field.label)}</label>
          <select id="${id}" name="${escapeAttribute(field.name)}" ${required}>${choices}</select></div>`;
      }
      const tag = field.type === "textarea" ? "textarea" : "input";
      const type = tag === "input" ? ` type="${escapeAttribute(field.type || "text")}"` : "";
      const placeholder = field.placeholder ? ` placeholder="${escapeAttribute(field.placeholder)}"` : "";
      const value = tag === "input" && field.value ? ` value="${escapeAttribute(field.value)}"` : "";
      return `<div class="ox-dialog-field"><label for="${id}">${escapeHtmlText(field.label)}</label>
        <${tag} id="${id}" name="${escapeAttribute(field.name)}"${type}${placeholder}${value} ${required}>${tag === "textarea" ? escapeHtmlText(field.value || "") : ""}</${tag}></div>`;
    }).join("");
    overlay.innerHTML = `<section class="ox-dialog" role="dialog" aria-modal="true" aria-labelledby="oxDialogTitle">
      <header class="ox-dialog-header"><div><h2 class="ox-dialog-title" id="oxDialogTitle">${escapeHtmlText(title)}</h2>
      ${description ? `<p class="ox-dialog-description">${escapeHtmlText(description)}</p>` : ""}</div>
      <button class="ox-dialog-close" type="button" aria-label="Fechar diálogo">×</button></header>
      <form><div class="ox-dialog-body">${fieldMarkup}<p class="ox-dialog-error" role="alert"></p></div>
      <footer class="ox-dialog-actions"><button class="ox-dialog-cancel" type="button">${escapeHtmlText(cancelLabel)}</button>
      <button class="ox-dialog-confirm${danger ? " danger" : ""}" type="submit">${escapeHtmlText(confirmLabel)}</button></footer></form>
      </section>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    return new Promise((resolve) => {
      const form = $("form", overlay);
      const cancel = $(".ox-dialog-cancel", overlay);
      const close = $(".ox-dialog-close", overlay);
      const error = $(".ox-dialog-error", overlay);
      const focusable = () => $$("button, input, select, textarea", overlay)
        .filter((element) => !element.disabled);
      const finish = (value) => {
        overlay.remove();
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKeydown, true);
        if (activeElement instanceof HTMLElement) activeElement.focus();
        resolve(value);
      };
      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
          return;
        }
        if (event.key !== "Tab") return;
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      cancel.addEventListener("click", () => finish(null));
      close.addEventListener("click", () => finish(null));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(null);
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const values = {};
        fields.forEach((field) => {
          values[field.name] = form.elements[field.name].value.trim();
        });
        const emptyRequired = fields.find((field) => field.required !== false && !values[field.name]);
        if (emptyRequired) {
          error.textContent = `Preencha o campo “${emptyRequired.label}”.`;
          error.classList.add("show");
          form.elements[emptyRequired.name].focus();
          return;
        }
        finish(values);
      });
      document.addEventListener("keydown", onKeydown, true);
      requestAnimationFrame(() => {
        const target = $("input, textarea, select", overlay) || close;
        target.focus();
      });
    });
  }

  function escapeHtmlText(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function escapeAttribute(value) {
    return escapeHtmlText(value).replace(/"/g, "&quot;");
  }

  function addAccessibilityFoundation() {
    const main = $("main") || $("#mainApp") || $(".app");
    if (main && !main.id) main.id = "oxMainContent";
    if (!$(".ox-skip-link") && main?.id) {
      const skip = document.createElement("a");
      skip.className = "ox-skip-link";
      skip.href = `#${main.id}`;
      skip.textContent = "Pular para o conteúdo";
      document.body.prepend(skip);
    }
  }

  function addBreadcrumbs() {
    if (isHome || $(".ox-breadcrumbs")) return;
    const main = $("main");
    if (!main) return;
    const titles = {
      "origenix-dashboard-v3.html": "Dashboard",
      "origenix-sistema-login.html": "Clientes e documentos",
      "origenix-emissao-v3.html": "Emissão e assinatura",
      "origenix-pacs.html": "Programas de autocontrole",
      "recuperar-senha.html": "Recuperar senha"
    };
    const current = titles[location.pathname.split("/").pop() || ""];
    if (!current) return;
    const breadcrumbs = document.createElement("nav");
    breadcrumbs.className = "ox-breadcrumbs";
    breadcrumbs.setAttribute("aria-label", "Navegação estrutural");
    breadcrumbs.innerHTML = `<a href="origenix-dashboard-v3.html">Início</a><span aria-hidden="true">/</span><span aria-current="page">${current}</span>`;
    main.prepend(breadcrumbs);
  }

  function addNetworkStatus() {
    if ($(".ox-network-status")) return;
    const status = document.createElement("div");
    status.className = "ox-network-status";
    status.setAttribute("role", "status");
    document.body.appendChild(status);
    const update = () => {
      status.textContent = navigator.onLine
        ? "Conexão restabelecida. Os dados podem ser atualizados."
        : "Você está offline. Alterações não serão enviadas.";
      status.classList.add("show");
      clearTimeout(addNetworkStatus.timer);
      if (navigator.onLine) {
        addNetworkStatus.timer = setTimeout(() => status.classList.remove("show"), 3200);
      }
    };
    addEventListener("online", update);
    addEventListener("offline", update);
    if (!navigator.onLine) update();
  }

  function markActiveNavigation() {
    const current = location.pathname.split("/").pop() || "index.html";
    $$(`a[href="${current}"]`).forEach((link) => {
      link.setAttribute("aria-current", "page");
      link.classList.add("ox-active-route");
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

    const content = $(".content", app);
    if (content && !$(".ox-dashboard-actions", content)) {
      const actions = document.createElement("nav");
      actions.className = "ox-dashboard-actions";
      actions.setAttribute("aria-label", "Ações rápidas");
      actions.innerHTML = `
        <a class="ox-dashboard-action ox-action-primary" href="origenix-sistema-login.html?view=new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          <div><strong>Novo cadastro</strong><span>Adicionar estabelecimento</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-sistema-login.html?view=clients">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v2M17 8h4M19 6v4"/></svg>
          <div><strong>Clientes</strong><span>Consultar e editar</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-pacs.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"/></svg>
          <div><strong>PACs</strong><span>Autocontrole e APPCC</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-sistema-login.html?view=documents">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8"/></svg>
          <div><strong>Novo documento</strong><span>Emitir e versionar</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-emissao-v3.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.4 8-8 10-4.6-2-8-5-8-10V7zM9 12l2 2 4-5"/></svg>
          <div><strong>Assinaturas</strong><span>Revisar documentos</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-sistema-login.html?view=tasks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <div><strong>Tarefas</strong><span>Prazos e agenda</span></div>
        </a>
        <a class="ox-dashboard-action" href="origenix-sistema-login.html?view=notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/></svg>
          <div><strong>Notificações</strong><span>Pendências críticas</span></div>
        </a>`;
      content.prepend(actions);
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
      ["clientes", "origenix-sistema-login.html?view=clients"],
      ["projetos", "origenix-pacs.html"],
      ["documentos", "origenix-sistema-login.html?view=documents"],
      ["rts & art", "origenix-emissao-v3.html"],
      ["licenças", "origenix-sistema-login.html?view=clients"],
      ["auditorias", "origenix-pacs.html"]
    ];

    $$(".nav-item").forEach((item) => {
      if (item.dataset.oxNav || item.closest("a")) return;
      item.dataset.oxNav = "1";
      item.classList.add("ox-nav-ready");
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
    hydrateSharedImages();
    addAccessibilityFoundation();
    addUtilityButtons();
    addBreadcrumbs();
    addNetworkStatus();
    enhancePasswordFields();
    enhanceAuth();
    enhanceLeadModal();
    enhanceMobileMenu();
    enhanceDashboard();
    markActiveNavigation();
    improveButtons();
  }

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandMenu();
      return;
    }
    if (event.key === "Escape") {
      closeCommandMenu();
      window.closeLeadModal?.();
      $(".nav-links")?.classList.remove("ox-open");
    }
    if ($("#oxCommandOverlay")?.classList.contains("show") && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const items = $$(".ox-command-item");
      if (!items.length) return;
      const current = items.findIndex((item) => item.getAttribute("aria-selected") === "true");
      selectCommandItem(current + (event.key === "ArrowDown" ? 1 : -1));
    }
  });

  run();
  let scheduled = false;
  new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches("button, input[type='password']") ||
        node.querySelector("button, input[type='password']");
    }));
    if (!relevant) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      improveButtons();
      enhancePasswordFields();
    });
  }).observe(document.body, { childList: true, subtree: true });

  window.OrigenixUI = Object.freeze({
    showToast,
    setButtonLoading,
    openFormDialog,
    openCommandMenu,
    closeCommandMenu
  });
})();
