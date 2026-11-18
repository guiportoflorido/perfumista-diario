// Playbook gerado da coleção (regras do v60) e Mapa clima.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gerarPlaybook, comparar, spraysCelula, janelasGeradas } from "../app/playbook.js";
import { mapaSVG, posicoes } from "../app/mapa.js";
import { janelasPorFrasco } from "../app/estatisticas.js";

const ler = n => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url)));
const frascos = ler("frascos").frascos, fichas = ler("fichas").fichas, oficial = ler("playbook");

test("gerado bate com o v60 em ≥ 95% das janelas e mantém Seguros incumbentes", () => {
  const g = gerarPlaybook(frascos, fichas, oficial);
  const c = comparar(g, oficial);
  assert.equal(c.total, 668);
  assert.ok(c.iguais / c.total >= 0.95, `${c.iguais}/${c.total}`);
  let iguais = 0, n = 0;
  for (const fx of oficial.faixas) for (const [oc, cel] of Object.entries(oficial.grade[fx].celulas)) { n++; if (g.grade[fx].celulas[oc]?.seguro === cel.seguro) iguais++; }
  assert.ok(iguais >= n - 2, `${iguais}/${n}`);
  assert.equal(janelasPorFrasco(g).get("Désobéissant").length, 12);   // formato igual ao playbook.json (as telas leem igual)
});

test("regras: Cozy só de Ameno para baixo, teto por tier, camada custo fora, sprays da célula", () => {
  const j = janelasGeradas(frascos.filter(f => f.camada === "grade"));
  for (const [nome, js] of j) {
    const f = frascos.find(x => x.nome === nome);
    assert.ok(js.length <= { S: 12, A: 9, B: 6, C: 3 }[f.tier], nome);
    assert.ok(js.every(x => !x.oc.startsWith("Cozy") || x.fi >= 2), nome);
  }
  const g = gerarPlaybook(frascos, fichas, oficial);
  assert.ok(!JSON.stringify(g.grade).includes("Hawas Boa"));
  assert.equal(spraysCelula(frascos.find(f => f.nome === "Désobéissant"), 0), 6);
  assert.equal(spraysCelula(frascos.find(f => f.nome === "Ombre Nomade"), 3), 2);
});

test("mapa clima: uma esfera por frasco, sem sobreposição relevante", () => {
  const grade = frascos.filter(f => f.camada === "grade");
  const svg = mapaSVG(grade, { hoje: { T: 25, Td: 15 } });
  assert.equal((svg.match(/class="mp-fr"/g) || []).length, grade.length);
  assert.match(svg, /hoje 25°/);
  const ps = posicoes(grade);
  let sobre = 0;
  for (let i = 0; i < ps.length; i++) for (let k = i + 1; k < ps.length; k++) if (Math.hypot(ps[i].x - ps[k].x, ps[i].y - ps[k].y) < (ps[i].r + ps[k].r) * 0.6) sobre++;
  assert.ok(sobre <= 3, `sobrepostas: ${sobre}`);
});
