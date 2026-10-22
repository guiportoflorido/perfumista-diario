// Duelo “Qual dos dois?”: pareamento por prioridade e balanceamento, Elo determinístico a partir do log, aba Duelos no backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pareamento, elo, lerDuelos, duelosUnificados, descompassos, powerRanking, gerarCenario, cenarioValido, brilhaCai, ajustar, textoCenario, horaAmPm, previsao, ehZebra, movimentoSemana, titulos, climaCenario } from "../app/duelo.js";
import { carregarBackend } from "../tools/planilha_falsa.mjs";

const F = (nome, arquetipo, tier, extra = {}) => ({ nome, arquetipo, tier, camada: "grade", ...extra });
const fs = [F("X1", "Rosal", "A"), F("X2", "Rosal", "A"), F("X3", "Rosal", "B"), F("Y1", "Monge", "S"), F("Z1", "Sultão", "C"),
  F("Custo", "Rosal", "A", { camada: "custo" }), F("Dê", "Rosal", "D")];
const fixo = v => () => v;
const nomes = p => p.map(f => f.nome).sort().join("+");
let seq = 0;
const D = (a, b, vencedor) => { seq++; return { data: "2026-10-20", hora: `10:${String(seq).padStart(2, "0")}`, a, b, vencedor }; };

test("pareamento: sem duelos, mesmo arquétipo e mesmo tier; nunca a camada custo nem tier D; nunca o mesmo frasco", () => {
  for (const r of [0, 0.3, 0.7, 0.99]) {
    const p = pareamento(fs, [], fixo(r));
    assert.equal(nomes(p), "X1+X2");
    assert.notEqual(p[0].nome, p[1].nome);
  }
  assert.equal(pareamento([fs[0]], []), null);
});

test("pareamento: com o par já visto, prefere pares menos vistos (mesmo arquétipo, tier vizinho)", () => {
  const p = pareamento(fs, [D("X1", "X2", "X1")], fixo(0));
  assert.match(nomes(p), /^X[12]\+X3$/);
  const muitos = [D("X1", "X2", "X1"), D("X1", "X3", "X1"), D("X2", "X3", "X3"), D("X1", "X2", "X2")];
  const q = pareamento(fs, muitos, fixo(0));
  assert.ok(!["X1+X2", "X1+X3", "X2+X3"].includes(nomes(q)), nomes(q));
});

test("1 · sem duelos: todos em 1500, n 0", () => {
  const m0 = elo([], fs);
  assert.deepEqual(m0.get("X1"), { rating: 1500, n: 0, vitorias: 0 });
  for (const x of powerRanking([], fs)) { assert.equal(x.rating, 1500); assert.equal(x.delta_vs_geral, 0); }
});

test("2 · embaralhar o log não muda o resultado", () => {
  const log = [D("X1", "X2", "X1"), { ...D("X2", "Y1", "Y1"), temp: "Q" }, { ...D("X1", "Y1", "="), periodo: "Noite" }, D("X3", "X1", "X3")];
  const r1 = [...elo(log, fs)], r2 = [...elo([log[2], log[0], log[3], log[1]], fs)];
  assert.deepEqual(r1, r2);
  assert.deepEqual(powerRanking(log, fs, { temp: "Q" }), powerRanking([...log].reverse(), fs, { temp: "Q" }));
});

test("3 · filtro por um valor sem nenhum duelo = ranking Geral", () => {
  const log = [{ ...D("X1", "X2", "X1"), temp: "Q" }, { ...D("X2", "Y1", "X2"), temp: "A" }, D("Y1", "Z1", "Y1")];
  const geral = powerRanking(log, fs), filtro = powerRanking(log, fs, { temp: "MF" });
  assert.deepEqual(filtro.map(x => [x.nome, x.rating]), geral.map(x => [x.nome, x.rating]));
  assert.ok(filtro.every(x => x.n_recorte === 0 && x.delta_vs_geral === 0));
});

test("4 · A vence B 10× no MQ e perde 10× no F: acima no MQ, abaixo no F, perto do empate no Geral", () => {
  const log = [...Array.from({ length: 10 }, () => ({ ...D("X1", "X2", "X1"), temp: "MQ" })), ...Array.from({ length: 10 }, () => ({ ...D("X1", "X2", "X2"), temp: "F" }))];
  const r = filtro => Object.fromEntries(powerRanking(log, fs, filtro).map(x => [x.nome, x]));
  assert.ok(r({ temp: "MQ" }).X1.rating > r({ temp: "MQ" }).X2.rating + 50);
  assert.ok(r({ temp: "F" }).X1.rating < r({ temp: "F" }).X2.rating - 50);
  assert.ok(Math.abs(r({}).X1.rating - r({}).X2.rating) < 1);
  assert.equal(r({ temp: "MQ" }).X1.n_recorte, 10);
  const bc = brilhaCai(log, "X1");
  assert.equal(bc.brilha[0].v, "MQ"); assert.equal(bc.cai[0].v, "F");
});

test("5 · empate conta como 0,5 (fica entre vitória e derrota, e ninguém sai do lugar)", () => {
  const e = elo([D("X1", "X2", "=")], fs);
  assert.ok(Math.abs(e.get("X1").rating - 1500) < 1e-6 && Math.abs(e.get("X2").rating - 1500) < 1e-6);
  assert.equal(e.get("X1").vitorias, 0); assert.equal(e.get("X1").n, 1);
  const v = elo([D("X1", "X2", "X1")], fs), dv = elo([D("X1", "X2", "X2")], fs);
  assert.ok(v.get("X1").rating > 1500 && dv.get("X1").rating < 1500);
  assert.ok(Math.abs((v.get("X1").rating - 1500) + (dv.get("X1").rating - 1500)) < 1e-6);
});

test("6 · linha antiga “faixa 2 · Dia · …” → modo agora, temp A, período pela hora", () => {
  const [d] = lerDuelos([["Data", "Hora", "A", "B", "Vencedor", "Contexto"], ["2026-10-20", "21:05:00", "X1", "X2", "X2", "faixa 2 · Dia · mesmo arquétipo"]]);
  assert.deepEqual([d.modo, d.temp, d.periodo, d.td, d.chuva, d.ocasiao, d.sub], ["agora", "A", "Noite", "", "", "", ""]);
  const [n] = lerDuelos([["Data"], ["2026-10-21", "14:00:00", "X1", "X2", "=", "", "cenario", "Q", "carregado", "pancada", "Tarde", "T.Inf", "almoço de trabalho"]]);
  assert.deepEqual([n.vencedor, n.modo, n.temp, n.sub], ["=", "cenario", "Q", "almoço de trabalho"]);
});

test("7 · 5.000 cenários sorteados, nenhum vetado; texto com números concretos", () => {
  let s = 7;
  const aleatorio = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const vistos = new Set();
  for (let i = 0; i < 5000; i++) {
    const c = gerarCenario([], aleatorio);
    assert.ok(cenarioValido(c), JSON.stringify(c));
    assert.ok(c.hora >= 8 && c.hora <= 23 && c.periodo !== "Madrugada", `hora ${c.hora}`);
    assert.match(textoCenario(c), /, (1[0-2]|[1-9]) (AM|PM) · /);
    vistos.add(c.sub);
  }
  assert.ok(vistos.size >= 20, `só ${vistos.size} sub-ocasiões`);
  assert.equal(cenarioValido({ periodo: "Madrugada", temp: "Q" }), false);
  assert.equal(cenarioValido({ periodo: "Tarde", temp: "A", chuva: "continua", sub: "praia/piscina", ocasiao: "Lazer" }), false);
  assert.equal(cenarioValido({ periodo: "Noite", temp: "A", sub: "home office", ocasiao: "Cozy D" }), false);
});

test("pareamento no modo Cenário prefere par de resultado incerto", () => {
  // X1 sempre ganha de X2 no MQ: com o cenário MQ, o par X1×X2 fica previsível e perde para X1×X3 / X2×X3 empatados em vistos
  const log = Array.from({ length: 6 }, () => ({ ...D("X1", "X2", "X1"), temp: "MQ" }));
  const sem = pareamento(fs, [], fixo(0)), com = pareamento(fs, log.slice(0, 0), fixo(0), { temp: "MQ" });
  assert.equal(nomes(sem), nomes(com));   // sem duelos, p̂ = 0,5 em todo par: igual ao modo Agora
  const ajuste = ajustar(log);
  assert.ok(ajuste.score("X1", { temp: "MQ" }) > ajuste.score("X2", { temp: "MQ" }));
});

test("lerDuelos / unificar com a fila / descompassos", () => {
  const rows = [["Data", "Hora", "A", "B", "Vencedor", "Contexto"], ["2026-10-20", "21:05", "X1", "X2", "X2", "faixa 3 · Noite"], ["lixo", "", "", "", "", ""],
    ["2026-10-19", "08:00", "X1", "X3", "Y1", ""]];
  const p = lerDuelos(rows);
  assert.equal(p.length, 1); assert.equal(p[0].vencedor, "X2");
  const u = duelosUnificados(p, [{ id: "a", data: "2026-10-20", hora: "21:05", a: "X1", b: "X2", vencedor: "X2" }, { id: "b", data: "2026-10-21", hora: "07:00", a: "X1", b: "X3", vencedor: "X3" }]);
  assert.equal(u.length, 2);
  const m = new Map([["X1", { rating: 1400, n: 6 }], ["X3", { rating: 1600, n: 5 }], ["X2", { rating: 1300, n: 4 }]]);
  assert.deepEqual(descompassos(m, fs).map(x => x.f.nome), ["X1", "X3"]);
});

test("backend: duelo_registrar cria a aba Duelos, não duplica no reenvio e valida; dados devolve duelos", () => {
  const abas = { "Tiers": [["Casa", "Perfume"]], "Diário": [["Data"]] };
  const b = carregarBackend(abas);
  assert.deepEqual(b.post({ token: "dev", acao: "dados" }).dados.duelos, []);
  const l = { id: "a", data: "2026-10-20", hora: "21:05", a: "Odéon", b: "Liwa", vencedor: "Liwa", contexto: "faixa 3 · Noite · mesmo arquétipo" };
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [l] }).ok, true);
  assert.deepEqual(abas["Duelos"], [["Data", "Hora", "A", "B", "Vencedor", "Contexto", "Modo", "Temp", "Td", "Chuva", "Período", "Ocasião", "Sub"],
    ["2026-10-20", "21:05", "Odéon", "Liwa", "Liwa", "faixa 3 · Noite · mesmo arquétipo", "agora", "", "", "", "", "", ""]]);
  assert.deepEqual(b.post({ token: "dev", acao: "duelo_registrar", linhas: [l] }).gravadas, [{ id: "a", duplicada: true }]);
  assert.equal(abas["Duelos"].length, 2);
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [{ ...l, vencedor: "Outro" }] }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "duelos" }).duelos.length, 2);
});

test("8 · backend: aceita empate “=” e o cenário, rejeita valor fora da lista, migra o cabeçalho de 6 colunas sem duplicar", () => {
  const velha = [["Data", "Hora", "A", "B", "Vencedor", "Contexto"], ["2026-10-19", "10:00", "Odéon", "Liwa", "Odéon", "faixa 2 · Dia"]];
  const abas = { "Tiers": [["Casa", "Perfume"]], "Diário": [["Data"]], "Duelos": velha.map(r => [...r]) };
  const b = carregarBackend(abas);
  const l = { id: "c", data: "2026-10-21", hora: "14:00:00", a: "Odéon", b: "Liwa", vencedor: "=", contexto: "Quinta, 14h · 29°C", modo: "cenario",
    temp: "Q", td: "carregado", chuva: "pancada", periodo: "Tarde", ocasiao: "T.Inf", sub: "almoço de trabalho" };
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [l] }).ok, true);
  assert.deepEqual(abas["Duelos"][0], ["Data", "Hora", "A", "B", "Vencedor", "Contexto", "Modo", "Temp", "Td", "Chuva", "Período", "Ocasião", "Sub"]);
  assert.deepEqual(abas["Duelos"][2], ["2026-10-21", "14:00:00", "Odéon", "Liwa", "=", "Quinta, 14h · 29°C", "cenario", "Q", "carregado", "pancada", "Tarde", "T.Inf", "almoço de trabalho"]);
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [{ ...l, id: "d", hora: "15:00:00" }] }).ok, true);
  assert.equal(abas["Duelos"][0].length, 13, "cabeçalho não duplica");
  assert.equal(abas["Duelos"].filter(r => r[0] === "Data").length, 1);
  for (const [k, v] of [["temp", "Morno"], ["chuva", "garoa"], ["periodo", "Manhã"], ["sub", "padaria"], ["modo", "teste"]])
    assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [{ ...l, id: "x" + k, hora: "16:00:00", [k]: v }] }).ok, false, k);
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [{ ...l, id: "y", hora: "17:00:00", ocasiao: "Lazer" }] }).ok, false, "sub de outra ocasião");
  const lidos = lerDuelos(b.post({ token: "dev", acao: "duelos" }).duelos);
  assert.equal(lidos.length, 3); assert.equal(lidos[0].temp, "A"); assert.equal(lidos[1].vencedor, "=");
});

test("hora do cenário em AM/PM", () => {
  assert.deepEqual([8, 11, 12, 14, 23].map(horaAmPm), ["8 AM", "11 AM", "12 PM", "2 PM", "11 PM"]);
});

// ───────────── diversão ─────────────
const Dd = (data, a, b, vencedor, extra = {}) => ({ data, hora: `${String(seq++).padStart(6, "0")}`, a, b, vencedor, ...extra });

test("zebra: só quando o escolhido tinha ≤ 30 % e os dois já têm 3+ duelos", () => {
  const log = Array.from({ length: 6 }, () => Dd("2026-10-10", "X1", "X2", "X1"));
  const pr = previsao(log, "X1", "X2");
  assert.ok(pr.p > 0.7 && pr.nA === 6);
  assert.equal(ehZebra(pr, false), true);    // escolheu X2
  assert.equal(ehZebra(pr, true), false);
  assert.equal(ehZebra(previsao(log.slice(0, 2), "X1", "X2"), false), false, "poucos duelos: não é zebra");
});

test("movimento na semana: quem ganhou nos últimos 7 dias sobe; quem estreou é novo", () => {
  const velho = [Dd("2026-10-01", "X1", "X2", "X1"), Dd("2026-10-01", "X1", "X3", "X1"), Dd("2026-10-02", "X2", "X3", "X2")];
  const novo = [...velho, ...Array.from({ length: 4 }, () => Dd("2026-10-20", "X3", "X1", "X3")), Dd("2026-10-20", "Y1", "Z1", "Y1")];
  const mv = movimentoSemana(novo, fs, "2026-10-22");
  assert.ok(mv.get("X3").sobe > 0 && mv.get("X1").sobe < 0);
  assert.equal(mv.get("Y1").antes, null);
  assert.equal(movimentoSemana([], fs, "2026-10-22").size, 0);
});

test("títulos: quem mais sobe num valor (n ≥ 3) leva o título; cara do cenário", () => {
  const log = Array.from({ length: 5 }, () => Dd("2026-10-10", "X1", "X2", "X1", { temp: "MQ" }));
  const t = titulos(log, fs);
  assert.equal(t.find(x => x.k === "temp" && x.v === "MQ")?.nome, "X1");
  assert.equal(t.find(x => x.v === "MQ").titulo, "☀️ Rei do sol");
  assert.deepEqual(titulos([], fs), []);
  assert.deepEqual(climaCenario({ chuva: "continua", temp: "F", periodo: "Tarde" }), { emoji: "🌧️", tom: "fresco" });
  assert.deepEqual(climaCenario({ chuva: "sem", temp: "Q", periodo: "Noite" }), { emoji: "🌙", tom: "quente noite" });
});
