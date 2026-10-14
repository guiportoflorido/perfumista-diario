// Aba Mercado no app: tier/posse da aba Tiers vencem, linhas para criar a aba, filtros e ordem, campos alterados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseComTiers, linhasParaCriar, deLinhas, filtrar, camposAlterados, COLS, telaMercado } from "../app/mercado.js";

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

test("ordenação por coluna (TABELAO): casa, posse, tier asc/desc; vazios no fim", () => {
  const m = baseComTiers(base, tiers);
  assert.deepEqual(filtrar(m, { ord: "casa", dir: "desc" }).map(p => p.nome), ["Gypsy Water", "Decision", "Search"]);
  assert.deepEqual(filtrar(m, { ord: "posse" }).map(p => p.nome), ["Decision", "Gypsy Water", "Search"]);
  assert.deepEqual(filtrar(m, { ord: "tier", dir: "desc" }).map(p => p.nome), ["Gypsy Water", "Decision", "Search"]);   // sem tier no fim
  assert.deepEqual(filtrar(m, { ord: "resumo" }).map(p => p.nome), ["Decision", "Gypsy Water", "Search"]);
});

test("renomear e notas entram como campos alterados; novo perfume leva tudo que foi preenchido", () => {
  const p = baseComTiers(base, tiers)[0];
  const f = { "me-casa": "Amouage", "me-nome": "Decision EDP", "me-notas": "comprar refil", "me-tier": "S", "me-posse": "Frasco Gui", "me-arq": "Monge",
    "me-nariz": "", "me-resumo": "incenso", "me-topo": "a", "me-coracao": "b", "me-base": "c", "me-wish": false };
  assert.deepEqual(camposAlterados(p, f), { Perfume: "Decision EDP", Notas: "comprar refil" });
  const n = camposAlterados({}, { ...f, "me-casa": "Nishane", "me-nome": "Hundred Silent Ways", "me-wish": true });
  assert.equal(n.Casa, "Nishane"); assert.equal(n.Perfume, "Hundred Silent Ways"); assert.equal(n.Wishlist, "✓"); assert.equal(n.Nariz, undefined);
});

test("filtro de wishlist: só, fora, e o valor antigo '1'; ordenar pela coluna Wishlist", () => {
  const m = baseComTiers(base, tiers);
  assert.deepEqual(filtrar(m, { wish: "sim" }).map(p => p.nome), ["Search"]);
  assert.deepEqual(filtrar(m, { wish: "1" }).map(p => p.nome), ["Search"]);
  assert.deepEqual(filtrar(m, { wish: "nao" }).map(p => p.nome), ["Decision", "Gypsy Water"]);
  assert.equal(filtrar(m, { ord: "wish" })[0].nome, "Search");
});

import { tocarOrd, mudarOrds, ordsDe } from "../app/util.js";
test("ordenação em 3 níveis: tocar no cabeçalho empurra os critérios; painel troca e corta níveis", () => {
  let o = ordsDe({}, "tier");
  o = tocarOrd(o, "casa"); assert.deepEqual(o.map(x => x.k), ["casa", "tier"]);
  o = tocarOrd(o, "wish"); assert.deepEqual(o.map(x => x.k), ["wish", "casa", "tier"]);
  o = tocarOrd(o, "posse"); assert.deepEqual(o.map(x => x.k), ["posse", "wish", "casa"]);
  o = tocarOrd(o, "posse"); assert.equal(o[0].dir, "desc");
  o = mudarOrds(o, 1, { k: "casa" }); assert.deepEqual(o.map(x => x.k), ["posse", "casa"]);
  o = mudarOrds(o, 2, { k: "nome" }); assert.deepEqual(o.map(x => x.k), ["posse", "casa", "nome"]);
  o = mudarOrds(o, 1, { k: "" }); assert.deepEqual(o.map(x => x.k), ["posse"]);
  const m = baseComTiers([...base, { casa: "Amouage", nome: "Beach Hut", tier: "A", posse: "", arquetipo: "Botânico", wish: true }], tiers);
  const r = filtrar(m, { ords: [{ k: "casa", dir: "asc" }, { k: "wish", dir: "asc" }, { k: "nome", dir: "desc" }] }).map(p => p.nome);
  assert.deepEqual(r, ["Search", "Beach Hut", "Decision", "Gypsy Water"]);
});

test("filtros iguais aos de Amostras: casa, arquétipo/tier/posse “sem”, amostra em mãos (G/B), posse antiga ainda vale", async () => {
  const { passaAmostra } = await import("../app/util.js");
  const { chave } = await import("../app/mercado.js");
  const l = baseComTiers(base, tiers);
  const nomes = f => filtrar(l, f, { amostras: new Map([[chave("Amouage", "Search"), new Set(["Bia"])]]) }).map(p => p.nome).sort();
  assert.deepEqual(nomes({ casa: "Byredo" }), ["Gypsy Water"]);
  assert.deepEqual(nomes({ posse: "sem" }), ["Search"]);
  assert.deepEqual(nomes({ posse: "Avaliado" }), ["Gypsy Water"]);
  assert.deepEqual(nomes({ posse: "nao" }), ["Gypsy Water", "Search"]);   // valor salvo antes continua funcionando
  assert.deepEqual(nomes({ arq: "sem" }), []);
  assert.deepEqual(nomes({ am: "tem" }), ["Search"]);
  assert.deepEqual(nomes({ am: "bia" }), ["Search"]);
  assert.deepEqual(nomes({ am: "gui" }), []);
  assert.deepEqual(nomes({ am: "nao" }), ["Decision", "Gypsy Water"]);
  assert.equal(passaAmostra("", undefined), true);
  const h = telaMercado({ lista: l, fonte: "planilha", arquetipos: [{ nome: "Monge", cor: "#000" }], filtro: { casa: "Amouage" }, limite: 60, amostras: new Map() });
  assert.match(h, /id="mf-casa"/); assert.match(h, /id="mf-tier"/); assert.match(h, /id="mf-am"/); assert.match(h, /data-acao="mf-limpar"/);
});
