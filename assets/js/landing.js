document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const app = window.ORIGENIX;
  const body = document.body;
  const header = document.querySelector("#siteHeader");
  const menuButton = document.querySelector("#menuToggle");
  const nav = document.querySelector("#siteNav");
  const year = String(new Date().getFullYear());

  document.querySelector("#footerYear").textContent = year;
  document.querySelector("#copyrightYear").textContent = year;

  const syncHeader = () => header.classList.toggle("scrolled", window.scrollY > 24);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  function setMenu(open) {
    body.classList.toggle("menu-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  }

  menuButton.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  const moduleContent = {
    empresas: {
      code: "01 / CADASTRO CENTRAL", title: "Gestão por estabelecimento",
      description: "Informações técnicas, responsáveis e registros organizados no contexto correto, com visibilidade compatível com o perfil de acesso.",
      items: ["Cadastro estruturado", "Contexto sanitário", "Vínculos técnicos"],
      label: "ESTABELECIMENTO", status: "ATIVO", name: "Unidade operacional", subtitle: "Perfil técnico consolidado",
      cells: [["INSPEÇÃO", "Contexto registrado"], ["RESPONSÁVEL", "Vínculo técnico"], ["DOCUMENTOS", "Histórico central"], ["PRAZOS", "Monitoramento"]],
    },
    documentos: {
      code: "02 / CONTROLE DOCUMENTAL", title: "Documentos com versão e contexto",
      description: "Rascunhos, emissões e aprovações internas organizados por estabelecimento, com histórico preservado ao longo do trabalho.",
      items: ["Emissão versionada", "Checksum de integridade", "Histórico de atualização"],
      label: "DOCUMENTO TÉCNICO", status: "VERSIONADO", name: "Memorial e programas", subtitle: "Fluxo de elaboração controlado",
      cells: [["CÓDIGO", "Identificação única"], ["VERSÃO", "Evolução registrada"], ["AUTORIA", "Aprovação interna"], ["ARQUIVO", "Sem exclusão de histórico"]],
    },
    projetos: {
      code: "03 / EXECUÇÃO TÉCNICA", title: "Projetos sanitários acompanhados",
      description: "Etapas, progresso, prazo e responsáveis reunidos para dar clareza ao andamento de cada frente técnica.",
      items: ["Etapa atual", "Progresso registrado", "Prazo e responsável"],
      label: "PROJETO SANITÁRIO", status: "EM CURSO", name: "Plano de adequação", subtitle: "Acompanhamento por etapa",
      cells: [["ESCOPO", "Frente definida"], ["ETAPA", "Andamento atual"], ["PRAZO", "Marco monitorado"], ["RESPONSÁVEL", "Atribuição técnica"]],
    },
    auditorias: {
      code: "04 / VERIFICAÇÃO", title: "Auditorias com plano de ação",
      description: "Registros de auditoria, resultados, não conformidades e ações corretivas mantidos na mesma trilha operacional.",
      items: ["Não conformidades", "Plano de ação", "Resultado e anexos"],
      label: "AUDITORIA INTERNA", status: "PLANEJADA", name: "Verificação operacional", subtitle: "Controle de evidências",
      cells: [["TIPO", "Escopo definido"], ["DATA", "Agenda controlada"], ["RESULTADO", "Registro técnico"], ["AÇÃO", "Tratativa acompanhada"]],
    },
    licencas: {
      code: "05 / PRAZOS REGULATÓRIOS", title: "Licenças e ARTs monitoradas",
      description: "Números, órgãos, emissão e vencimento organizados para reduzir o risco de perda de prazo regulatório.",
      items: ["Datas de vencimento", "Órgão emissor", "Situação atual"],
      label: "LICENÇA / ART", status: "MONITORADA", name: "Controle regulatório", subtitle: "Prazos por estabelecimento",
      cells: [["NÚMERO", "Registro vinculado"], ["ÓRGÃO", "Origem identificada"], ["EMISSÃO", "Data registrada"], ["VENCIMENTO", "Alerta operacional"]],
    },
    rastreabilidade: {
      code: "06 / HISTÓRICO", title: "Rastreabilidade da operação",
      description: "A plataforma mantém eventos e relações entre empresas, documentos, projetos e responsáveis dentro do escopo autorizado.",
      items: ["Histórico por registro", "Eventos relacionados", "Acesso por perfil"],
      label: "TRILHA OPERACIONAL", status: "CONTROLADA", name: "Linha do tempo técnica", subtitle: "Contexto preservado",
      cells: [["EVENTO", "Ação registrada"], ["USUÁRIO", "Perfil identificado"], ["CONTEXTO", "Empresa relacionada"], ["TEMPO", "Ordem cronológica"]],
    },
  };

  function moduleTemplate(data) {
    return `
      <div class="module-copy"><span>${data.code}</span><h3>${data.title}</h3><p>${data.description}</p><ul>${data.items.map((item) => `<li>${item}</li>`).join("")}</ul></div>
      <div class="module-visual" aria-hidden="true">
        <div class="visual-head"><span>${data.label}</span><i>${data.status}</i></div>
        <div class="visual-title"><b>${data.name}</b><small>${data.subtitle}</small></div>
        <div class="visual-grid">${data.cells.map(([key, value]) => `<span><small>${key}</small><b>${value}</b></span>`).join("")}</div>
        <div class="visual-progress"><span><i></i></span><small>Fluxo de dados por perfil</small></div>
      </div>`;
  }

  document.querySelectorAll("[data-module-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-module-tab]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      const stage = document.querySelector("#moduleStage");
      stage.classList.add("switching");
      window.setTimeout(() => {
        stage.innerHTML = moduleTemplate(moduleContent[button.dataset.moduleTab]);
        stage.classList.remove("switching");
      }, 120);
    });
  });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const revealTargets = document.querySelectorAll(".section-heading, .solution-card, .workflow-steps li, .benefit-list article, .difference-grid article, .implementation-track article");
    revealTargets.forEach((target) => target.classList.add("reveal"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: "0px 0px -40px" });
    revealTargets.forEach((target) => observer.observe(target));
  }

  const form = document.querySelector("#leadForm");
  const status = document.querySelector("#leadStatus");
  const submit = document.querySelector("#leadSubmit");

  function showStatus(message, type) {
    status.hidden = !message;
    status.textContent = message;
    status.className = `form-status ${type || ""}`.trim();
  }

  form.elements.telefone.addEventListener("input", (event) => {
    const digits = app.digits(event.target.value).slice(0, 11);
    event.target.value = digits.length > 10
      ? digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3")
      : digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("");
    if (form.elements.website.value) return;

    const lastLead = Number(sessionStorage.getItem("origenix-last-lead") || 0);
    if (Date.now() - lastLead < 60_000) {
      showStatus("Aguarde um minuto antes de enviar outra solicitação.", "error");
      return;
    }

    const lead = {
      nome: app.cleanText(form.elements.nome.value, 160),
      empresa: app.cleanText(form.elements.empresa.value, 200) || null,
      email: app.cleanText(form.elements.email.value, 320).toLowerCase() || null,
      telefone: app.cleanText(form.elements.telefone.value, 30) || null,
      mensagem: app.cleanText(form.elements.mensagem.value, 3000) || null,
      origem: "landing_page",
      status: "novo",
    };

    if (lead.nome.length < 2 || !lead.empresa || !app.validEmail(lead.email)) {
      showStatus("Preencha nome, empresa e um e-mail profissional válido.", "error");
      form.querySelector(":invalid")?.focus();
      return;
    }

    app.setBusy(submit, true, "Enviando diagnóstico...");
    try {
      const { error } = await app.client.from("leads").insert(lead);
      if (error) throw error;
      sessionStorage.setItem("origenix-last-lead", String(Date.now()));
      form.reset();
      showStatus("Solicitação recebida. A equipe ORIGENIX fará o retorno pelos dados informados.", "success");
    } catch (error) {
      console.error(error);
      showStatus(app.friendlyError(error), "error");
    } finally {
      app.setBusy(submit, false);
    }
  });
});
