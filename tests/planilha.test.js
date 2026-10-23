// Tier da planilha vence o JSON (com aviso), frasco sem "Frasco Gui" sai, diário unificado sem duplicar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerTiers, lerDiario, aplicarTiers, diarioUnificado } from "../app/planilha.js";
import { rodar } from "../engine/index.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;
const CAB = ["Casa", "Perfume", "Nome no diário", "Posse", "Tier", "Atualizado em", "Obs"];
const linha = (f, posse = "Frasco Gui", tier = f.tier) => [f.casa, f.nome + " (planilha)", f.nome, posse, tier];

test("planilha igual ao JSON → sem avisos", () => {
  const t = lerTiers([CAB, ...frascos.map(f => linha(f))]);
  const r = aplicarTiers(frascos, t);
  assert.equal(r.frascos.length, 82);
  assert.deepEqual(r.avisos, { divergentes: [], sem_posse: [], sem_linha: [] });
});

test("tier divergente usa o da planilha e avisa; posse diferente tira o frasco", () => {
  const rows = [CAB, ...frascos.map(f => f.nome === "Odéon" ? linha(f, "Frasco Gui", "B") : f.nome === "Liwa" ? linha(f, "Frasco Bia") : linha(f))];
  const r = aplicarTiers(frascos, lerTiers(rows));
  assert.deepEqual(r.avisos.divergentes, [{ nome: "Odéon", json: "S", planilha: "B" }]);
  assert.deepEqual(r.avisos.sem_posse, [{ nome: "Liwa", posse: "Frasco Bia" }]);
  assert.equal(r.frascos.find(f => f.nome === "Odéon").tier, "B");
  assert.equal(r.frascos.find(f => f.nome === "Liwa"), undefined);
  const out = rodar("Data: 2026-10-10\nT: 15-24 pico 15 noite 18\nTd: 14\n", r.frascos);
  for (const s of out.slots) assert.ok(!s.top.some(t => t.nome === "Liwa"));
  assert.equal(out.slots[1].top.find(t => t.nome === "Odéon")?.tier ?? "B", "B");
});

test("diário: planilha + fila local, sem duplicar o que já foi gravado, em ordem", () => {
  const plan = lerDiario([["Data", "Slot", "Perfume"], ["2026-10-08", "N", "Tygar Extrait"], ["2026-10-09", "M", "Météore"], ["lixo", "", ""]]);
  const local = [{ data: "2026-10-09", slot: "M", perfume: "Météore", estado: "pendente" }, { data: "2026-10-09", slot: "N", perfume: "Odéon", estado: "pendente" },
    { data: "2026-10-07", slot: "N", perfume: "Liwa", estado: "enviado" }, { data: "2026-10-08", slot: "M", perfume: "Liwa", estado: "conflito" }];
  const u = diarioUnificado(plan, local);
  assert.deepEqual(u.map(x => `${x.data}${x.slot} ${x.perfume}${x.pendente ? "*" : ""}`), ["2026-10-07N Liwa", "2026-10-08N Tygar Extrait", "2026-10-09M Météore", "2026-10-09N Odéon*"]);
});

test("lerDiario lê a coluna Sugerido (10ª); linhas antigas, sem ela, chegam com \"\"", () => {
  const d = lerDiario([["Data", "Slot", "Perfume", "Ocasião", "Temp (°C)", "Td (°C)", "Sprays", "NotaDia", "Obs", "Sugerido"],
    ["2026-10-08", "N", "Tygar Extrait"], ["2026-10-09", "M", "Météore", "T.Inf", "29", "", "4", "", "", "3"]]);
  assert.equal(d[0].sugerido, ""); assert.equal(d[1].sugerido, "3"); assert.equal(d[1].sprays, "4"); assert.equal(d[1].obs, "");
});

test("lerDiario lê Vivo (11ª coluna)", () => {
  const d = lerDiario([["Data"], ["2026-10-09", "N", "Odéon", "", "", "", "", "", "", "", "vivo"], ["2026-10-09", "M", "Météore"]]);
  assert.equal(d[0].vivo, "vivo"); assert.equal(d[1].vivo, "");
});

// ───────────── medições na pele (aplicarMedicoes) ─────────────
import { aplicarMedicoes } from "../app/planilha.js";

/** n noites: manhã com `perfume` e, à noite, a resposta vivo/fraco/morto. */
const noites = (perfume, respostas, ini = 1) => respostas.flatMap((v, i) => {
  const data = `2026-09-${String(ini + i).padStart(2, "0")}`;
  return [{ data, slot: "M", perfume }, { data, slot: "N", perfume: "Odéon", vivo: v }];
});
const usos = (perfume, ocasiao, notas, ini = 1) => notas.map((n, i) => ({ data: `2026-08-${String(ini + i).padStart(2, "0")}`, slot: "M", perfume, ocasiao, notaDia: String(n) }));
const X = { nome: "Xis", casa: "Teste", camada: "grade", tier: "A", arquetipo: "Rosal", apt: { Lazer: 3, "T.Inf": 2, "N.Inf": 0, "Cozy N": 1 }, longev: 7, curva: "L", perf_estimada: true };

test("medições: histórico vazio → frascos iguais e nada medido", () => {
  const r = aplicarMedicoes(frascos, []);
  assert.deepEqual(r.frascos, frascos); assert.deepEqual(r.medidos, []);
});

test("medições: toggle desligado → os mesmos frascos, mesmo com dados", () => {
  const r = aplicarMedicoes(frascos, noites("Météore", Array(6).fill("vivo")), { ativo: false });
  assert.equal(r.frascos, frascos); assert.deepEqual(r.medidos, []);
});

test("longevidade: abaixo do mínimo não muda; 5 vivo → 12 h; 3 vivo/1 fraco/1 morto → 10 h", () => {
  const de = frascos.find(f => f.nome === "Météore").longev;
  assert.equal(aplicarMedicoes(frascos, noites("Météore", ["vivo", "vivo", "vivo", "vivo"])).frascos.find(f => f.nome === "Météore").longev, de);
  let r = aplicarMedicoes(frascos, noites("Météore", Array(5).fill("vivo")));
  let m = r.frascos.find(f => f.nome === "Météore");
  assert.equal(m.longev, 12); assert.equal(m.perf_origem, "medido"); assert.equal(m.perf_estimada, false);
  assert.equal(m.longev_estimada_original, de); assert.equal(m.curva, frascos.find(f => f.nome === "Météore").curva);
  assert.deepEqual(r.medidos, [{ nome: "Météore", longev: { de, para: 12, n: 5 }, apt: [] }]);
  r = aplicarMedicoes(frascos, noites("Météore", ["vivo", "vivo", "vivo", "fraco", "morto"]));
  assert.equal(r.frascos.find(f => f.nome === "Météore").longev, 10);
  assert.equal(aplicarMedicoes(frascos, noites("Météore", Array(3).fill("vivo")), { minSobrev: 3 }).frascos.find(f => f.nome === "Météore").longev, 12);
});

test("aptidão por ocasião: sobe 1 com média ≥ 4,5 (teto 3), desce 1 com ≤ 2,5 (piso 0), chave ausente fica ausente, n=4 não muda", () => {
  const hist = [...usos("Xis", "T.Inf", [5, 5, 5, 4, 5]), ...usos("Xis", "Lazer", [5, 5, 5, 5, 4], 6), ...usos("Xis", "Trab. Formal", [5, 5, 5, 5, 5], 11),
    ...usos("Xis", "N.Inf", [2, 2, 2, 2, 2], 16), ...usos("Xis", "Cozy N", [1, 1, 1, 1], 21)];
  const r = aplicarMedicoes([X], hist);
  const x = r.frascos[0];
  assert.deepEqual(x.apt, { Lazer: 3, "T.Inf": 3, "N.Inf": 0, "Cozy N": 1 });
  assert.ok(!("T.For" in x.apt));
  assert.deepEqual(X.apt, { Lazer: 3, "T.Inf": 2, "N.Inf": 0, "Cozy N": 1 }, "o frasco original não muda");
  assert.equal(x.apt_original, X.apt);
  assert.deepEqual(r.medidos, [{ nome: "Xis", longev: null, apt: [{ ocasiao: "T.Inf", de: 2, para: 3, n: 5, media: 4.8 }] }]);
  const y = aplicarMedicoes([{ ...X, apt: { ...X.apt, "N.Inf": 1 } }], hist).frascos[0];
  assert.equal(y.apt["N.Inf"], 0);
});

test("medições não tocam no engine: com tudo abaixo do mínimo o ranking é o mesmo", () => {
  const hist = noites("Météore", ["vivo", "morto"]);
  const a = rodar("Data: 2026-10-10\nT: 15-24 pico 15 noite 18\nTd: 14\n", frascos);
  const b = rodar("Data: 2026-10-10\nT: 15-24 pico 15 noite 18\nTd: 14\n", aplicarMedicoes(frascos, hist).frascos);
  assert.deepEqual(a.slots.map(s => s.ranking), b.slots.map(s => s.ranking));
});
