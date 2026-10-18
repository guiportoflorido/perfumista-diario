// Histórico: lista de registros recentes (últimos 30 dias) com botão Editar; limite igual ao do Apps Script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registrosRecentes, idRegistro } from "../app/telas.js";
import { limiteEdicao, DIAS_EDITAVEIS } from "../app/registro.js";

test("limite de edição = hoje − 30 dias (mesma regra do Code.gs)", () => {
  assert.equal(DIAS_EDITAVEIS, 30);
  assert.equal(limiteEdicao("2026-10-18"), "2026-09-18");
  assert.equal(limiteEdicao("2026-03-01"), "2026-01-30");
});

test("registros recentes: só a partir do limite, mais novo primeiro, com id único por linha", () => {
  const hist = [
    { data: "2026-09-01", slot: "M", perfume: "Velho", linha: 2 },
    { data: "2026-10-16", slot: "N", perfume: "Odéon", ocasiao: "N.Inf", sprays: "3", notaDia: "8", linha: 3 },
    { data: "2026-10-17", slot: "M", perfume: "Liwa", id: "abc", pendente: true },
  ];
  const h = registrosRecentes(hist, "2026-09-18");
  assert.doesNotMatch(h, /Velho/);
  assert.ok(h.indexOf("Liwa") < h.indexOf("Odéon"));
  assert.match(h, /16\/10\/2026 · Noite Informal · 3 sprays · nota 8/);
  assert.match(h, /na fila/);
  assert.match(h, /data-editar-reg="2026-10-16\|N\|Odéon\|3\|"/);
  assert.equal(idRegistro(hist[2]), "2026-10-17|M|Liwa||abc");
  assert.match(registrosRecentes([], "2026-09-18"), /Nenhum registro/);
});
