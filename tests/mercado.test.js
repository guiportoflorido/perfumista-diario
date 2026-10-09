// Aba Mercado no app: tier/posse da aba Tiers vencem, linhas para criar a aba, filtros e ordem, campos alterados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseComTiers, linhasParaCriar, deLinhas, filtrar, camposAlterados, COLS } from "../app/mercado.js";

const base = [
  { casa: "Amouage", nome: "Decision", tier: "A", posse: "", arquetipo: "Monge", resumo: "incenso", topo: "a", coracao: "b", base: "c", nariz: "", wish: false },
  { casa: "Amouage", nome: "Search", tier: "", posse: "", arquetipo: "Monge", resumo: "", topo: "", coracao: "", base: "", nariz: "", wish: true },
  { casa: "Byredo", nome: "Gypsy Water", tier: "C", posse: "Avaliado", arquetipo: "Minimalista", resumo: "", topo: "", coracao: "", base: "", nariz: "", wish: false },
];
const tiers = [{ casa: "Amouage", perfume: "Decision", nomeDiario: "Decision", posse: "Frasco Gui", tier: "S" }];

test("aba Tiers vence tier e posse; linhas de criação seguem as 12 colunas", () => {
  const m = baseComTiers(base, tiers);
  assert.equal(m[0].tier, "S"); assert.equal(m[0].posse, "Frasco Gui"); assert.equal(m[1].tier, "");
  const l = linhasParaCriar(base, tiers);
  assert.equal(l[0].length, COLS.length);
  assert.deepEqual(l[0].slice(0, 5), ["Amouage", "Decision", "S", "Frasco Gui", "Monge"]);
  assert.equal(l[1][10], "✓");
  const volta = deLinhas([COLS, ...l], tiers);
  assert.equal(volta[1].wish, true); assert.equal(volta[0].tier, "S");
});

test("ordem: S antes de sem tier; filtros de posse e busca", () => {
  const m = baseComTiers(base, tiers);
  assert.deepEqual(filtrar(m, {}).map(p => p.nome), ["Decision", "Gypsy Water", "Search"]);
  assert.deepEqual(filtrar(m, { posse: "Frasco Gui" }).map(p => p.nome), ["Decision"]);
  assert.deepEqual(filtrar(m, { posse: "nao" }).map(p => p.nome), ["Gypsy Water", "Search"]);
  assert.deepEqual(filtrar(m, { tier: "sem" }).map(p => p.nome), ["Search"]);
  assert.deepEqual(filtrar(m, { q: "INCENSO" }).map(p => p.nome), ["Decision"]);
});

test("só os campos que mudaram vão para a planilha", () => {
  const p = baseComTiers(base, tiers)[0];
  const f = { "me-tier": "S", "me-posse": "Frasco Gui", "me-arq": "Monge", "me-nariz": "", "me-resumo": "incenso seco ", "me-topo": "a", "me-coracao": "b", "me-base": "c", "me-wish": true };
  assert.deepEqual(camposAlterados(p, f), { Resumo: "incenso seco", Wishlist: "✓" });
});
