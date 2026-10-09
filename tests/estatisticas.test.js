// Contas do Histórico/Coleção: janelas batem com o playbook, camada custo fora, esquecidos, uso × janelas, calibração.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { janelasPorFrasco, contagens, esquecidos, usoVsJanelas, calibracao, ajustarSprays, daGrade } from "../app/estatisticas.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;
const playbook = JSON.parse(readFileSync(new URL("../data/playbook.json", import.meta.url)));
const f = n => frascos.find(x => x.nome === n);

test("janelas por frasco = coluna Janelas (651 no total, 69 frascos)", () => {
  const j = janelasPorFrasco(playbook);
  for (const x of frascos.filter(daGrade)) assert.equal((j.get(x.nome) || []).length, x.janelas, x.nome);
  assert.equal([...j.values()].reduce((s, a) => s + a.length, 0), 651);
  assert.ok(j.get("Désobéissant").some(w => w.faixa === "Muito Quente" && w.ocasiao === "Lazer" && w.papel === "Seguro"));
});

test("contagens: só grade (camada custo e fora da coleção não contam), 30 dias, slots, cobertura", () => {
  const hist = [{ data: "2026-09-01", slot: "M", perfume: "Odéon" }, { data: "2026-10-08", slot: "N", perfume: "Odéon" },
    { data: "2026-10-08", slot: "M", perfume: "Sky" }, { data: "2026-10-04", slot: "M", perfume: "Acqua Viva" }];
  const c = contagens(hist, frascos, "2026-10-09");
  assert.equal(c.por.size, 69); assert.equal(c.total, 2); assert.equal(c.foraDaGrade, 2);
  assert.deepEqual((({ n, n30, M, N, ultimo, dias }) => ({ n, n30, M, N, ultimo, dias }))(c.por.get("Odéon")), { n: 2, n30: 1, M: 1, N: 1, ultimo: "2026-10-08", dias: 1 });
  assert.equal(c.cobertura, 39);
  const esq = esquecidos(c.por);
  assert.ok(!esq.some(x => x.f.nome === "Odéon")); assert.equal(esq.length, 68);
  assert.equal(esq[0].f.tier, "S");
  const u = usoVsJanelas(c.por).find(x => x.nome === "Odéon");
  assert.ok(Math.abs(u.esperado - 2 * 9 / 651) < 1e-12);
});

test("calibração: real − sugerido por frasco e geral, ignorando registros sem sugestão", () => {
  const cal = calibracao([{ perfume: "Odéon", sprays: "4", sugerido: "2", estado: "enviado" }, { perfume: "Odéon", sprays: "3", sugerido: "2", estado: "enviado" },
    { perfume: "Liwa", sprays: "3", sugerido: "3", estado: "pendente" }, { perfume: "Liwa", sprays: "5", sugerido: "", estado: "enviado" },
    { perfume: "Liwa", sprays: "9", sugerido: "2", estado: "descartado" }]);
  assert.equal(cal.n, 3); assert.equal(cal.geral, 1);
  assert.deepEqual(cal.por, [{ nome: "Odéon", n: 2, media: 1.5 }, { nome: "Liwa", n: 1, media: 0 }]);
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
