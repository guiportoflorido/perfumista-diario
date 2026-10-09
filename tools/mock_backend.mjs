// mock_backend.mjs — só para desenvolvimento: roda backend/Code.gs numa planilha em memória e responde como o
// App da Web do Apps Script (POST JSON em text/plain). Tiers vem de data/frascos.json (com Odéon divergente de
// propósito); Diário começa com as linhas de tests/fixtures/diario_inicial.json, se existir.
//   node tools/mock_backend.mjs            → http://127.0.0.1:8766  (token: dev)
import http from "node:http";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";

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

const aba = nome => {
  const rows = abas[nome];
  return {
    getLastRow: () => rows.length,
    getDataRange: () => ({ getDisplayValues: () => rows.map(r => r.map(x => String(x ?? ""))) }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getDisplayValues: () => rows.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, j) => String(x[c - 1 + j] ?? ""))),
      setValues: v => v.forEach((l, i) => { rows[r - 1 + i] = [...l]; }),
      setNumberFormat: () => {},
    }),
    insertRowAfter: n => rows.splice(n, 0, []),
  };
};
let metarFalhar = false;
const ctx = {
  SpreadsheetApp: { getActive: () => ({ getName: () => "Diário de Uso — Perfumes (simulada)", getSheetByName: n => (abas[n] ? aba(n) : null) }), flush() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => "dev" }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ setMimeType: () => t }) },
  UrlFetchApp: { fetch: () => {
    if (metarFalhar) return { getResponseCode: () => 503, getContentText: () => "" };
    const agora = Math.floor(Date.now() / 1000) - 20 * 60;
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify([{ temp: 24, dewp: 11, obsTime: agora, rawOb: "METAR SBSP (simulado)" }]) };
  } },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("backend/Code.gs", raiz), "utf8"), ctx);

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "GET" && req.url === "/_diario") { res.end(JSON.stringify(abas["Diário"])); return; }
  if (req.method !== "POST") { res.end(ctx.doGet()); return; }
  let corpo = "";
  req.on("data", c => (corpo += c));
  req.on("end", () => { res.setHeader("Content-Type", "application/json"); res.end(ctx.doPost({ postData: { contents: corpo } })); });
}).listen(8766, "127.0.0.1", () => console.log("mock Apps Script em http://127.0.0.1:8766 (token: dev)"));
