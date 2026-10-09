// Paridade JS × Python: cada entrada de tests/golden/inputs roda no motor JS e é comparada com a saída
// estruturada do modelo Python (tests/golden/expected, gerada por tools/golden.py).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rodar } from "../engine/index.js";

const raiz = new URL("../", import.meta.url);
const frascos = JSON.parse(readFileSync(new URL("data/frascos.json", raiz))).frascos;
const dir = new URL("tests/golden/inputs/", raiz);
const casos = readdirSync(dir).filter(f => f.endsWith(".txt")).sort();
const TOL_SCORE = 0.5, EPS = 1e-9;

test("há pelo menos 20 casos dourados", () => assert.ok(casos.length >= 20, `só ${casos.length}`));

for (const arq of casos) {
  test(`paridade · ${arq}`, () => {
    const txt = readFileSync(new URL(arq, dir), "utf8");
    const esp = JSON.parse(readFileSync(new URL(`tests/golden/expected/${arq.replace(".txt", ".json")}`, raiz)));
    const js = rodar(txt, frascos);
    assert.equal(js.data, esp.data);
    assert.deepEqual(js.avisos, esp.avisos, "avisos");
    assert.deepEqual(js.segs, esp.segs, "segmentos");
    assert.deepEqual(js.faixas_rua, esp.faixas_rua, "faixas na rua");
    assert.equal(js.passos.length, esp.n_passos, "passos");
    js.passos.forEach((p, i) => assert.ok(Math.abs(p.T - esp.T_passos[i]) < 1e-6, `T passo ${i}`));
    if (esp.manha) assert.ok(Math.abs(js.manha.pres - esp.manha.pres) < EPS, "resíduo manhã");
    assert.equal(js.slots.length, esp.slots.length);
    js.slots.forEach((s, k) => {
      const e = esp.slots[k], tag = `${s.nome}`;
      assert.equal(s.onde, e.onde, `${tag} onde aplicar`);
      // scores de todos os frascos e motivos de exclusão
      for (const [nome, sc] of Object.entries(e.scores)) {
        if (sc === null) assert.equal(s.fora[nome], e.fora[nome], `${tag} motivo de exclusão de ${nome}`);
        else {
          const r = s.ranking.find(x => x.nome === nome) ?? null;
          const custo = !r;
          if (!custo) assert.ok(Math.abs(r.score - sc) <= TOL_SCORE, `${tag} score ${nome}: ${r.score} vs ${sc}`);
          assert.equal(s.fora[nome], undefined, `${tag} ${nome} não deveria estar fora`);
        }
      }
      // top 10: mesma ordem (empate numérico < 1e-9 pode trocar), sprays, vivo até, por quê
      assert.equal(s.top.length, e.top.length, `${tag} tamanho do top`);
      s.top.forEach((t, i) => {
        const x = e.top[i];
        if (t.nome !== x.nome) assert.ok(Math.abs(t.score - x.score) < EPS, `${tag} #${i + 1}: ${t.nome} ≠ ${x.nome}`);
        const xe = e.top.find(y => y.nome === t.nome);
        assert.ok(Math.abs(t.score - xe.score) <= TOL_SCORE, `${tag} score #${i + 1}`);
        assert.equal(t.sprays, xe.sprays, `${tag} sprays ${t.nome}`);
        assert.equal(t.nota, xe.nota, `${tag} nota de sprays ${t.nome}`);
        assert.ok(Math.abs(t.vivo_ate - xe.vivo_ate) < EPS, `${tag} vivo até ${t.nome}`);
        assert.equal(t.porque, xe.porque, `${tag} por quê ${t.nome}`);
      });
      assert.deepEqual(s.fora_sa, e.fora_sa, `${tag} S/A fora`);
      if (e.custo) assert.deepEqual(s.custo.map(c => [c.nome, c.sprays]), e.custo.map(c => [c.nome, c.sprays]), `${tag} custo`);
      else assert.equal(s.custo, undefined, `${tag} camada custo não pode aparecer`);
      if (e.testar) {
        const t = s.testar, x = e.testar;
        if (x.nao_encontrado) assert.equal(t.nao_encontrado, x.nao_encontrado);
        else if (x.fora) assert.deepEqual([t.nome, t.fora], [x.nome, x.fora]);
        else assert.deepEqual([t.nome, t.pos, t.sprays, t.porque], [x.nome, x.pos, x.sprays, x.porque]);
      }
    });
  });
}
