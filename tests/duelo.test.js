// Duelo “Qual dos dois?”: pareamento por prioridade e balanceamento, Elo determinístico a partir do log, aba Duelos no backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pareamento, elo, lerDuelos, duelosUnificados, descompassos } from "../app/duelo.js";
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

test("elo: log vazio → 1500 e n 0; determinístico; vitória sobe o vencedor e desce o perdedor", () => {
  const m0 = elo([], fs);
  assert.deepEqual(m0.get("X1"), { rating: 1500, n: 0, vitorias: 0 });
  const log = [D("X1", "X2", "X1"), D("X2", "Y1", "Y1")];
  assert.deepEqual([...elo(log, fs)], [...elo(log, fs)]);
  const m = elo([D("X1", "X2", "X1")], fs);
  assert.equal(m.get("X1").rating, 1516); assert.equal(m.get("X2").rating, 1484);
  assert.equal(m.get("X1").vitorias, 1); assert.equal(m.get("X2").n, 1);
});

test("elo: K = 32 nos 10 primeiros duelos do frasco, depois 16", () => {
  // X1 e X2 se alternam vencendo: depois de 10 duelos cada, o 11º move metade
  const log = Array.from({ length: 10 }, (_, i) => D("X1", "X2", i % 2 ? "X2" : "X1"));
  const antes = elo(log, fs).get("X1").rating;
  const depois = elo([...log, D("X1", "X2", "X1")], fs).get("X1").rating;
  const e = 1 / (1 + 10 ** ((elo(log, fs).get("X2").rating - antes) / 400));
  assert.ok(Math.abs((depois - antes) - 16 * (1 - e)) < 1e-9);
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
  assert.deepEqual(abas["Duelos"], [["Data", "Hora", "A", "B", "Vencedor", "Contexto"], ["2026-10-20", "21:05", "Odéon", "Liwa", "Liwa", "faixa 3 · Noite · mesmo arquétipo"]]);
  assert.deepEqual(b.post({ token: "dev", acao: "duelo_registrar", linhas: [l] }).gravadas, [{ id: "a", duplicada: true }]);
  assert.equal(abas["Duelos"].length, 2);
  assert.equal(b.post({ token: "dev", acao: "duelo_registrar", linhas: [{ ...l, vencedor: "Outro" }] }).ok, false);
  assert.equal(b.post({ token: "dev", acao: "duelos" }).duelos.length, 2);
});
