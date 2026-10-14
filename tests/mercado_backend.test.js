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

test("fotos: ficam na aba Fotos da planilha (sem Drive), em pedaços; Mercado guarda só a versão; renomear e remover acompanham", () => {
  const b = novo();
  b.post({ token: "dev", acao: "criarMercado", linhas: [L("Amouage", "Decision", "S", "Frasco Gui"), L("Amouage", "Search")] });
  assert.equal(b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Nada", imagem: "AAAA" }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Decision", imagem: "AAAA", tipo: "image/gif" }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Decision", imagem: "<script>" }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Decision", imagem: "A".repeat(450001) }).ok, false);
  const img = "QUJD".repeat(30000);   // 120 mil caracteres → 3 pedaços
  const r = b.post({ token: "dev", acao: "subirFoto", casa: "amouage", perfume: "decision", imagem: img, tipo: "image/jpeg" });
  assert.equal(r.ok, true); assert.match(r.versao, /^aba Fotos · \d{4}-/);
  const cab = b.abas.Mercado[0];
  assert.equal(cab.at(-1), "Foto"); assert.equal(b.abas.Mercado[1][cab.indexOf("Foto")], r.versao);
  const f = b.abas.Fotos;
  assert.deepEqual(f[0].slice(0, 5), ["Casa", "Perfume", "Versão", "Tipo", "Imagem 1"]); assert.equal(f[0].length, 14);
  assert.deepEqual(f[1].slice(0, 2), ["Amouage", "Decision"]);   // nomes da planilha, não os digitados
  assert.ok(f[1].every(c => String(c).length <= 45000));
  let [lida] = b.post({ token: "dev", acao: "fotos", itens: [{ casa: "Amouage", perfume: "Decision" }, { casa: "Amouage", perfume: "Search" }] }).fotos;
  assert.equal(lida.imagem, img); assert.equal(lida.versao, r.versao); assert.equal(lida.tipo, "image/jpeg");
  b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Decision", imagem: "AAAA" });   // trocar: mesma linha, pedaços velhos somem
  assert.equal(f.length, 2);
  assert.equal(b.post({ token: "dev", acao: "fotos", itens: [{ casa: "Amouage", perfume: "Decision" }] }).fotos[0].imagem, "AAAA");
  // renomear o perfume leva a foto junto
  b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Decision", campos: { Perfume: "Decision EDP" } });
  assert.equal(b.post({ token: "dev", acao: "fotos", itens: [{ casa: "Amouage", perfume: "Decision EDP" }] }).fotos.length, 1);
  // Foto não se edita por editarMercado
  b.post({ token: "dev", acao: "editarMercado", casa: "Amouage", perfume: "Decision EDP", campos: { Foto: "" } });
  assert.notEqual(b.abas.Mercado[1][cab.indexOf("Foto")], "");
  // remover a foto apaga a linha e limpa a coluna
  assert.equal(b.post({ token: "dev", acao: "removerFoto", casa: "Amouage", perfume: "Decision EDP" }).apagada, true);
  assert.equal(f.length, 1); assert.equal(b.abas.Mercado[1][cab.indexOf("Foto")], "");
  // tirar o perfume do Mercado apaga a foto dele
  b.post({ token: "dev", acao: "subirFoto", casa: "Amouage", perfume: "Search", imagem: "AAAA" });
  b.post({ token: "dev", acao: "removerMercado", casa: "Amouage", perfume: "Search" });
  assert.equal(f.length, 1);
});

test("Code.gs não usa o Google Drive (só a permissão da própria planilha)", async () => {
  const { readFileSync } = await import("node:fs");
  const codigo = readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  assert.doesNotMatch(codigo, /DriveApp|DocumentApp|GmailApp|requireScopes/);
  assert.match(readFileSync(new URL("../backend/Code.gs", import.meta.url), "utf8"), /^\/\*\* @OnlyCurrentDoc \*\//);
});
