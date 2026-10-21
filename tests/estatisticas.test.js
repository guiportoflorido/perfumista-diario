// Contas do Histórico/Coleção: janelas batem com o playbook, camada custo fora, esquecidos, uso × janelas, calibração.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { janelasPorFrasco, contagens, esquecidos, usoVsJanelas, calibracao, ajustarSprays, daGrade } from "../app/estatisticas.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;
const playbook = JSON.parse(readFileSync(new URL("../data/playbook.json", import.meta.url)));
const f = n => frascos.find(x => x.nome === n);

test("janelas por frasco = coluna Janelas (654 no total, 70 frascos — Bedouin Rose C desde 14/out)", () => {
  const j = janelasPorFrasco(playbook);
  for (const x of frascos.filter(daGrade)) assert.equal((j.get(x.nome) || []).length, x.janelas, x.nome);
  assert.equal([...j.values()].reduce((s, a) => s + a.length, 0), 654);
  assert.equal(j.get("Bedouin Rose").map(w => `${w.faixa}×${w.ocasiao}`).sort().join(" | "), "Frio×Cozy N | Frio×N.For | Muito Frio×N.Inf");
  assert.ok(j.get("Désobéissant").some(w => w.faixa === "Muito Quente" && w.ocasiao === "Lazer" && w.papel === "Seguro"));
});

test("contagens: só grade (camada custo e fora da coleção não contam), 30 dias, slots, cobertura", () => {
  const hist = [{ data: "2026-09-01", slot: "M", perfume: "Odéon" }, { data: "2026-10-08", slot: "N", perfume: "Odéon" },
    { data: "2026-10-08", slot: "M", perfume: "Sky" }, { data: "2026-10-04", slot: "M", perfume: "Acqua Viva" }];
  const c = contagens(hist, frascos, "2026-10-09");
  assert.equal(c.por.size, 70); assert.equal(c.total, 2); assert.equal(c.foraDaGrade, 2);
  assert.deepEqual((({ n, n30, M, N, ultimo, dias }) => ({ n, n30, M, N, ultimo, dias }))(c.por.get("Odéon")), { n: 2, n30: 1, M: 1, N: 1, ultimo: "2026-10-08", dias: 1 });
  assert.equal(c.cobertura, 39);
  const esq = esquecidos(c.por);
  assert.ok(!esq.some(x => x.f.nome === "Odéon")); assert.equal(esq.length, 69);
  assert.equal(esq[0].f.tier, "S");
  const u = usoVsJanelas(c.por).find(x => x.nome === "Odéon");
  assert.ok(Math.abs(u.esperado - 2 * 9 / 654) < 1e-12);
});

test("calibração: real − sugerido por frasco e geral, ignorando registros sem sugestão", () => {
  const cal = calibracao([{ data: "2026-10-01", slot: "M", perfume: "Odéon", sprays: "4", sugerido: "2", estado: "enviado" },
    { data: "2026-10-02", slot: "M", perfume: "Odéon", sprays: "3", sugerido: "2", estado: "enviado" },
    { data: "2026-10-03", slot: "N", perfume: "Liwa", sprays: "3", sugerido: "3", estado: "pendente" },
    { data: "2026-10-04", slot: "N", perfume: "Liwa", sprays: "5", sugerido: "", estado: "enviado" },
    { data: "2026-10-05", slot: "N", perfume: "Liwa", sprays: "9", sugerido: "2", estado: "descartado" }]);
  assert.equal(cal.n, 3); assert.equal(cal.geral, 1);
  assert.deepEqual(cal.por, [{ nome: "Odéon", n: 2, media: 1.5 }, { nome: "Liwa", n: 1, media: 0 }]);
});

test("calibração com o histórico unificado: lê a coluna Sugerido da planilha e não conta duas vezes o mesmo registro", () => {
  const planilha = [
    { data: "2026-10-10", slot: "M", perfume: "Odéon", sprays: "4", sugerido: "2", linha: 2 },      // já tem Sugerido na planilha
    { data: "2026-10-11", slot: "N", perfume: "Liwa", sprays: "5", sugerido: "", linha: 3 },        // gravado antes da coluna existir
    { data: "2026-10-12", slot: "M", perfume: "Liwa", sprays: "3,5", sugerido: "3", linha: 4 }];
  const filaLocal = [
    { data: "2026-10-10", slot: "M", perfume: "Odéon", sprays: "4", sugerido: "2", estado: "enviado" },   // mesmo do 1º: não duplica
    { data: "2026-10-11", slot: "N", perfume: "Liwa", sprays: "5", sugerido: "3", estado: "enviado" }];  // a cópia local tem o sugerido
  const cal = calibracao([...planilha, ...filaLocal]);
  assert.equal(cal.n, 3);
  assert.deepEqual(cal.por, [{ nome: "Odéon", n: 1, media: 2 }, { nome: "Liwa", n: 2, media: 1.25 }]);
});

test("ajuste +N: desligado por padrão, respeita tetos dos beasts e não mexe no Désobéissant", () => {
  assert.equal(ajustarSprays(f("Odéon"), 2, { ativo: false, geral: 2 }), 2);
  assert.equal(ajustarSprays(f("Odéon"), 2, { ativo: true, geral: 1 }), 3);
  assert.equal(ajustarSprays(f("Odéon"), 3, { ativo: true, geral: 3 }), 4);           // EDP: teto 4
  assert.equal(ajustarSprays(f("Green Irish Tweed"), 4, { ativo: true, geral: 3 }), 5); // EDT: teto 5
  assert.equal(ajustarSprays(f("Ombre Nomade"), 2, { ativo: true, geral: 3 }), 3);     // beast: 3
  assert.equal(ajustarSprays(f("Oud Satin Mood"), 1, { ativo: true, geral: 3 }), 2);   // beast: 2
  assert.equal(ajustarSprays(f("Désobéissant"), 6, { ativo: true, geral: 2 }), 6);
  assert.equal(ajustarSprays(f("Liwa"), 3, { ativo: true, geral: 0, por: { Liwa: 1 } }), 4);
});

import { notaPorFrascoFaixa, notaNum } from "../app/estatisticas.js";
test("NotaDia: média geral e por faixa de temperatura; sem Temp só na geral; só Dia/Noite e só a grade", () => {
  const hist = [
    { data: "2026-10-01", slot: "M", perfume: "Odéon", notaDia: "4", temp: "24" },      // Ameno
    { data: "2026-10-02", slot: "N", perfume: "Odéon", notaDia: "2", temp: "23,5" },    // Ameno
    { data: "2026-10-03", slot: "M", perfume: "Odéon", notaDia: "3", temp: "29" },      // Quente
    { data: "2026-10-04", slot: "N", perfume: "Odéon", notaDia: "5", temp: "" },        // sem Temp: só na geral
    { data: "2026-10-05", slot: "M2", perfume: "Odéon", notaDia: "1", temp: "24" },     // 2ª aplicação: fora
    { data: "2026-10-06", slot: "M", perfume: "Odéon", notaDia: "8,5", temp: "24" },    // escala antiga: fora
    { data: "2026-10-07", slot: "M", perfume: "Sky", notaDia: "2", temp: "30" },        // camada custo: fora
    { data: "2026-10-08", slot: "N", perfume: "Liwa", notaDia: "", temp: "20" }];       // sem nota
  const m = notaPorFrascoFaixa(hist, frascos);
  assert.deepEqual([...m.keys()], ["Odéon"]);
  const o = m.get("Odéon");
  assert.equal(o.n, 4); assert.equal(o.media, 3.5);
  assert.deepEqual([...o.faixas], [[1, { n: 1, media: 3 }], [2, { n: 2, media: 3 }]]);   // 1 = Quente, 2 = Ameno
  assert.equal(notaNum("3,5"), 3.5); assert.equal(notaNum("0"), null); assert.equal(notaNum(""), null);
});

import { sobrevivencia } from "../app/estatisticas.js";
test("sobrevivência: a resposta da Noite conta para o último perfume do Dia da mesma data", () => {
  const hist = [
    { data: "2026-10-01", slot: "M", perfume: "Odéon" }, { data: "2026-10-01", slot: "N", perfume: "Liwa", vivo: "vivo" },
    { data: "2026-10-02", slot: "M", perfume: "Odéon" }, { data: "2026-10-02", slot: "N", perfume: "Liwa", vivo: "fraco" },
    { data: "2026-10-03", slot: "M", perfume: "Odéon" }, { data: "2026-10-03", slot: "M2", perfume: "Hacivat" },   // 2ª do Dia: vale a última
    { data: "2026-10-03", slot: "N", perfume: "Liwa", vivo: "morto" },
    { data: "2026-10-04", slot: "N", perfume: "Liwa", vivo: "vivo" },                                             // sem manhã: não conta
    { data: "2026-10-05", slot: "M", perfume: "Odéon" }, { data: "2026-10-05", slot: "N", perfume: "Liwa", vivo: "" },   // sem resposta
    { data: "2026-10-06", slot: "M", perfume: "Acqua Viva" }, { data: "2026-10-06", slot: "N", perfume: "Liwa", vivo: "vivo" }];   // fora dos frascos
  const s = sobrevivencia(hist, frascos);
  assert.deepEqual(Object.fromEntries(s), { "Odéon": { n: 2, vivo: 1, fraco: 1, morto: 0 }, "Hacivat": { n: 1, vivo: 0, fraco: 0, morto: 1 } });
});
