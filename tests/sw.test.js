// sw.js: instala guardando os arquivos do app; com rede busca sempre a versão nova; sem rede usa a cópia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

function ambiente() {
  const ouvintes = {}, store = new Map();
  let online = true, versao = "nova";
  const cache = { addAll: async reqs => { for (const r of reqs) store.set(r.url, `cópia ${r.url}`); }, put: async (req, res) => { store.set(req.url, res.corpo); } };
  const ctx = {
    self: { location: new URL("https://guiportoflorido.github.io/perfumista-diario/sw.js"), addEventListener: (t, f) => (ouvintes[t] = f), skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => cache, keys: async () => ["perfumista-v0", "perfumista-v1"], delete: async () => true,
      match: async (req, _o) => { const u = typeof req === "string" ? req : req.url; return store.has(u) ? { corpo: store.get(u) } : undefined; } },
    fetch: async (req) => { if (!online) throw new TypeError("offline"); assert.equal(req.o.cache, "no-store"); return { ok: true, corpo: `${versao} ${req.url}`, clone() { return this; } }; },
    Request: class { constructor(u, o) { this.url = new URL(u, "https://guiportoflorido.github.io").href; this.o = o; } },
    URL, Promise, Error,
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8"), ctx);
  const evento = async (tipo, req) => { let p; ouvintes[tipo]({ request: req, waitUntil: x => (p = x), respondWith: x => (p = x) }); return p; };
  return { evento, store, setOnline: v => (online = v), setVersao: v => (versao = v) };
}
const get = (url, mode = "same-origin") => ({ method: "GET", url, mode });

test("todos os arquivos guardados existem no projeto", () => {
  const src = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const lista = JSON.parse(src.match(/const ARQUIVOS = (\[[\s\S]*?\])\.map/)[1].replace(/'/g, '"'));
  for (const a of lista.filter(Boolean)) assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), a);
});

test("instala guardando os arquivos; com rede devolve a versão nova; sem rede a cópia", async () => {
  const a = ambiente();
  await a.evento("install");
  assert.ok(a.store.has("https://guiportoflorido.github.io/perfumista-diario/app/main.js"));
  const u = "https://guiportoflorido.github.io/perfumista-diario/app/main.js";
  assert.equal((await a.evento("fetch", get(u))).corpo, `nova ${u}`);
  a.setOnline(false);
  assert.equal((await a.evento("fetch", get(u))).corpo, `nova ${u}`);
});

test("navegação (abrir o app) também busca a versão nova, sem passar opções junto do pedido original", async () => {
  const a = ambiente();
  const u = "https://guiportoflorido.github.io/perfumista-diario/";
  assert.equal((await a.evento("fetch", get(u, "navigate"))).corpo, `nova ${u}`);
});

test("outros domínios (Open-Meteo, Apps Script) e POST não passam pelo service worker", async () => {
  const a = ambiente();
  assert.equal(await a.evento("fetch", get("https://api.open-meteo.com/v1/forecast")), undefined);
  assert.equal(await a.evento("fetch", { method: "POST", url: "https://guiportoflorido.github.io/perfumista-diario/x" }), undefined);
});
