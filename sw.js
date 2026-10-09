// sw.js — service worker: rede primeiro (sempre a versão publicada mais nova quando há internet),
// cache como reserva (o app abre sem sinal). Chamadas a outros domínios (Open-Meteo, Apps Script) passam direto.
const CACHE = "perfumista-v10";
const BASE = new URL("./", self.location).pathname;
const ARQUIVOS = ["", "index.html", "manifest.webmanifest", "app/estilo.css", "app/main.js", "app/store.js", "app/clima.js",
  "app/entrada.js", "app/api.js", "app/registro.js", "app/planilha.js", "app/estatisticas.js", "app/telas.js", "app/util.js", "app/roda.js", "app/mercado.js",
  "engine/index.js", "engine/config.js", "engine/modelo.js", "data/frascos.json", "data/fichas.json", "data/playbook.json", "data/arquetipos.json",
  "app/icones/icone-180.png", "app/icones/icone-192.png", "app/icones/icone-512.png"].map(a => BASE + a);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      // nova Request só com a URL: passar opções junto de um pedido de navegação faz o Safari recusar o fetch
      const r = await fetch(new Request(req.url, { cache: "no-store", credentials: "same-origin" }));
      if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
      return r;
    } catch {
      const c = await caches.match(req, { ignoreSearch: true });
      if (c) return c;
      if (req.mode === "navigate") return caches.match(BASE + "index.html");
      throw new Error("offline e sem cópia");
    }
  })());
});
