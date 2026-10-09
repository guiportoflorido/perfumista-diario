// mock_backend.mjs — só para desenvolvimento: roda backend/Code.gs numa planilha em memória e responde como o
// App da Web do Apps Script (POST JSON em text/plain). Tiers vem de data/frascos.json (com Odéon divergente de
// propósito); Diário começa com tests/fixtures/diario_inicial.json; a aba Mercado nasce vazia (o app a cria).
//   node tools/mock_backend.mjs            → http://127.0.0.1:8766  (token: dev)
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { carregarBackend } from "./planilha_falsa.mjs";

const raiz = new URL("../", import.meta.url);
const frascos = JSON.parse(readFileSync(new URL("data/frascos.json", raiz))).frascos;
const abas = {
  "Tiers": [["Casa", "Perfume", "Nome no diário", "Posse", "Tier", "Atualizado em", "Obs"],
    ...frascos.map(f => [f.casa, f.nome, f.nome, "Frasco Gui", f.nome === "Odéon" ? "A" : f.tier, "", ""]),
    ["Ex Nihilo", "Speed Legends Living on the Edge", "", "Avaliado", "A", "", ""]],
  "Diário": [["Data", "Slot", "Perfume", "Ocasião", "Temp (°C)", "Td (°C)", "Sprays", "NotaDia", "Obs"]],
  "Frascos": [["Perfume", "Último uso", "Usos", "Usos na janela", "Dias sem uso"]],
};
const fx = new URL("tests/fixtures/diario_inicial.json", raiz);
if (existsSync(fx)) abas["Diário"].push(...JSON.parse(readFileSync(fx)));

const agora = () => Math.floor(Date.now() / 1000) - 20 * 60;
const { ctx } = carregarBackend(abas, { token: "dev", metar: () => ({ getResponseCode: () => 200,
  getContentText: () => JSON.stringify([{ temp: 24, dewp: 11, obsTime: agora(), rawOb: "METAR SBSP (simulado)" }]) }) });

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "GET" && req.url.startsWith("/_aba/")) { res.end(JSON.stringify(abas[decodeURIComponent(req.url.slice(6))] || null)); return; }
  if (req.method === "GET" && req.url === "/_diario") { res.end(JSON.stringify(abas["Diário"])); return; }
  if (req.method !== "POST") { res.end(ctx.doGet()); return; }
  let corpo = "";
  req.on("data", c => (corpo += c));
  req.on("end", () => { res.setHeader("Content-Type", "application/json"); res.end(ctx.doPost({ postData: { contents: corpo } })); });
}).listen(8766, "127.0.0.1", () => console.log("mock Apps Script em http://127.0.0.1:8766 (token: dev)"));
