// Lista da Coleção: inclui camada custo e fora da grade, com filtro Camada; usos contados para todos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { telaColecao, camadaDe } from "../app/telas.js";

const F = (nome, camada, tier, extra = {}) => ({ nome, casa: "Casa " + nome, camada, tier, arquetipo: "Monge", eixo: "P", td: "N", peso: 3, doc: 1,
  env_hot: 1, env_cold: 1, janelas: camada === "grade" ? 5 : null, ...extra });
const frascos = [F("Grade S", "grade", "S"), F("Custo A", "custo", "A"), F("Bedouin", "grade", "D")];
const ctx = f => ({ frascos, hist: [{ data: "2026-10-10", slot: "M", perfume: "Custo A" }], hoje: "2026-10-13", janelas: new Map(), filtro: f, fichas: {}, arqTag: a => a });
const nomes = h => [...h.matchAll(/<td class="c-nome">([^<]+)/g)].map(m => m[1].trim());

test("Coleção lista grade, camada custo e fora da grade; filtro Camada separa", () => {
  assert.deepEqual([camadaDe(frascos[0]), camadaDe(frascos[1]), camadaDe(frascos[2])], ["grade", "custo", "fora"]);
  const h = telaColecao(ctx({}));
  assert.deepEqual(nomes(h), ["Grade S", "Custo A", "Bedouin"]);   // ordem padrão por tier S, A, D
  assert.match(h, /title="Camada custo[^"]*">custo<\/span>/); assert.match(h, />fora<\/span>/);
  assert.match(h, /3 de 3 frascos \(grade 1 · custo 1 · fora da grade 1\)/);
  assert.deepEqual(nomes(telaColecao(ctx({ camada: "custo" }))), ["Custo A"]);
  assert.deepEqual(nomes(telaColecao(ctx({ camada: "grade" }))), ["Grade S"]);
  assert.match(telaColecao(ctx({ camada: "custo" })), /<td class="cc-num">1 <span class="nota">☀︎1 ☾0<\/span><\/td>/);   // uso do custo contado
  assert.match(telaColecao(ctx({ camada: "custo" })), /<td class="cc-num">—<\/td>/);   // sem janelas no playbook
});

test("Roda: camada custo entra com contorno tracejado e pode ser ocultada; tier D fica fora", async () => {
  const { rodaSVG, telaRoda } = await import("../app/roda.js");
  const arquetipos = [{ nome: "Monge", cor: "#123456" }];
  const pontos = h => [...h.matchAll(/data-fr="([^"]+)"/g)].map(m => m[1]);
  const com = rodaSVG({ frascos, arquetipos, gaps: [], verGaps: false, usosPor: new Map() });
  assert.deepEqual(pontos(com).sort(), ["Custo A", "Grade S"]);
  assert.match(com, /class="r-fr r-custo" data-fr="Custo A"/);
  assert.deepEqual(pontos(rodaSVG({ frascos, arquetipos, gaps: [], verGaps: false, usosPor: new Map(), comCusto: false })), ["Grade S"]);
  assert.match(telaRoda({ frascos, arquetipos, gaps: [], verGaps: false, usosPor: new Map(), comCusto: true }), /Ocultar camada custo \(1\)/);
});
