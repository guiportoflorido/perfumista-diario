// Ações de Mercado do Code.gs: criar a aba uma vez, ler, editar; tier e posse vão também para a aba Tiers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBackend } from "../tools/planilha_falsa.mjs";

const COLS = ["Casa", "Perfume", "Tier", "Posse", "Arquétipo", "Resumo", "Topo", "Coração", "Base", "Nariz", "Wishlist", "Atualizado em"];
const novo = () => carregarBackend({
  "Tiers": [["Casa", "Perfume", "Nome no diário", "Posse", "Tier", "Atualizado em", "Obs"], ["Amouage", "Decision", "Decision", "Frasco Gui", "S", "", ""]],
  "Diário": [["Data", "Slot", "Perfume"]],
});
const L = (casa, nome, tier = "", posse = "") => [casa, nome, tier, posse, "Monge", "resumo", "topo", "coração", "base", "", "", ""];

test("mercado: sem aba → existe:false; criar uma vez; ler de volta", () => {
  const b = novo();
  assert.deepEqual(b.post({ token: "dev", acao: "mercado" }).mercado, { existe: false });
  const r = b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui"), L("Amouage", "Search")] });
  assert.equal(r.ok, true); assert.equal(r.linhas, 2);
  assert.deepEqual(b.abas.Mercado[0], COLS);
  assert.equal(b.post({ token: "dev", acao: "criarMercado", linhas: [L("X", "Y")] }).ok, false);   // não recria
  const m = b.post({ token: "dev", acao: "mercado" }).mercado;
  assert.equal(m.existe, true); assert.equal(m.linhas.length, 3);
});

test("editar: campos de texto só no Mercado; tier/posse também na aba Tiers (atualiza ou cria linha)", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui"), L("Amouage", "Search")] });
  let r = b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Search", campos: { Resumo: "incenso cítrico", Wishlist: "✓" } });
  assert.equal(r.ok, true); assert.equal(r.tiers, null);
  assert.equal(b.abas.Mercado[2][5], "incenso cítrico"); assert.equal(b.abas.Mercado[2][10], "✓"); assert.equal(b.abas.Mercado[2][11], "2026-10-09");
  assert.equal(b.abas.Tiers.length, 2);
  r = b.post({ token: "dev", acao: "editarMercado", casa: "amouage", perfume: "decision", campos: { Tier: "A" } });   // chave sem maiúsculas/acentos
  assert.equal(r.tiers.nova, false); assert.equal(b.abas.Tiers[1][4], "A"); assert.equal(b.abas.Mercado[1][2], "A");
  r = b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Search", campos: { Tier: "A", Posse: "Amostra" } });
  assert.equal(r.tiers.nova, true); assert.deepEqual(b.abas.Tiers[2].slice(0, 6), ["Amouage", "Search", "", "Amostra", "A", "2026-10-09"]);
});

test("editar: tier inválido e perfume inexistente são recusados", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Search")] });
  assert.equal(b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Search", campos: { Tier: "Z" } }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Nada", campos: { Tier: "A" } }).ok, false);
});

test("adicionar: obrigatórios, sem duplicar, tier/posse vão para Tiers; notas criam a coluna", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui")] });
  assert.equal(b.post({ token: "dev", acao: "adicionarMercado", campos: { Casa: "", Perfume: "X" } }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "adicionarMercado", campos: { Casa: "amouage", Perfume: "DECISION" } }).ok, false);
  const r = b.post({ token: "dev", acao: "adicionarMercado", campos: { Casa: "Nishane", Perfume: "Hundred Silent Ways", Tier: "B", Posse: "Amostra", Notas: "testei na loja" } });
  assert.equal(r.ok, true); assert.equal(r.tiers.nova, true);
  const cab = b.abas.Mercado[0], nova = b.abas.Mercado[r.linha - 1];
  assert.equal(cab.at(-1), "Notas");
  assert.equal(nova[cab.indexOf("Perfume")], "Hundred Silent Ways"); assert.equal(nova[cab.indexOf("Notas")], "testei na loja");
  assert.equal(nova[cab.indexOf("Atualizado em")], "2026-10-09");
});

test("renomear casa/perfume também renomeia a linha da aba Tiers (Nome no diário fica)", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui"), L("Amouage", "Search")] });
  assert.equal(b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Decision", campos: { Perfume: "Search" } }).ok, false);   // já existe
  const r = b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Decision", campos: { Perfume: "Decision EDP" } });
  assert.equal(r.ok, true); assert.equal(b.abas.Mercado[1][1], "Decision EDP");
  assert.deepEqual(b.abas.Tiers[1].slice(0, 3), ["Amouage", "Decision EDP", "Decision"]);
});

test("remover tira só da aba Mercado", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui"), L("Amouage", "Search")] });
  const r = b.post({ token: "dev", acao: "removerMercado", casa: "Amouage", perfume: "Decision" });
  assert.equal(r.ok, true); assert.equal(b.abas.Mercado.length, 2); assert.equal(b.abas.Mercado[1][1], "Search");
  assert.equal(b.abas.Tiers.length, 2);
  assert.equal(b.post({ token: "dev", acao: "removerMercado", casa: "Amouage", perfume: "Decision" }).ok, false);
});
