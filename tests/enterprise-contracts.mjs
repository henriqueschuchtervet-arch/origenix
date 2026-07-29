import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

const root = process.env.ORIGENIX_ROOT || process.cwd();
const results = [];

async function source(path) {
  return readFile(join(root, path), "utf8");
}

function contract(name, check) {
  try {
    check();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function includesAll(text, values) {
  values.forEach((value) => assert.ok(
    text.includes(value),
    `Marcador obrigatório ausente: ${value}`,
  ));
}

const requiredFiles = [
  "index.html",
  "origenix-dashboard-v3.html",
  "origenix-emissao-v3.html",
  "origenix-sistema-login.html",
  "origenix-pacs.html",
  "recuperar-senha.html",
  "ui-enhancements.js",
  "origenix-v4.css",
  "_headers",
  "README.md",
  "SYSTEM_AUDIT.md",
];

const files = Object.fromEntries(await Promise.all(
  requiredFiles.map(async (path) => [path, await source(path)]),
));

contract("arquivos essenciais existem", () => {
  requiredFiles.forEach((path) => assert.ok(files[path].length > 0, `${path} está vazio`));
});

contract("JavaScript compartilhado possui sintaxe válida", () => {
  new vm.Script(files["ui-enhancements.js"], { filename: "ui-enhancements.js" });
});

contract("JavaScript inline possui sintaxe válida", () => {
  for (const path of requiredFiles.filter((name) => name.endsWith(".html"))) {
    const scripts = [...files[path].matchAll(
      /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    )];
    scripts.forEach((match, index) => {
      new vm.Script(match[1], { filename: `${path}:inline-${index + 1}` });
    });
  }
});

contract("recuperação de senha está completa", () => {
  includesAll(files["recuperar-senha.html"], [
    "resetPasswordForEmail",
    "PASSWORD_RECOVERY",
    "updateUser",
  ]);
});

contract("emissão preserva numeração e versionamento", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "proximo_codigo_documento",
    "documento_versoes",
    "hash_sha256",
    "crypto.randomUUID",
  ]);
});

contract("gestão de empresas não executa exclusão física", () => {
  const system = files["origenix-sistema-login.html"];
  assert.ok(!system.includes(".from('empresas').delete("), "exclusão física de empresas detectada");
  includesAll(system, ["arquivado_em", "alterarSituacaoCliente", "ativo: restaurar"]);
});

contract("listagem de empresas é paginada no servidor", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "CLIENT_PAGE_SIZE = 20",
    ".range(from, to)",
    "{ count: 'exact' }",
    "window.setTimeout(reiniciarListaClientes, 320)",
    "clientRequestSequence",
  ]);
});

contract("visão 360 respeita o escopo da empresa", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "abrirDetalhesCliente",
    "countQuery('documentos')",
    "countQuery('empresa_pacs')",
    "countQuery('tarefas')",
    "countQuery('auditorias')",
    ".eq('empresa_id', id)",
  ]);
});

contract("PACs preservam contexto e validam empresa permitida", () => {
  includesAll(files["origenix-pacs.html"], [
    "new URLSearchParams(location.search).get('empresa')",
    "company.id===requestedCompany",
    "history.replaceState",
  ]);
});

contract("camada de UX possui acessibilidade e feedback", () => {
  includesAll(files["ui-enhancements.js"], [
    "openFormDialog",
    "setButtonLoading",
    "aria-modal",
    "MutationObserver",
  ]);
  assert.ok(
    files["origenix-v4.css"].includes(":focus-visible"),
    "estado de foco visível ausente do CSS compartilhado",
  );
});

const migrationDir = join(root, "supabase", "migrations");
const migrationNames = (await readdir(migrationDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

contract("migrations são sequenciais e completas", () => {
  assert.equal(migrationNames.length, 22, "esperadas exatamente 22 migrations");
  migrationNames.forEach((name, index) => {
    const expected = String(index + 1).padStart(3, "0");
    assert.ok(name.startsWith(`${expected}_`), `sequência inválida em ${name}`);
  });
});

const migrations = (await Promise.all(
  migrationNames.map((name) => source(join("supabase", "migrations", name))),
)).join("\n");

contract("RLS e papéis permanecem versionados", () => {
  includesAll(migrations.toLowerCase(), [
    "enable row level security",
    "administrador",
    "consultor",
    "cliente",
    "empresa_membros",
  ]);
});

contract("tabela legada de usuários permanece bloqueada", () => {
  includesAll(migrations, [
    "usuarios_legacy_deny_all",
    "revoke all on table public.usuarios from anon, authenticated",
    "using (false)",
    "with check (false)",
  ]);
});

contract("Netlify aplica cabeçalhos de segurança", () => {
  includesAll(files["_headers"], [
    "Content-Security-Policy:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy:",
    "Strict-Transport-Security:",
  ]);
});

contract("botões e links internos possuem comportamento real", () => {
  const htmlFiles = requiredFiles.filter((name) => name.endsWith(".html"));
  const sharedUi = files["ui-enhancements.js"];

  for (const path of htmlFiles) {
    const html = files[path];
    const buttons = [...html.matchAll(/<button\b([^>]*)>/gi)];
    for (const [index, match] of buttons.entries()) {
      const attributes = match[1];
      const id = attributes.match(/\bid=["']([^"']+)/i)?.[1];
      const ariaLabel = attributes.match(/\baria-label=["']([^"']+)/i)?.[1];
      const hasInlineAction = /\bonclick\s*=/i.test(attributes);
      const submitsForm = /\btype=["']submit/i.test(attributes);
      const referencedById = id && (
        html.includes(`getElementById('${id}')`)
        || html.includes(`getElementById("${id}")`)
        || new RegExp(`\\$\\(['"]${id}['"]\\)`).test(html)
      );
      const enhancedBySharedUi = ariaLabel
        && sharedUi.includes(`button[aria-label="${ariaLabel}"]`);

      assert.ok(
        hasInlineAction || submitsForm || referencedById || enhancedBySharedUi,
        `${path}: botão ${index + 1} não possui ação detectável`,
      );
    }

    const links = [...html.matchAll(/<a\b([^>]*)>/gi)];
    for (const [index, match] of links.entries()) {
      const attributes = match[1];
      assert.ok(
        !/href=["']javascript:/i.test(attributes),
        `${path}: link ${index + 1} usa URL JavaScript`,
      );
      const hash = attributes.match(/\bhref=["']#([^"']*)/i)?.[1];
      if (hash) {
        assert.ok(
          html.includes(`id="${hash}"`) || html.includes(`id='${hash}'`),
          `${path}: link ${index + 1} aponta para #${hash}, mas o destino não existe`,
        );
      } else if (/\bhref=["']#["']/i.test(attributes)) {
        assert.ok(
          /\bonclick\s*=/i.test(attributes),
          `${path}: link ${index + 1} usa # sem ação`,
        );
      }
    }
  }
});

contract("atalhos abrem o fluxo solicitado", () => {
  includesAll(files["ui-enhancements.js"], [
    "origenix-sistema-login.html?view=new",
    "origenix-sistema-login.html?view=clients",
    "origenix-sistema-login.html?view=documents",
  ]);
  includesAll(files["origenix-sistema-login.html"], [
    "async function aplicarRotaInicial",
    "get('view') || 'clients'",
    "view === 'new'",
    "view === 'documents'",
  ]);
});

contract("biblioteca documental é pesquisável e paginada", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"tab-documentos\"",
    "DOCUMENT_PAGE_SIZE = 20",
    "DOCUMENT_FIELDS",
    "empresas(nome)",
    "async function renderDocumentList",
    "agendarBuscaDocumentos",
    "mudarPaginaDocumentos",
    "copiarCodigoDocumento",
    "abrirEmpresaDoDocumento",
  ]);
});

contract("dossiê documental exibe versões e anexos com segurança", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"documentDossierOverlay\"",
    "async function abrirDossieDocumento",
    "from('documento_versoes')",
    "from('anexos')",
    ".eq('documento_id', id)",
    "urlSeguraAnexo",
    "parsed.protocol === 'https:'",
    "copiarHashDocumento",
    "documentDossierReturnFocus.focus()",
  ]);
});

contract("storage documental permanece privado e limitado por RLS", () => {
  includesAll(migrations, [
    "'documentos'",
    "false",
    "10485760",
    "documentos_storage_select",
    "documentos_storage_insert",
    "documentos_storage_delete",
    "storage.foldername(name)",
    "private.pode_acessar_documento",
    "private.tem_papel",
  ]);
});

contract("upload documental valida, assina e desfaz falhas parciais", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "createSignedUrl(attachment.url, 300)",
    "async function enviarAnexoDocumento",
    "file.size > 10485760",
    "allowedTypes.has(file.type)",
    ".storage.from('documentos').upload(objectPath",
    "from('anexos').insert",
    ".storage.from('documentos').remove([objectPath])",
    "setButtonLoading",
    "documentAttachmentInput",
  ]);
});

contract("exclusão de anexos é autorizada e auditada", () => {
  includesAll(migrations, [
    "public.excluir_anexo_auditado",
    "Perfil sem permissão para excluir anexos.",
    "private.pode_acessar_documento",
    "'ANEXO_EXCLUIDO'",
    "jsonb_build_object",
    "grant execute on function public.excluir_anexo_auditado",
    "alter function public.excluir_anexo_auditado(uuid)",
    "security invoker",
  ]);
  includesAll(files["origenix-sistema-login.html"], [
    "async function excluirAnexoDocumento",
    "title:'Excluir anexo?'",
    "danger:true",
    "objectPath.startsWith(documentId + '/')",
    "supa.rpc('excluir_anexo_auditado'",
    "Anexo excluído e ação registrada.",
  ]);
});

contract("trilha de auditoria é imutável para usuários da aplicação", () => {
  includesAll(migrations, [
    "drop policy if exists auditorias_update",
    "drop policy if exists auditorias_delete",
    "revoke update, delete on table public.auditorias from authenticated",
    "revoke all on table public.auditorias from authenticated",
    "grant select, insert on table public.auditorias to authenticated",
    "private.auditar_exclusao_anexo",
    "create trigger auditar_exclusao_anexo",
    "drop policy if exists auditorias_insert",
    "revoke insert on table public.auditorias from authenticated",
    "grant select on table public.auditorias to authenticated",
  ]);
});

contract("auditoria usa identidade real e índices de consulta", () => {
  includesAll(migrations, [
    "references auth.users(id)",
    "on delete set null",
    "idx_auditorias_created_at",
    "idx_auditorias_empresa_created_at",
    "idx_auditorias_acao_created_at",
  ]);
});

contract("central de auditoria é filtrável, paginada e somente leitura", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"tab-auditoria\"",
    "data-tab=\"auditoria\"",
    "AUDIT_PAGE_SIZE = 25",
    "async function renderAuditList",
    "async function getAuditEvents",
    "empresas(nome)",
    "auditCompanyFilter",
    "auditActionFilter",
    "auditDateFrom",
    "auditDateTo",
    "mudarPaginaAuditoria",
    "view === 'audit'",
    "Rastreabilidade imutável",
  ]);
});

contract("operações principais geram auditoria no banco", () => {
  includesAll(migrations, [
    "private.auditar_empresa_operacao",
    "create trigger auditar_empresa_operacao",
    "'EMPRESA_CRIADA'",
    "'EMPRESA_ATUALIZADA'",
    "'EMPRESA_ARQUIVADA'",
    "'EMPRESA_RESTAURADA'",
    "private.auditar_documento_operacao",
    "create trigger auditar_documento_operacao",
    "'DOCUMENTO_EMITIDO'",
    "'DOCUMENTO_STATUS_ALTERADO'",
    "revoke all on function private.auditar_empresa_operacao",
    "revoke all on function private.auditar_documento_operacao",
  ]);
});

contract("exportação da auditoria é limitada, rastreável e imutável", () => {
  includesAll(migrations, [
    "create table if not exists public.auditoria_exportacoes",
    "total_registros between 0 and 2000",
    "auditoria_exportacoes_select",
    "auditoria_exportacoes_insert",
    "grant select, insert on table public.auditoria_exportacoes",
    "private.auditar_exportacao",
    "create trigger auditar_exportacao",
    "'AUDITORIA_EXPORTADA'",
    "revoke all on function private.auditar_exportacao",
  ]);
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"auditExportButton\"",
    "async function exportarAuditoriaCSV",
    "function valorSeguroCSV",
    "/^[=+\\-@\\t\\r]/",
    ".limit(2000)",
    "from('auditoria_exportacoes').insert",
    "Download cancelado.",
    "URL.revokeObjectURL",
    "setButtonLoading",
  ]);
});

contract("tarefas possuem prazos, prioridades e índices operacionais", () => {
  includesAll(migrations, [
    "add column if not exists prioridade",
    "add column if not exists prazo",
    "add column if not exists concluida_em",
    "tarefas_prioridade_check",
    "idx_tarefas_empresa_status_prazo",
    "idx_tarefas_responsavel_status_prazo",
  ]);
});

contract("notificações usam dados reais e leitura isolada por usuário", () => {
  includesAll(migrations, [
    "create table if not exists public.notificacao_leituras",
    "references auth.users(id)",
    "unique (usuario_id, tipo, referencia_id)",
    "notificacao_leituras_select",
    "notificacao_leituras_insert",
    "notificacao_leituras_update",
    "grant select, insert, update on table public.notificacao_leituras",
  ]);
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"tab-notificacoes\"",
    "data-tab=\"notificacoes\"",
    "id=\"notificationTrigger\"",
    "async function carregarNotificacoes",
    "from('tarefas')",
    ".in('status',['em_revisao','gerado'])",
    "function classificarTarefa",
    "async function marcarNotificacaoLida",
    "from('notificacao_leituras').upsert",
    "async function abrirDocumentoNotificacao",
    "view === 'notifications'",
  ]);
});

contract("tarefas usam identidade real, papéis e auditoria interna", () => {
  includesAll(migrations, [
    "tarefas_responsavel_fkey",
    "references auth.users(id)",
    "add column if not exists criado_por",
    "tarefas_status_check",
    "private.tem_papel(array['administrador', 'rt', 'consultor'])",
    "private.preparar_tarefa",
    "private.auditar_tarefa_operacao",
    "create trigger auditar_tarefa_operacao",
    "'TAREFA_CRIADA'",
    "'TAREFA_CONCLUIDA'",
    "'TAREFA_EXCLUIDA'",
  ]);
});

contract("gestão de tarefas possui CRUD, agenda e feedback", () => {
  includesAll(files["origenix-sistema-login.html"], [
    "id=\"tab-tarefas\"",
    "data-tab=\"tarefas\"",
    "TASK_PAGE_SIZE = 25",
    "async function renderTasks",
    "async function abrirFormularioTarefa",
    "async function concluirTarefa",
    "async function excluirTarefa",
    "function alterarVisualizacaoTarefas",
    "function mudarMesAgenda",
    "carregarMetricasTarefas",
    "from('tarefas').insert",
    "from('tarefas').update",
    "from('tarefas').delete",
    "view === 'tasks'",
  ]);
});

contract("diálogo compartilhado preserva valores em edição", () => {
  includesAll(files["ui-enhancements.js"], [
    "field.value ?? \"\"",
    "\" selected\"",
    "tag === \"textarea\" ? escapeHtmlText(field.value || \"\")",
  ]);
});

contract("dashboard executivo exibe prioridades e somente rotas funcionais", () => {
  includesAll(files["origenix-dashboard-v3.html"], [
    "id=\"kpiTarefasVencidas\"",
    "id=\"kpiDocumentosRevisao\"",
    "id=\"agendaList\"",
    "id=\"criticalAlertsList\"",
    "origenix-sistema-login.html?view=tasks",
    "origenix-sistema-login.html?view=notifications",
    "origenix-sistema-login.html?view=audit",
    "async function loadDashboard",
    "from('tarefas').select(taskFields",
    ".eq('status','em_revisao')",
    "function operationalRow",
    "formatDashboardDeadline",
  ]);
  assert.ok(
    !files["origenix-dashboard-v3.html"].includes("Faturamento"),
    "dashboard ainda exibe módulo inerte de faturamento",
  );
  includesAll(files["ui-enhancements.js"], [
    "origenix-sistema-login.html?view=tasks",
    "origenix-sistema-login.html?view=notifications",
  ]);
});

contract("autenticação compartilha superfície visual sem sobrepor abas", () => {
  includesAll(files["origenix-dashboard-v3.html"], [
    "data-ox-v4",
    ".panel{background:var(--graphite)",
    ".login-card.panel",
  ]);
  includesAll(files["origenix-sistema-login.html"], [
    "data-ox-v4",
    "class=\"login-card panel\"",
  ]);
  includesAll(files["ui-enhancements.js"], [
    "const loginButton = $(\"#btnAuth\")",
    "!button.classList.contains(\"login-tab\")",
    "loginButton.insertAdjacentElement(\"afterend\", actions)",
  ]);
});

const failures = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? "✓" : "✗"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} contratos aprovados.`);

if (failures.length) process.exitCode = 1;
