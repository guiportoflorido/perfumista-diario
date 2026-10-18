// Slots extras de registro (M2, E, N2): entram no histórico em ordem, mas as análises só contam Dia (M) e Noite (N).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SLOTS, slotBase, slotNome, slotIcone, opcoesSlot } from "../app/util.js";
import { diarioUnificado } from "../app/planilha.js";
import { contagens, deAnalise } from "../app/estatisticas.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;

test("códigos e rótulos dos slots", () => {
  assert.deepEqual(SLOTS.map(s => s[0]), ["M", "M2", "E", "N", "N2"]);
  assert.equal(slotBase("M2"), "M"); assert.equal(slotBase("N2"), "N"); assert.equal(slotBase("E"), "E");
  assert.equal(slotNome("N2"), "Noite · 2ª aplicação"); assert.equal(slotNome("E"), "Esportes");
  assert.equal(slotIcone("E"), "🏃"); assert.equal(slotIcone("N2"), "☾"); assert.equal(slotIcone("M2"), "☀︎");
  assert.match(opcoesSlot("E"), /<option value="E" selected>🏃 Esportes \(E\)<\/option>/);
});

test("histórico unificado ordena M · M2 · E · N · N2 dentro do dia", () => {
  const h = diarioUnificado([{ data: "2026-10-17", slot: "N2", perfume: "a" }, { data: "2026-10-17", slot: "E", perfume: "b" }, { data: "2026-10-17", slot: "N", perfume: "c" }],
    [{ id: "1", data: "2026-10-17", slot: "M2", perfume: "d", estado: "pendente" }, { id: "2", data: "2026-10-17", slot: "M", perfume: "e", estado: "pendente" }]);
  assert.deepEqual(h.map(r => r.slot), ["M", "M2", "E", "N", "N2"]);
});

test("análises: só Dia (M) e Noite (N) contam", () => {
  const hist = [{ data: "2026-10-17", slot: "M", perfume: "Odéon" }, { data: "2026-10-17", slot: "M2", perfume: "Odéon" },
    { data: "2026-10-17", slot: "E", perfume: "Odéon" }, { data: "2026-10-17", slot: "N2", perfume: "Odéon" }, { data: "2026-10-17", slot: "N", perfume: "Liwa" }];
  assert.deepEqual(hist.filter(deAnalise).map(r => r.slot), ["M", "N"]);
  const c = contagens(hist, frascos, "2026-10-18");
  assert.equal(c.total, 2); assert.equal(c.por.get("Odéon").n, 1); assert.equal(c.por.get("Odéon").M, 1);
});
