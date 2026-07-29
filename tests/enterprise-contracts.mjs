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
  assert.equal(migrationNames.length, 12, "esperadas exatamente 12 migrations");
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

const failures = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? "✓" : "✗"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} contratos aprovados.`);

if (failures.length) process.exitCode = 1;
