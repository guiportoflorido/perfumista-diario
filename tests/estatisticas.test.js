// Contas do Histórico/Coleção: janelas batem com o playbook, camada custo fora, esquecidos, uso × janelas, calibração.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { janelasPorFrasco, contagens, esquecidos, usoVsJanelas, calibracao, ajustarSprays, daGrade } from "../app/estatisticas.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;
const playbook = JSON.parse(readFileSync(new URL("../data/playbook.json", import.meta.url)));
const f = n => frascos.find(x => x.nome === n);

test("janelas por frasco = coluna Janelas (668 no total, 71 frascos — playbook v60: Bedouin Rose só Cozy Noite)", () => {
  const j = janelasPorFrasco(playbook);
  for (const x of frascos.filter(daGrade)) assert.equal((j.get(x.nome) || []).length, x.janelas, x.nome);
  assert.equal([...j.values()].reduce((s, a) => s + a.length, 0), 668);
  assert.equal(j.get("Bedouin Rose").map(w => `${w.faixa}×${w.ocasiao}`).sort().join(" | "), "Frio×Cozy N | Muito Frio×Cozy N");
  assert.ok(j.get("Désobéissant").some(w => w.faixa === "Muito Quente" && w.ocasiao === "Lazer" && w.papel === "Seguro"));
});

test("contagens: só grade (camada custo e fora da coleção não contam), 30 dias, slots, cobertura", () => {
  const hist = [{ data: "2026-09-01", slot: "M", perfume: "Odéon" }, { data: "2026-10-08", slot: "N", perfume: "Odéon" },
    { data: "2026-10-08", slot: "M", perfume: "Sky" }, { data: "2026-10-04", slot: "M", perfume: "Acqua Viva" }];
  const c = contagens(hist, frascos, "2026-10-09");
  assert.equal(c.por.size, 71); assert.equal(c.total, 2); assert.equal(c.foraDaGrade, 2);
  assert.deepEqual((({ n, n30, M, N, ultimo, dias }) => ({ n, n30, M, N, ultimo, dias }))(c.por.get("Odéon")), { n: 2, n30: 1, M: 1, N: 1, ultimo: "2026-10-08", dias: 1 });
  assert.equal(c.cobertura, 39);
  const esq = esquecidos(c.por);
  assert.ok(!esq.some(x => x.f.nome === "Odéon")); assert.equal(esq.length, 70);
  assert.equal(esq[0].f.tier, "S");
  const u = usoVsJanelas(c.por).find(x => x.nome === "Odéon");
  assert.ok(Math.abs(u.esperado - 2 * 9 / 668) < 1e-12);
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

test("NotaDia por ocasião: código do engine ou rótulo de tela, só Dia/Noite e grade", async () => {
  const { notaPorFrascoOcasiao } = await import("../app/estatisticas.js");
  const hist = [{ data: "2026-10-01", slot: "M", perfume: "Odéon", ocasiao: "T.Inf", notaDia: "4" },
    { data: "2026-10-02", slot: "N", perfume: "Odéon", ocasiao: "Trab. Informal", notaDia: "5" },
    { data: "2026-10-03", slot: "M2", perfume: "Odéon", ocasiao: "T.Inf", notaDia: "1" },
    { data: "2026-10-04", slot: "M", perfume: "Odéon", ocasiao: "", notaDia: "1" },
    { data: "2026-10-05", slot: "M", perfume: "Odéon", ocasiao: "Cozy N", notaDia: "3" }];
  const m = notaPorFrascoOcasiao(hist, frascos).get("Odéon");
  assert.deepEqual([...m], [["T.Inf", { n: 2, media: 4.5 }], ["Cozy N", { n: 1, media: 3 }]]);
});

test("semana ISO", async () => {
  const { semanaISO } = await import("../app/estatisticas.js");
  assert.equal(semanaISO("2026-10-21"), "2026-W43");
  assert.equal(semanaISO("2026-10-19"), "2026-W43"); assert.equal(semanaISO("2026-10-25"), "2026-W43"); assert.equal(semanaISO("2026-10-26"), "2026-W44");
  assert.equal(semanaISO("2026-01-01"), "2026-W01"); assert.equal(semanaISO("2025-12-29"), "2026-W01"); assert.equal(semanaISO("2027-01-01"), "2026-W53");
});

test("esquecido da semana: usável de maior score; só não-usáveis → o mais antigo com aviso; sem esquecidos → null", async () => {
  const { esquecidoDaSemana } = await import("../app/estatisticas.js");
  const esq = [{ f: f("Odéon"), dias: 50 }, { f: f("Météore"), dias: 80 }, { f: f("Liwa"), dias: null }];
  const so = { ranking: [{ nome: "Odéon", score: 70 }, { nome: "Météore", score: 82 }], fora: { Liwa: "frio" } };
  assert.deepEqual(esquecidoDaSemana(esq, so, "2026-W43"), { nome: "Météore", dias: 80, score: 82, usavel: true, semana: "2026-W43" });
  const so2 = { ranking: [], fora: { "Odéon": "x", "Météore": "x", Liwa: "x" } };
  assert.deepEqual(esquecidoDaSemana(esq, so2, "2026-W43"), { nome: "Liwa", dias: null, score: null, usavel: false, semana: "2026-W43" });
  assert.equal(esquecidoDaSemana([], so, "2026-W43"), null);
});

// ───────────── Wrapped do mês ─────────────
test("resumoMes: mês vazio → tudo nulo", async () => {
  const { resumoMes } = await import("../app/estatisticas.js");
  const r = resumoMes([{ data: "2026-10-01", slot: "M", perfume: "Odéon" }], frascos, 2026, 11);
  for (const k of ["total", "distintos", "frascoDoMes", "arquetipo", "maisQuente", "maisFrio", "resgates", "notaMedia", "sequencia", "subidao", "material"]) assert.equal(r[k], null, k);
});

test("resumoMes: frasco do mês, arquétipo dominante, extremos, resgates, nota e sequência sem repetir arquétipo", async () => {
  const { resumoMes } = await import("../app/estatisticas.js");
  const { definirMateriais } = await import("../app/diversao.js");
  definirMateriais(JSON.parse(readFileSync(new URL("../data/arquetipos.json", import.meta.url))).arquetipos);
  const R = (data, slot, perfume, extra = {}) => ({ data: `2026-${data}`, slot, perfume, ...extra });
  const hist = [R("08-01", "M", "Odéon"), R("09-01", "M", "Liwa"), R("09-10", "M", "Decision"), R("09-20", "M", "Météore"), R("09-25", "M", "Tygar Extrait"), R("09-28", "M", "Bijou Zafran"),
    // outubro: 20 registros de Dia/Noite (+ um de Esportes e um da camada custo, que não contam)
    R("10-01", "M", "Météore", { temp: "25", notaDia: "4" }), R("10-01", "N", "Liwa"), R("10-02", "M", "Météore", { temp: "28", notaDia: "5" }), R("10-02", "N", "Odéon"),
    R("10-03", "M", "Tygar Extrait", { temp: "31" }), R("10-03", "N", "Bijou Zafran"), R("10-04", "M", "Météore", { temp: "22", notaDia: "3" }), R("10-04", "N", "Liwa"),
    R("10-05", "M", "Amyris Homme Extrait", { temp: "15" }), R("10-05", "N", "Decision"), R("10-06", "M", "Météore", { temp: "24" }), R("10-07", "M", "Odéon"),
    R("10-07", "N", "Liwa"), R("10-08", "M", "Tygar Extrait"), R("10-09", "M", "Liwa"), R("10-10", "M", "Liwa"), R("10-12", "M", "Météore"),
    R("10-13", "M", "Météore"), R("10-14", "M", "Decision"), R("10-15", "M", "Odéon"), R("10-15", "E", "Acqua Viva"), R("10-16", "M", "Acqua Viva")];
  const r = resumoMes(hist, frascos, 2026, 10);
  assert.equal(r.total, 20); assert.equal(r.distintos, 7); assert.equal(r.totalGrade, 71);
  assert.deepEqual(r.frascoDoMes, { nome: "Météore", n: 6, nota: 4, arquetipo: "Geólogo" });
  assert.deepEqual(r.arquetipo, { nome: "Geólogo", pct: 0.3 });
  assert.deepEqual(r.maisQuente, { data: "2026-10-03", T: 31, perfume: "Tygar Extrait" });
  assert.deepEqual(r.maisFrio, { data: "2026-10-05", T: 15, perfume: "Amyris Homme Extrait" });
  assert.deepEqual(r.resgates, ["Odéon", "Amyris Homme Extrait"]);
  assert.equal(r.notaMedia, 4);
  assert.equal(r.sequencia, 8);
  assert.equal(r.subidao, null);
  assert.equal(r.dias.get("2026-10-05"), "Lareira"); assert.equal(r.dias.size, 14);
  assert.ok(typeof r.material === "string");
});

test("storiesDoMes: 6 a 8 stories, pula campos nulos, termina na grade dos dias; mês vazio → nenhum", async () => {
  const { storiesDoMes } = await import("../app/wrapped.js");
  const base = { total: 20, distintos: 7, totalGrade: 70, frascoDoMes: { nome: "Météore", n: 6, nota: 4, arquetipo: "Geólogo" }, arquetipo: { nome: "Geólogo", pct: .3 },
    maisQuente: { data: "2026-10-03", T: 31, perfume: "Tygar Extrait" }, maisFrio: { data: "2026-10-05", T: 15, perfume: "Amyris Homme Extrait" },
    resgates: ["Odéon"], notaMedia: 4, sequencia: 8, subidao: { nome: "Liwa", de: 1500, para: 1540, ganho: 40 }, material: "Vetiver", dias: new Map([["2026-10-05", "Lareira"]]) };
  const st = storiesDoMes(base, 2026, 10);
  assert.equal(st.length, 8);
  assert.equal(st.at(-1).numero, "Outubro foi Vetiver"); assert.equal(st.at(-1).dias.length, 31); assert.equal(st.at(-1).dias[4], "Lareira");
  const pouco = storiesDoMes({ ...base, maisQuente: null, maisFrio: null, resgates: null, subidao: null }, 2026, 10);
  assert.equal(pouco.length, 6);
  for (const s of pouco) assert.ok(!/\bnull\b|undefined|NaN/.test(s.numero + s.frase), s.rotulo);
  assert.deepEqual(storiesDoMes({ total: null }, 2026, 11), []);
});

// ───────────── Análises ─────────────
test("análises: aderência ao playbook, concentração, uso por tier, dia da semana, constância", async () => {
  const E = await import("../app/estatisticas.js");
  const j = janelasPorFrasco(playbook);
  const odeonJ = j.get("Odéon")[0];   // uma janela real do Odéon
  const T = { 0: 34, 1: 29, 2: 24, 3: 19, 4: 14, 5: 10 }[odeonJ.faixaIdx];
  const hist = [
    { data: "2026-10-19", slot: "M", perfume: "Odéon", ocasiao: odeonJ.ocasiao, temp: String(T) },          // dentro
    { data: "2026-10-19", slot: "N", perfume: "Odéon", ocasiao: "T.For", temp: "35" },                       // fora
    { data: "2026-10-20", slot: "M", perfume: "Météore", ocasiao: "", temp: "" },                            // sem dados: não conta
    { data: "2026-10-21", slot: "M", perfume: "Météore" }, { data: "2026-10-22", slot: "N", perfume: "Liwa" },
  ];
  const a = E.aderenciaPlaybook(hist, frascos, j);
  assert.deepEqual([a.n, a.dentro, a.fora.length], [2, 1, 1]);
  const c = contagens(hist, frascos, "2026-10-22");
  const k = E.concentracao(c.por);
  assert.deepEqual([k.total, k.usados, k.metade], [5, 3, 2]);
  assert.ok(Math.abs(k.efetivo - 1 / ((2 / 5) ** 2 * 2 + (1 / 5) ** 2)) < 1e-12);
  assert.equal(E.concentracao(contagens([], frascos, "2026-10-22").por), null);
  const tS = E.usoPorTier(c.por).find(x => x.tier === "S");
  assert.equal(tS.usos, 5); assert.equal(tS.parados, tS.frascos - 3);
  const sem = E.porDiaSemana(hist);
  assert.deepEqual([sem[0].M, sem[0].N, sem[1].M, sem[3].N], [1, 1, 1, 1]);   // 19/out/2026 = segunda
  const cs = E.constancia(hist, "2026-10-18", "2026-10-23");
  assert.deepEqual(cs, { total: 6, comRegistro: 4, ambos: 1, maior: 4, atual: 4 });   // 23 sem registro ainda: conta até 22
});
