// planilha_falsa.mjs — SpreadsheetApp em memória para rodar backend/Code.gs em testes e no servidor de desenvolvimento.
import vm from "node:vm";
import { readFileSync } from "node:fs";

export function carregarBackend(abas, { token = "dev", metar } = {}) {
  const aba = nome => {
    const rows = abas[nome];
    const range = (r, c, nr = 1, nc = 1) => {
      const api = {
        getDisplayValues: () => rows.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, j) => String(x?.[c - 1 + j] ?? ""))),
        setValues: v => { v.forEach((l, i) => { const row = rows[r - 1 + i] || (rows[r - 1 + i] = []); l.forEach((x, j) => { row[c - 1 + j] = x; }); }); return api; },
        setValue: v => api.setValues([[v]]),
        setNumberFormat: () => api, setFontWeight: () => api,
      };
      return api;
    };
    return {
      getLastRow: () => rows.length,
      getDataRange: () => ({ getDisplayValues: () => { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => Array.from({ length: w }, (_, j) => String(r[j] ?? ""))); } }),
      getRange: range,
      insertRowAfter: n => rows.splice(n, 0, []),
      appendRow: l => rows.push([...l]),
      setFrozenRows: () => {},
    };
  };
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getName: () => "Diário de Uso — Perfumes (simulada)", getSheetByName: n => (abas[n] ? aba(n) : null),
      insertSheet: n => { abas[n] = []; return aba(n); } }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => token }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ setMimeType: () => t }) },
    Utilities: { formatDate: () => "2026-10-09", getUuid: () => "x" },
    UrlFetchApp: { fetch: () => metar ? metar() : { getResponseCode: () => 503, getContentText: () => "" } },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8"), ctx);
  const post = corpo => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corpo) } }));
  return { ctx, post, abas };
}
