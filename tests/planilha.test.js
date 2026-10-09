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
  assert.equal(r.frascos.length, 79);
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
