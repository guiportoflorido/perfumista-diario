// Peças lúdicas: nome do dia determinístico, com material do arquétipo do top 1 e complemento de clima.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomeDoDia, definirMateriais } from "../app/diversao.js";

const arq = JSON.parse(readFileSync(new URL("../data/arquetipos.json", import.meta.url))).arquetipos;
definirMateriais(arq);

test("nome do dia: mesma entrada, mesmo nome; dia da semana certo", () => {
  const e = { data: "2026-10-20", faixaIdx: 2, chuva: 1, td: 15, T: 24, top1: { arquetipo: "Sultão" } };
  assert.equal(nomeDoDia(e), nomeDoDia({ ...e }));
  assert.match(nomeDoDia(e), /^Terça /);
  assert.match(nomeDoDia(e), /(Oud|Âmbar|Açafrão) sob Garoa|(Oud|Âmbar|Açafrão) entre Pancadas/);
  assert.match(nomeDoDia({ ...e, data: "2026-10-24", chuva: 0, T: 31.4, faixaIdx: 1 }), /^Sábado .* (a 31 °C|ao Sol Forte)$/);
});

test("todos os arquétipos do JSON têm 3 materiais e o nome usa um deles", () => {
  assert.equal(arq.length, 16);
  for (const a of arq) {
    assert.equal(a.materiais?.length, 3, a.nome);
    const n = nomeDoDia({ data: "2026-10-21", chuva: 0, top1: a.nome });
    assert.ok(a.materiais.some(m => n.includes(m)), `${a.nome}: ${n}`);
  }
});

test("fallback: sem top 1 → dia + clima; sem clima → dia + material", () => {
  assert.equal(nomeDoDia({ data: "2026-10-22", faixaIdx: 4, chuva: 0, top1: null }).split(" ")[0], "Quinta");
  assert.match(nomeDoDia({ data: "2026-10-22", faixaIdx: 4, chuva: 0 }), /^Quinta (com Frente Fria|na Brisa Fria)$/);
  assert.match(nomeDoDia({ data: "2026-10-22", top1: "Barbeiro" }), /^Quinta .*(Fougère|Lavanda|Musgo)$/);
  assert.equal(nomeDoDia({ data: "2026-10-22" }), "Quinta");
});
