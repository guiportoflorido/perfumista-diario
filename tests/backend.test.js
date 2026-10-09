// backend/Code.gs rodando contra uma planilha simulada (SpreadsheetApp falso): token, ordem cronológica,
// reenvio da fila sem duplicar, conflito de slot, validação de nome e leitura do METAR.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codigo = readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8");

function ambiente({ diario, metarJson }) {
  const abas = {
    "Tiers": [["Casa", "Perfume", "Nome no diário", "Posse", "Tier"], ["Memo Paris", "Odéon", "Odéon", "Frasco Gui", "S"],
      ["MFK", "Gentle Fluidity Silver", "Gentle Fluidity Silver", "Frasco Gui", "S"], ["Ex Nihilo", "Speed Legends Living on the Edge", "", "Avaliado", "A"]],
    "Diário": diario.map(r => [...r]),
    "Frascos": [["Perfume", "Último uso"]],
  };
  const formatos = [];
  const aba = nome => {
    const rows = abas[nome];
    return {
      getLastRow: () => rows.length,
      getDataRange: () => ({ getDisplayValues: () => rows.map(r => r.map(String)) }),
      getRange: (r, c, nr = 1, nc = 1) => ({
        getDisplayValues: () => rows.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, j) => String(x[c - 1 + j] ?? ""))),
        setValues: v => { v.forEach((linha, i) => { rows[r - 1 + i] = [...linha]; }); },
        setNumberFormat: f => formatos.push([r, c, f]),
      }),
      insertRowAfter: n => rows.splice(n, 0, []),
    };
  };
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getName: () => "Diário de Uso — Perfumes", getSheetByName: n => (abas[n] ? aba(n) : null) }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "segredo" }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ setMimeType: () => ({ texto: t }) }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(metarJson) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  const post = corpo => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corpo) } }).texto);
  return { post, abas, formatos };
}
const CAB = ["Data", "Slot", "Perfume", "Ocasião", "Temp (°C)", "Td (°C)", "Sprays", "NotaDia", "Obs"];

test("token errado é recusado", () => {
  const { post } = ambiente({ diario: [CAB] });
  assert.equal(post({ token: "x", acao: "ping" }).ok, false);
  assert.equal(post({ token: "segredo", acao: "ping" }).ok, true);
});

test("registrar mantém ordem cronológica (M antes de N) e grava 9 colunas como texto", () => {
  const { post, abas, formatos } = ambiente({ diario: [CAB, ["2026-10-07", "M", "Odéon"], ["2026-10-09", "M", "Odéon"]] });
  const r = post({ token: "segredo", acao: "registrar", linhas: [
    { id: "a", data: "2026-10-09", slot: "N", perfume: "Gentle Fluidity Silver", ocasiao: "Cozy N", temp: "22,4", sprays: "3" },
    { id: "b", data: "2026-10-08", slot: "N", perfume: "Odéon", ocasiao: "", temp: "", td: "", sprays: "" },
  ] });
  assert.equal(r.ok, true); assert.equal(r.gravadas.length, 2);
  assert.deepEqual(abas["Diário"].map(x => x[0] + x[1]), ["DataSlot", "2026-10-07M", "2026-10-08N", "2026-10-09M", "2026-10-09N"]);
  assert.deepEqual(abas["Diário"][4], ["2026-10-09", "N", "Gentle Fluidity Silver", "Cozy N", "22,4", "", "3", "", ""]);
  assert.deepEqual(abas["Diário"][2], ["2026-10-08", "N", "Odéon", "", "", "", "", "", ""]);
  assert.ok(formatos.every(([, c, f]) => c === 1 && f === "@"));
});

test("reenvio da fila não duplica; slot ocupado por outro perfume vira conflito; forcar grava a troca", () => {
  const { post, abas } = ambiente({ diario: [CAB, ["2026-10-09", "M", "Odéon"]] });
  let r = post({ token: "segredo", acao: "registrar", linhas: [{ id: "a", data: "2026-10-09", slot: "M", perfume: "Odéon" }] });
  assert.equal(r.gravadas[0].duplicada, true); assert.equal(abas["Diário"].length, 2);
  r = post({ token: "segredo", acao: "registrar", linhas: [{ id: "b", data: "2026-10-09", slot: "M", perfume: "Gentle Fluidity Silver" }] });
  assert.deepEqual(r.conflitos, [{ id: "b", existente: "Odéon" }]); assert.equal(abas["Diário"].length, 2);
  r = post({ token: "segredo", acao: "registrar", forcar: true, linhas: [{ id: "b", data: "2026-10-09", slot: "M", perfume: "Gentle Fluidity Silver", obs: "troca" }] });
  assert.equal(r.gravadas.length, 1); assert.equal(abas["Diário"].length, 3);
});

test("nome fora da aba Tiers é recusado; nome da coluna Perfume (decant/amostra) é aceito", () => {
  const { post } = ambiente({ diario: [CAB] });
  assert.equal(post({ token: "segredo", acao: "registrar", linhas: [{ data: "2026-10-09", slot: "M", perfume: "Inventado" }] }).ok, false);
  assert.equal(post({ token: "segredo", acao: "registrar", linhas: [{ data: "2026-10-09", slot: "M", perfume: "Speed Legends Living on the Edge" }] }).ok, true);
  assert.equal(post({ token: "segredo", acao: "registrar", linhas: [{ data: "09/10/2026", slot: "M", perfume: "Odéon" }] }).ok, false);
});

test("METAR: Td, T e hora da observação em ISO", () => {
  const { post } = ambiente({ diario: [CAB], metarJson: [{ temp: 28, dewp: 19, obsTime: 1791550800, rawOb: "METAR SBSP 091300Z" }] });
  const r = post({ token: "segredo", acao: "metar" });
  assert.deepEqual(r.metar, { T: 28, Td: 19, obs: "2026-10-09T13:00:00.000Z", raw: "METAR SBSP 091300Z" });
});

test("configurar: cria TOKEN uma vez e devolve a URL do App da Web", () => {
  const props = {}, logs = [];
  const ctx = { PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => (props[k] = v) }) },
    Utilities: { getUuid: () => "1234-abcd" }, ScriptApp: { getService: () => ({ getUrl: () => "https://script.google.com/macros/s/X/exec" }) },
    Logger: { log: m => logs.push(m) } };
  vm.createContext(ctx); vm.runInContext(codigo, ctx);
  const r1 = ctx.configurar(), r2 = ctx.configurar();
  assert.equal(r1.token, "1234abcd1234abcd"); assert.equal(r2.token, r1.token);
  assert.equal(r1.url, "https://script.google.com/macros/s/X/exec");
  assert.ok(logs.some(l => l.includes("Token: 1234abcd1234abcd")));
});
