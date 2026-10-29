// Análises gráficas: dados e SVG da mandala, termômetro, rio e Dia → Noite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dadosMandala, mandalaSVG, blocoMandala, TRANSBORDA, dadosTermometro, termometroSVG, blocoTermometro, dadosRio, blocoRio, dadosDiaNoite, blocoDiaNoite } from "../app/graficos.js";

const arq = [{ nome: "Rosal", cor: "#b56a78" }, { nome: "Monge", cor: "#8c8478" }, { nome: "Marinho", cor: "#5f9ea8" }];
const F = (nome, arquetipo) => ({ nome, arquetipo, camada: "grade", tier: "S" });
const frascos = [F("R1", "Rosal"), F("R2", "Rosal"), F("M1", "Monge"), F("A1", "Marinho")];
const por = new Map([["R1", { n: 3 }], ["R2", { n: 1 }], ["M1", { n: 2 }], ["A1", { n: 0 }]]);
const hist = [
  { data: "2026-10-05", slot: "M", perfume: "R1", temp: "24" }, { data: "2026-10-05", slot: "N", perfume: "M1", temp: "18" },
  { data: "2026-10-06", slot: "M", perfume: "R1", temp: "25,5" }, { data: "2026-10-06", slot: "N2", perfume: "R2", temp: "" },
  { data: "2026-10-13", slot: "M", perfume: "M1", temp: "31" }, { data: "2026-10-13", slot: "N", perfume: "R1", temp: "20" },
  { data: "2026-10-14", slot: "M", perfume: "Amostra X", temp: "22" }];

test("mandala: frascos e usos por arquétipo; selos ‘nunca alcançado’ e ‘onde você vai fundo’; transborda", () => {
  const d = dadosMandala(arq, frascos, por);
  assert.deepEqual(d.map(x => [x.nome, x.frascos, x.usos]), [["Rosal", 2, 4], ["Monge", 1, 2], ["Marinho", 1, 0]]);
  const svg = mandalaSVG(d);
  assert.match(svg, /^<svg class="mandala"/); assert.equal((svg.match(/class="md-setor/g) || []).length, 3);
  assert.equal((svg.match(/class="md-pt"/g) || []).length, 2, "só arquétipos usados ganham ponto");
  const b = blocoMandala(d);
  assert.match(b, /nunca alcançado · 1/); assert.match(b, /onde você vai fundo · Rosal/); assert.match(b, /Marinho<\/b>/);
  assert.doesNotMatch(b, /transborda \(/);
  const cheio = blocoMandala([{ nome: "Rosal", cor: "#b56a78", frascos: TRANSBORDA, usos: 1 }]);
  assert.match(cheio, /md-borda transborda/); assert.match(cheio, /fique com os melhores/);
});

test("termômetro: só usos com temperatura e frasco da grade; mediana", () => {
  const pts = dadosTermometro(hist, frascos);
  assert.deepEqual(pts.map(p => p.T), [24, 18, 25.5, 31, 20]);
  const svg = termometroSVG(pts);
  assert.equal((svg.match(/class="tm-pt/g) || []).length, 5); assert.match(svg, /mediana 24°/);
  assert.equal(blocoTermometro(pts.slice(0, 2)), "", "menos de 3 pontos: sem gráfico");
});

test("rio: semanas (segunda) × arquétipo; Dia → Noite: pares do mesmo dia", () => {
  const sem = dadosRio(hist, frascos);
  assert.deepEqual(sem.map(s => [s.semana, s.total]), [["2026-10-05", 4], ["2026-10-12", 2]]);
  assert.equal(sem[0].por.get("Rosal"), 3);
  assert.match(blocoRio(sem, arq), /class="rio"/);
  const pares = dadosDiaNoite(hist, frascos);
  assert.deepEqual([...pares], [["Rosal|Monge", 1], ["Rosal|Rosal", 1], ["Monge|Rosal", 1]]);
  const b = blocoDiaNoite(pares);
  assert.match(b, /class="dianoite"/); assert.match(b, /1 dia ficou no mesmo arquétipo/);
});
