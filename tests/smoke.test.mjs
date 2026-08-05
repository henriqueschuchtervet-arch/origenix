import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "origenix-dashboard-v3.html", "origenix-emissao-v3.html", "origenix-sistema-login.html"];
const scripts = ["assets/js/config.js", "assets/js/core.js", "assets/js/landing.js", "assets/js/login.js", "assets/js/dashboard.js", "assets/js/documents.js"];
const read = (path) => readFile(resolve(root, path), "utf8");

test("required static entry points and infrastructure files exist", async () => {
  await Promise.all([...pages, ...scripts, "netlify.toml", "supabase/config.toml", "supabase/functions/approve-access-request/index.ts"].map((path) => access(resolve(root, path))));
});
test("browser JavaScript parses", async () => {
  for (const path of scripts) {
    const source = await read(path);
    assert.doesNotThrow(() => new Function(source), `${path} has invalid JavaScript`);
  }
});

test("Supabase browser dependency is pinned", async () => {
  for (const path of pages) {
    const html = await read(path);
    if (html.includes("supabase-js")) assert.match(html, /@supabase\/supabase-js@2\.111\.0/);
  }
});

test("public self-signup is absent and access request is explicit", async () => {
  const sources = await Promise.all([...pages, ...scripts].map(read));
  const joined = sources.join("\n");
  assert.doesNotMatch(joined, /\.auth\.signUp\s*\(/);
  assert.doesNotMatch(joined, /Criar Conta/i);
  assert.match(await read("origenix-sistema-login.html"), /Solicitar acesso/);
  assert.match(await read("assets/js/login.js"), /from\("access_requests"\)\.insert/);
});

test("internal pages enforce the shared authorization gate", async () => {
  assert.match(await read("assets/js/dashboard.js"), /await app\.requireAuth\(\)/);
  assert.match(await read("assets/js/documents.js"), /await app\.requireAuth\(\)/);
  assert.match(await read("assets/js/core.js"), /profile\.status !== "ativo"/);
});

test("landing contains no fixed demonstration metrics or dates", async () => {
  const html = await read("index.html");
  const script = await read("assets/js/landing.js");
  for (const value of ["240</span>+", "180</span>+", "1.4</span>K", "95</span>+", "14/07/2026", "18/06/2026"]) {
    assert.ok(!html.includes(value), `demo value remains: ${value}`);
  }
  assert.match(script, /origem:\s*["']landing_page["']/);
});

test("visual review mode is restricted to local hosts", async () => {
  for (const path of ["assets/js/dashboard.js", "assets/js/documents.js"]) {
    const source = await read(path);
    assert.match(source, /\["localhost",\s*"127\.0\.0\.1"\]\.includes\(window\.location\.hostname\)/);
    assert.match(source, /get\("ui-review"\)\s*===\s*"1"/);
  }
});

test("HTML IDs are unique per page", async () => {
  for (const path of pages) {
    const html = await read(path);
    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${path} contains duplicate IDs`);
  }
});

test("local page links resolve to files", async () => {
  for (const path of pages) {
    const html = await read(path);
    const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]);
    for (const href of links) {
      if (!href || href.startsWith("#") || /^(https?:|mailto:|tel:)/.test(href)) continue;
      const clean = href.split(/[?#]/)[0];
      if (!clean || clean === "/") continue;
      await access(resolve(root, clean.replace(/^\//, "")));
    }
  }
});

test("migration locks public access and contains no broad using true policy", async () => {
  const sql = await read("supabase/migrations/20260805181345_production_hardening.sql");
  assert.match(sql, /create table if not exists public\.access_requests/i);
  assert.match(sql, /revoke all privileges on table public\.%I from anon/i);
  assert.match(sql, /'cliente',\s*false,\s*'pendente'/i);
  assert.match(sql, /create policy access_requests_public_insert/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("no server secret is present in browser-delivered files", async () => {
  const browserSources = await Promise.all([...pages, ...scripts].map(read));
  const joined = browserSources.join("\n");
  assert.doesNotMatch(joined, /service_role/i);
  assert.doesNotMatch(joined, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(joined, /sk-[A-Za-z0-9_-]{20,}/);
});

test("Netlify configuration adds baseline security headers", async () => {
  const config = await read("netlify.toml");
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]) {
    assert.match(config, new RegExp(header));
  }
});
