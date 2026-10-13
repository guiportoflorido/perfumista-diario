// Aba Amostras no app: leitura das linhas, ligação com o Mercado, resumo, filtros, coerência status × saída,
// campos alterados e avaliação só com o que foi mexido.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLS, deLinhas, juntar, resumo, filtrar, normalizar, camposAmostra, camposAvaliacao, camposAvaliacaoMexidos, semRegistro, diasDesde, telaAmostras, fichaAmostra } from "../app/amostras.js";

const linha = o => COLS.map(c => o[c] ?? "");
const linhas = [COLS,
  linha({ ID: "a1", Casa: "Nishane", Perfume: "Hacivat", Tipo: "Decant", "Volume (ml)": "10", Status: "Realizado", Entrada: "2026-09-20", "Impressão": "abacaxi seco" }),
  linha({ ID: "a2", Casa: "Amouage", Perfume: "Search", "Volume (ml)": "2,5", Status: "Pendente", Entrada: "2026-10-01" }),
  linha({ ID: "a3", Casa: "Byredo", Perfume: "Gypsy Water", Status: "Esgotado", Entrada: "2026-08-01", "Saída": "2026-09-01", "Motivo saída": "Acabou" }),
  linha({ ID: "a4", Casa: "Amouage", Perfume: "Search", Status: "Pendente", Entrada: "2026-09-15" }),
  linha({ ID: "", Casa: "sem", Perfume: "id" })];
const mercado = [
  { casa: "Amouage", nome: "Search", tier: "A", posse: "Amostra", arquetipo: "Monge", resumo: "", notas: "", wish: true },
  { casa: "Byredo", nome: "Gypsy Water", tier: "C", posse: "Avaliado", arquetipo: "Minimalista", resumo: "", notas: "", wish: false },
  { casa: "Xerjoff", nome: "Naxos", tier: "", posse: "Amostra", arquetipo: "Lareira", resumo: "", notas: "", wish: false },
];

test("deLinhas ignora linha sem ID; tipo e status têm padrão", () => {
  const l = deLinhas(linhas);
  assert.equal(l.length, 4);
  assert.deepEqual([l[1].tipo, l[1].status, l[1].ml], ["Amostra", "Pendente", "2,5"]);
  assert.deepEqual(deLinhas([COLS]), []);
});

test("juntar liga pela casa + perfume sem acento/maiúscula; fora do Mercado fica m = null", () => {
  const j = juntar(deLinhas(linhas).concat([{ id: "a5", casa: "amouage", nome: "SEARCH", status: "Pendente" }]), mercado);
  assert.equal(j.find(a => a.id === "a2").m.tier, "A");
  assert.equal(j.find(a => a.id === "a5").m.arquetipo, "Monge");
  assert.equal(j.find(a => a.id === "a1").m, null);
});

test("resumo conta por status e soma ml só do que está em mãos", () => {
  assert.deepEqual(resumo(deLinhas(linhas)), { pendente: 2, realizado: 1, esgotado: 1, mao: 3, ml: 12.5 });
});

test("filtrar: pendentes primeiro (mais antiga antes), em mãos, tipo e busca", () => {
  const l = juntar(deLinhas(linhas), mercado);
  assert.deepEqual(filtrar(l).map(a => a.id), ["a4", "a2", "a1", "a3"]);
  assert.deepEqual(filtrar(l, { status: "mao" }).map(a => a.id), ["a4", "a2", "a1"]);
  assert.deepEqual(filtrar(l, { tipo: "Decant" }).map(a => a.id), ["a1"]);
  assert.deepEqual(filtrar(l, { q: "abacaxi" }).map(a => a.id), ["a1"]);
  assert.deepEqual(filtrar(l, { q: "monge" }).map(a => a.id), ["a4", "a2"]);   // arquétipo vem do Mercado
});

test("ordenar pelo cabeçalho: até 3 critérios, vazios no fim; usos e dias calculados", () => {
  const l = juntar(deLinhas(linhas), mercado);
  assert.deepEqual(filtrar(l, { ords: [{ k: "tier", dir: "asc" }] }).map(a => a.id), ["a4", "a2", "a3", "a1"]);   // A, A, C, sem tier
  assert.deepEqual(filtrar(l, { ords: [{ k: "tier", dir: "desc" }, { k: "entrada", dir: "desc" }] }).map(a => a.id), ["a3", "a2", "a4", "a1"]);
  assert.deepEqual(filtrar(l, { ords: [{ k: "usos", dir: "desc" }] }, { usosDe: a => (a.id === "a1" ? 5 : 0) }).map(a => a.id)[0], "a1");
  assert.deepEqual(filtrar(l, { ords: [{ k: "dias", dir: "desc" }] }, { hoje: "2026-10-13" }).map(a => a.id), ["a3", "a4", "a1", "a2"]);   // 31 (entrada→saída), 28, 23, 12
});

test("normalizar: saída ⇒ Esgotado; Esgotado sem data ⇒ hoje; voltar limpa saída e motivo", () => {
  assert.deepEqual(normalizar({ status: "Pendente", saida: "2026-10-02" }, "2026-10-13"), { status: "Esgotado", saida: "2026-10-02" });
  assert.equal(normalizar({ status: "Esgotado", saida: "" }, "2026-10-13").saida, "2026-10-13");
  assert.deepEqual(normalizar({ status: "Realizado", saida: "", motivo: "Acabou" }), { status: "Realizado", saida: "", motivo: "" });
});

test("camposAmostra: nova manda o preenchido; edição só o que mudou (nomes das colunas)", () => {
  const novo = camposAmostra(null, { casa: "Nishane", nome: "Ani", tipo: "Amostra", ml: "2", status: "Pendente", entrada: "2026-10-13" });
  assert.deepEqual(novo, { Casa: "Nishane", Perfume: "Ani", Tipo: "Amostra", "Volume (ml)": "2", Status: "Pendente", Entrada: "2026-10-13" });
  const a = deLinhas(linhas)[0];
  assert.deepEqual(camposAmostra(a, { ...a, status: "Esgotado", motivo: "Doada" }, "2026-10-13"), { Status: "Esgotado", "Saída": "2026-10-13", "Motivo saída": "Doada" });
  assert.deepEqual(camposAmostra(a, { ...a }), {});
});

test("avaliação: só os campos mexidos e diferentes do Mercado são gravados", () => {
  const m = mercado[0], f = { tier: "", arq: "", posse: "Amostra", resumo: "", notas: "fumaça boa", wish: true };
  assert.deepEqual(camposAvaliacao(m, f), { Tier: "", "Arquétipo": "", Notas: "fumaça boa" });
  // tier/arquétipo vazios no formulário não apagam o Mercado se você não mexeu neles
  assert.deepEqual(camposAvaliacaoMexidos(m, f, ["notas", "wish"]), { Notas: "fumaça boa" });
  assert.deepEqual(camposAvaliacaoMexidos(null, { tier: "B", posse: "Amostra" }, ["tier", "posse"]), { Tier: "B", Posse: "Amostra" });
});

test("semRegistro: posse Amostra sem lançamento (Amostra Bia e Avaliado não entram)", () => {
  const l = deLinhas(linhas);
  assert.deepEqual(semRegistro(l, mercado.concat([{ casa: "Z", nome: "Bia", posse: "Amostra Bia" }])).map(p => p.nome), ["Naxos"]);
});

test("diasDesde e telas renderizam sem erro (inclusive sem dados)", () => {
  assert.equal(diasDesde("2026-10-01", "2026-10-13"), 12); assert.equal(diasDesde(""), null);
  const l = juntar(deLinhas(linhas), mercado);
  const h = telaAmostras({ lista: l, filtro: {}, configurado: true, existe: true, erro: null, sem: semRegistro(l, mercado), usosDe: () => 2, hoje: "2026-10-13" });
  assert.match(h, /28 d esperando/); assert.match(h, /Naxos/); assert.match(h, /<td class="c-usos">2<\/td>/); assert.match(h, /class="tabelao am-tab"/);
  assert.doesNotMatch(h, /data-ed=/);   // sem aba Mercado na planilha: tier/arquétipo só leitura
  assert.match(telaAmostras({ lista: l, filtro: {}, configurado: true, existe: true, sem: [], editavel: true, arquetipos: [{ nome: "Monge" }] }), /data-ed="Tier" data-id="Amouage\|\|Search"/);
  assert.match(telaAmostras({ lista: null, filtro: {}, configurado: false, sem: [] }), /Conecte a planilha/);
  assert.match(telaAmostras({ lista: [], filtro: {}, configurado: true, existe: false, sem: [] }), /Nenhuma amostra/);
  const f = fichaAmostra({ casa: "", nome: "", m: null }, { arquetipos: [{ nome: "Monge" }], nomes: ["Search"], novo: true, podeAvaliar: true, hoje: "2026-10-13" });
  assert.match(f, /id="av-add" checked/); assert.match(f, /id="av-posse" data-mexido="1"/);
  assert.doesNotMatch(fichaAmostra(l[1], { arquetipos: [], nomes: [], novo: false, podeAvaliar: true }), /av-add|data-mexido/);
});
