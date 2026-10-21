// Períodos do Histórico: atalhos e intervalo livre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodo } from "../app/telas.js";

test("atalhos de período", () => {
  assert.deepEqual(periodo("tudo", "2026-10-09"), { de: null, ate: "2026-10-09" });
  assert.deepEqual(periodo("7", "2026-10-09"), { de: "2026-10-03", ate: "2026-10-09" });
  assert.deepEqual(periodo("30", "2026-10-09"), { de: "2026-09-10", ate: "2026-10-09" });
  assert.deepEqual(periodo("mes", "2026-10-09"), { de: "2026-10-01", ate: "2026-10-09" });
  assert.deepEqual(periodo("mesant", "2026-10-09"), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(periodo("mesant", "2026-01-15"), { de: "2025-12-01", ate: "2025-12-31" });
  assert.deepEqual(periodo("livre", "2026-10-09", "2026-10-05", ""), { de: "2026-10-05", ate: "2026-10-09" });
});

import { sortear } from "../app/diversao.js";
test("roleta: só sorteia entre os 3 primeiros, com peso pelo score", () => {
  const top = [{ nome: "A", score: 100 }, { nome: "B", score: 50 }, { nome: "C", score: 50 }, { nome: "D", score: 999 }];
  assert.equal(sortear(top, () => 0).nome, "A");
  assert.equal(sortear(top, () => 0.49).nome, "A");
  assert.equal(sortear(top, () => 0.51).nome, "B");
  assert.equal(sortear(top, () => 0.99).nome, "C");
  const vistos = new Set(Array.from({ length: 200 }, () => sortear(top).nome));
  assert.ok(!vistos.has("D"));
});

import { slotExpandido } from "../app/util.js";
test("Hoje: slot da hora expandido; se o slot da hora já foi usado, abre o outro", () => {
  assert.equal(slotExpandido({ agoraH: 7.25, noiteH: 19.5 }), "M");                         // manhã
  assert.equal(slotExpandido({ agoraH: 19.5, noiteH: 19.5 }), "N");                         // na hora da noite
  assert.equal(slotExpandido({ agoraH: 21, noiteH: 19.5 }), "N");
  assert.equal(slotExpandido({ agoraH: 10, noiteH: 19.5, usadoM: true }), "N");             // Dia já registrado: abre a Noite
  assert.equal(slotExpandido({ agoraH: 21, noiteH: 19.5, usadoN: true }), "M");             // Noite já registrada (Dia não): abre o Dia
  assert.equal(slotExpandido({ agoraH: 21, noiteH: 19.5, usadoM: true, usadoN: true }), "N");   // os dois usados: fica o da hora
});
