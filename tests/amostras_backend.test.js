// Ações de Amostras do Code.gs: aba criada no primeiro lançamento, edição e exclusão por ID, validação.
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBackend } from "../tools/planilha_falsa.mjs";

const COLS = ["ID", "Casa", "Perfume", "Tipo", "Volume (ml)", "Origem", "Status", "Entrada", "Saída", "Motivo saída", "Impressão", "Obs", "Atualizado em", "Dono"];
const novo = () => carregarBackend({ "Tiers": [["Casa", "Perfume", "Nome no diário", "Posse", "Tier"]], "Diário": [["Data", "Slot", "Perfume"]] });
const post = (b, acao, extra = {}) => b.post({ token: "dev", acao, ...extra });

test("amostras: sem aba → existe:false; 1º lançamento cria a aba com cabeçalho e padrões", () => {
  const b = novo();
  assert.deepEqual(post(b, "amostras").amostras, { existe: false });
  const r = post(b, "adicionarAmostra", { campos: { ID: "am0001", Casa: "Nishane", Perfume: "Hacivat", "Volume (ml)": "2", Entrada: "2026-10-01" } });
  assert.equal(r.ok, true); assert.equal(r.linha, 2);
  assert.deepEqual(b.abas.Amostras[0], COLS);
  const l = b.abas.Amostras[1];
  assert.equal(l[COLS.indexOf("Tipo")], "Amostra"); assert.equal(l[COLS.indexOf("Status")], "Pendente");
  assert.equal(l[COLS.indexOf("Atualizado em")], "2026-10-09");
  const m = post(b, "amostras").amostras;
  assert.equal(m.existe, true); assert.equal(m.linhas.length, 2);
});

test("adicionar: reenvio do mesmo ID não duplica; mesmo perfume com outro ID é outra amostra", () => {
  const b = novo();
  const c = { ID: "am0001", Casa: "Nishane", Perfume: "Hacivat" };
  post(b, "adicionarAmostra", { campos: c });
  assert.equal(post(b, "adicionarAmostra", { campos: c }).duplicada, true);
  post(b, "adicionarAmostra", { campos: { ...c, ID: "am0002", Tipo: "Decant", "Volume (ml)": "10" } });
  assert.equal(b.abas.Amostras.length, 3);
});

test("validação: obrigatórios, tipo, status, datas, volume, saída antes da entrada, ID", () => {
  const b = novo();
  const ok = { ID: "am0001", Casa: "X", Perfume: "Y" };
  for (const ruim of [{ ...ok, Casa: "" }, { ...ok, Tipo: "Frasco" }, { ...ok, Status: "Feito" }, { ...ok, Entrada: "01/10/2026" },
    { ...ok, "Volume (ml)": "dois" }, { ...ok, Entrada: "2026-10-05", "Saída": "2026-10-01" }, { ...ok, ID: "x" }])
    assert.equal(post(b, "adicionarAmostra", { campos: ruim }).ok, false, JSON.stringify(ruim));
  assert.equal(post(b, "adicionarAmostra", { campos: { ...ok, "Volume (ml)": "1,5" } }).ok, true);
  assert.equal(post(b, "adicionarAmostra", { campos: { ...ok, ID: "am0002", Status: "Em teste" } }).ok, true);
  assert.equal(post(b, "editarAmostra", { id: "am0001", campos: { Status: "Em teste" } }).ok, true);
});

test("editar por ID: muda só os campos enviados, não mexe em ID; recusa saída antes da entrada já gravada", () => {
  const b = novo();
  post(b, "adicionarAmostra", { campos: { ID: "am0001", Casa: "Nishane", Perfume: "Hacivat", Entrada: "2026-10-01" } });
  let r = post(b, "editarAmostra", { id: "am0001", campos: { Status: "Esgotado", "Saída": "2026-10-08", "Motivo saída": "Acabou", ID: "zzz" } });
  assert.equal(r.ok, true); assert.deepEqual(r.mudou, ["Status", "Saída", "Motivo saída"]);
  const l = b.abas.Amostras[1];
  assert.equal(l[0], "am0001"); assert.equal(l[COLS.indexOf("Status")], "Esgotado"); assert.equal(l[COLS.indexOf("Perfume")], "Hacivat");
  assert.equal(post(b, "editarAmostra", { id: "am0001", campos: { "Saída": "2026-09-01" } }).ok, false);
  assert.equal(post(b, "editarAmostra", { id: "nada", campos: { Status: "Realizado" } }).ok, false);
  assert.equal(post(b, "editarAmostra", { id: "am0001", campos: { Perfume: " " } }).ok, false);
});

test("remover por ID apaga só aquela linha", () => {
  const b = novo();
  post(b, "adicionarAmostra", { campos: { ID: "am0001", Casa: "A", Perfume: "B" } });
  post(b, "adicionarAmostra", { campos: { ID: "am0002", Casa: "C", Perfume: "D" } });
  assert.equal(post(b, "removerAmostra", { id: "am0001" }).ok, true);
  assert.equal(b.abas.Amostras.length, 2); assert.equal(b.abas.Amostras[1][0], "am0002");
  assert.equal(post(b, "removerAmostra", { id: "am0001" }).ok, false);
});

test("Dono: Gui/Bia aceitos, outro recusado; aba antiga sem a coluna ganha a coluna ao gravar", () => {
  const velha = ["ID", "Casa", "Perfume", "Tipo", "Volume (ml)", "Origem", "Status", "Entrada", "Saída", "Motivo saída", "Impressão", "Obs", "Atualizado em"];
  const b = carregarBackend({ "Tiers": [["Casa", "Perfume"]], "Diário": [["Data"]], "Amostras": [velha, ["am0001", "A", "B", "Amostra", "", "", "Pendente", "", "", "", "", "", ""]] });
  assert.equal(post(b, "editarAmostra", { id: "am0001", campos: { Dono: "Zé" } }).ok, false);
  assert.equal(post(b, "editarAmostra", { id: "am0001", campos: { Dono: "Bia" } }).ok, true);
  assert.equal(b.abas.Amostras[0].at(-1), "Dono"); assert.equal(b.abas.Amostras[1][13], "Bia");
  assert.equal(post(b, "adicionarAmostra", { campos: { ID: "am0002", Casa: "C", Perfume: "D", Dono: "Gui" } }).ok, true);
  assert.equal(b.abas.Amostras[2][13], "Gui");
});
