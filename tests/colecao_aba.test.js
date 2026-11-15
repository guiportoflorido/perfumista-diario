// Aba "Coleção" da planilha → frascos: ida e volta com data/frascos.json (o que o motor usa tem de bater campo a campo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deLinhasColecao, COLS_COLECAO, FAIXAS_COD, lerAptidao, juntarFichas } from "../app/colecao.js";
import { janelasPorFrasco } from "../app/estatisticas.js";

const frascos = JSON.parse(readFileSync(new URL("../data/frascos.json", import.meta.url))).frascos;
const fichas = JSON.parse(readFileSync(new URL("../data/fichas.json", import.meta.url))).fichas;
const playbook = JSON.parse(readFileSync(new URL("../data/playbook.json", import.meta.url)));
const virg = x => String(x).replace(".", ",");
const linha = f => {
  const leit = f.perf_origem === "leitura", fi = fichas[f.nome] || {};
  const m = { "Ativo": "Sim", "Casa": f.casa, "Perfume": f.nome, "Camada": f.decant ? "Decant" : f.camada === "custo" ? "Custo" : "Grade", "Tier": f.tier,
    "Arquétipo": f.arquetipo, "Concentração": f.conc, "Eixo": f.eixo, "Doçura": String(f.doc), "Peso": String(f.peso), "Td": f.td,
    "Faixa mais quente": FAIXAS_COD[f.env_hot], "Faixa mais fria": FAIXAS_COD[f.env_cold], "Aptidão": Object.entries(f.apt).map(([k, v]) => `${k} ${v}`).join(" · "),
    "Sprays-base": String(f.sprays_base), "Chuva": virg(f.chuva), "Longevidade (h)": leit ? virg(f.longev) : "", "Projeção": leit ? String(f.proj) : "",
    "Curva": leit ? f.curva : "", "Pirâmide": fi.perfil || "", "Vizinhos": fi.vizinhos || "", "Leitura": "", "Atualizado em": "2026-11-15" };
  return COLS_COLECAO.map(c => m[c]);
};

test("aba Coleção gerada dos JSON volta igual ao data/frascos.json (campos do motor)", () => {
  const r = deLinhasColecao([COLS_COLECAO, ...frascos.map(linha)], { janelas: janelasPorFrasco(playbook) });
  assert.deepEqual(r.avisos, []);
  assert.equal(r.frascos.length, frascos.length);
  const CAMPOS = ["nome", "casa", "camada", "tier", "arquetipo", "eixo", "doc", "peso", "td", "env_hot", "env_cold", "env_lo", "env_hi", "ideal", "conc", "edt",
    "apt", "sprays_base", "janelas", "chuva", "longev", "proj", "curva", "perf_estimada", "perf_origem", "decant"];
  for (const f of frascos) {
    const g = r.frascos.find(x => x.nome === f.nome);
    for (const k of CAMPOS) assert.deepEqual(g[k], f[k], `${f.nome}.${k}`);
  }
  assert.equal(r.fichas["Bracken Man"].envelope, fichas["Bracken Man"].envelope);
});

test("linha inativa sai; linha inválida vira aviso com o número da linha", () => {
  const ok = linha(frascos[0]), inativa = [...linha(frascos[1])], ruim = [...linha(frascos[2])];
  inativa[0] = "Não"; ruim[COLS_COLECAO.indexOf("Td")] = "X";
  const r = deLinhasColecao([COLS_COLECAO, ok, inativa, ruim]);
  assert.deepEqual(r.frascos.map(f => f.nome), [frascos[0].nome]);
  assert.deepEqual(r.inativos, [frascos[1].nome]);
  assert.match(r.avisos[0], /^Linha 4 .*Td/);
  assert.equal(lerAptidao("Lazer 3 · Esporte 2"), null);
  assert.deepEqual(juntarFichas({ A: { leitura: "x", perfil: "p" } }, { A: { leitura: "", perfil: "q" } }).A, { leitura: "x", perfil: "q" });
});
