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

  function run() {
    addUtilityButtons();
    enhancePasswordFields();
    enhanceAuth();
    enhanceLeadModal();
    enhanceMobileMenu();
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
