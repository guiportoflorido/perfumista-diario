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
        setValue: v => { (rows[r - 1] || (rows[r - 1] = []))[c - 1] = v; },
      }),
      insertRowAfter: n => rows.splice(n, 0, []),
      deleteRow: n => rows.splice(n - 1, 1),
    };
  };
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getName: () => "Diário de Uso — Perfumes", getSheetByName: n => (abas[n] ? aba(n) : null) }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "segredo" }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ setMimeType: () => ({ texto: t }) }) },
    // relógio fixo: "agora" = 18/out/2026; datas relativas a agora (hoje − 30 dias) andam junto
    Utilities: { formatDate: d => new Date(Date.UTC(2026, 9, 18, 12) - (Date.now() - d.getTime())).toISOString().slice(0, 10) },
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

test("registrar mantém ordem cronológica (M antes de N) e grava as colunas do Diário (com Sugerido no fim)", () => {
  const { post, abas, formatos } = ambiente({ diario: [CAB, ["2026-10-07", "M", "Odéon"], ["2026-10-09", "M", "Odéon"]] });
  const r = post({ token: "segredo", acao: "registrar", linhas: [
    { id: "a", data: "2026-10-09", slot: "N", perfume: "Gentle Fluidity Silver", ocasiao: "Cozy N", temp: "22,4", sprays: "3", sugerido: "2" },
    { id: "b", data: "2026-10-08", slot: "N", perfume: "Odéon", ocasiao: "", temp: "", td: "", sprays: "" },
  ] });
  assert.equal(r.ok, true); assert.equal(r.gravadas.length, 2);
  assert.deepEqual(abas["Diário"].map(x => x[0] + x[1]), ["DataSlot", "2026-10-07M", "2026-10-08N", "2026-10-09M", "2026-10-09N"]);
  assert.deepEqual(abas["Diário"][4], ["2026-10-09", "N", "Gentle Fluidity Silver", "Cozy N", "22,4", "", "3", "", "", "2", ""]);
  assert.deepEqual(abas["Diário"][2], ["2026-10-08", "N", "Odéon", "", "", "", "", "", "", "", ""]);
  assert.deepEqual(abas["Diário"][0].slice(9), ["Sugerido", "Vivo"]);   // aba com 9 colunas: cabeçalhos novos escritos em J1 e K1, sem recriar
  assert.deepEqual(abas["Diário"][1], ["2026-10-07", "M", "Odéon"]);   // linhas antigas não mudam
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

test("app: “ação desconhecida” vira instrução de atualizar o Apps Script", async () => {
  const store = new Map([["pd.ajustes", JSON.stringify({ backend: "https://script.google.com/x/exec", token: "t" })]]);
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  globalThis.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ ok: false, erro: "ação desconhecida" }) });
  const { chamar } = await import("../app/api.js");
  await assert.rejects(chamar("subirFoto"), /desatualizado \(não conhece “subirFoto”\).*implante uma nova versão/);
});

test("editarRegistro: muda campos no lugar; trocar data/slot reposiciona; slot ocupado e nome fora da Tiers são recusados", () => {
  const { post, abas } = ambiente({ diario: [CAB, ["2026-10-15", "M", "Odéon", "Lazer", "", "", "3"], ["2026-10-16", "N", "Odéon"], ["2026-10-17", "M", "Gentle Fluidity Silver"]] });
  let r = post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-15", slot: "M", perfume: "Odéon" }, linha: 2, campos: { sprays: "4", notaDia: "8,5", ocasiao: "T.Inf" } });
  assert.equal(r.ok, true); assert.equal(r.linha, 2);
  assert.deepEqual(abas["Diário"][1], ["2026-10-15", "M", "Odéon", "T.Inf", "", "", "4", "8,5", "", "", ""]);
  r = post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-15", slot: "M", perfume: "Odéon" }, linha: 2, campos: { sugerido: "3" } });
  assert.equal(abas["Diário"][1][9], "3"); assert.equal(abas["Diário"][1][6], "4");   // só o campo pedido muda
  // linha errada (planilha mudou): acha pelo conteúdo
  r = post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-16", slot: "N", perfume: "Odéon" }, linha: 2, campos: { perfume: "Gentle Fluidity Silver" } });
  assert.equal(r.ok, true); assert.equal(abas["Diário"][2][2], "Gentle Fluidity Silver");
  // mudar a data reposiciona em ordem cronológica
  r = post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-15", slot: "M", perfume: "Odéon" }, campos: { data: "2026-10-17", slot: "N" } });
  assert.equal(r.ok, true);
  assert.deepEqual(abas["Diário"].slice(1).map(x => x[0] + x[1] + x[2]), ["2026-10-16NGentle Fluidity Silver", "2026-10-17MGentle Fluidity Silver", "2026-10-17NOdéon"]);
  assert.equal(abas["Diário"][3][6], "4");   // demais campos vão junto
  assert.match(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-17", slot: "N", perfume: "Odéon" }, campos: { slot: "M" } }).erro, /já existe Gentle Fluidity Silver/);
  assert.match(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-17", slot: "N", perfume: "Odéon" }, campos: { perfume: "Inventado" } }).erro, /não está na aba Tiers/);
  assert.match(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-17", slot: "N", perfume: "Odéon" }, campos: { data: "2026-10-19" } }).erro, /fora do período/);
  assert.match(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-01", slot: "N", perfume: "Odéon" }, campos: {} }).erro, /não encontrado/);
  assert.equal(abas["Diário"].length, 4);
});

test("removerRegistro: apaga só aquela linha; antigos (>30 dias) e duplicados ambíguos são recusados", () => {
  const { post, abas } = ambiente({ diario: [CAB, ["2026-09-01", "M", "Odéon"], ["2026-10-16", "N", "Odéon"], ["2026-10-17", "M", "Odéon"], ["2026-10-17", "M", "Odéon"]] });
  assert.match(post({ token: "segredo", acao: "removerRegistro", orig: { data: "2026-09-01", slot: "M", perfume: "Odéon" } }).erro, /a partir de 2026-09-18/);
  assert.match(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-09-01", slot: "M", perfume: "Odéon" }, campos: { sprays: "2" } }).erro, /a partir de 2026-09-18/);
  assert.match(post({ token: "segredo", acao: "removerRegistro", orig: { data: "2026-10-17", slot: "M", perfume: "Odéon" } }).erro, /2 linhas iguais/);
  assert.equal(post({ token: "segredo", acao: "removerRegistro", orig: { data: "2026-10-17", slot: "M", perfume: "Odéon" }, linha: 5 }).removida, 5);   // com a linha certa, sem ambiguidade
  const r = post({ token: "segredo", acao: "removerRegistro", orig: { data: "2026-10-16", slot: "N", perfume: "Odéon" }, linha: 3 });
  assert.equal(r.ok, true);
  assert.deepEqual(abas["Diário"].slice(1).map(x => x[0] + x[1]), ["2026-09-01M", "2026-10-17M"]);
  assert.equal(post({ token: "segredo", acao: "removerRegistro", orig: { data: "2026-10-16", slot: "N", perfume: "Odéon" } }).ok, false);
});

test("slots M2 (2ª do Dia), E (Esportes) e N2 (2ª da Noite): aceitos, na ordem M · M2 · E · N · N2; outro código é recusado", () => {
  const { post, abas } = ambiente({ diario: [CAB, ["2026-10-16", "N", "Odéon"], ["2026-10-17", "M", "Odéon"], ["2026-10-17", "N", "Odéon"]] });
  const r = post({ token: "segredo", acao: "registrar", linhas: [
    { id: "a", data: "2026-10-17", slot: "N2", perfume: "Gentle Fluidity Silver" },
    { id: "b", data: "2026-10-17", slot: "E", perfume: "Odéon" },
    { id: "c", data: "2026-10-17", slot: "M2", perfume: "Odéon" },
    { id: "d", data: "2026-10-16", slot: "E", perfume: "Odéon" },
  ] });
  assert.equal(r.ok, true); assert.equal(r.gravadas.length, 4); assert.equal(r.conflitos.length, 0);
  assert.deepEqual(abas["Diário"].slice(1).map(x => x[0].slice(8) + x[1]), ["16E", "16N", "17M", "17M2", "17E", "17N", "17N2"]);
  assert.match(post({ token: "segredo", acao: "registrar", linhas: [{ data: "2026-10-17", slot: "X", perfume: "Odéon" }] }).erro, /slot inválido: X/);
  // editar para um slot novo reposiciona
  assert.equal(post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-16", slot: "N", perfume: "Odéon" }, campos: { slot: "N2" } }).ok, true);
  assert.deepEqual(abas["Diário"].slice(1, 3).map(x => x[0].slice(8) + x[1]), ["16E", "16N2"]);
});

test("Vivo (11ª coluna): só vivo / fraco / morto ou vazio; editável depois", () => {
  const { post, abas } = ambiente({ diario: [CAB, ["2026-10-15", "M", "Odéon"]] });
  assert.match(post({ token: "segredo", acao: "registrar", linhas: [{ id: "x", data: "2026-10-15", slot: "N", perfume: "Gentle Fluidity Silver", vivo: "talvez" }] }).erro, /vivo inválido/);
  const r = post({ token: "segredo", acao: "registrar", linhas: [{ id: "a", data: "2026-10-15", slot: "N", perfume: "Gentle Fluidity Silver", vivo: "fraco", sugerido: "3" }] });
  assert.equal(r.ok, true);
  assert.deepEqual(abas["Diário"][2].slice(9), ["3", "fraco"]);
  post({ token: "segredo", acao: "editarRegistro", orig: { data: "2026-10-15", slot: "N", perfume: "Gentle Fluidity Silver" }, linha: 3, campos: { vivo: "morto" } });
  assert.equal(abas["Diário"][2][10], "morto"); assert.equal(abas["Diário"][2][9], "3");
});
