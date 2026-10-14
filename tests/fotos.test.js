// Fotos: só links https entram na página; ficha mostra foto e botões conforme edição; miniatura some sem foto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoSegura, fotoFicha, fotoMini } from "../app/fotos.js";
import { deLinhas, fichaEditavel } from "../app/mercado.js";

const URL = "https://drive.google.com/thumbnail?id=abc&sz=w1200";

test("fotoSegura aceita só https sem aspas/espaços", () => {
  assert.equal(fotoSegura(URL), URL);
  for (const ruim of ["http://x/y.jpg", "javascript:alert(1)", 'https://x/"onerror="1', "", null]) assert.equal(fotoSegura(ruim), "");
});

test("ficha: com foto mostra imagem + Trocar/Remover; sem foto e editável mostra Adicionar; só leitura mostra o motivo", () => {
  const h = fotoFicha({ nome: "Decision", foto: URL }, { editavel: true, id: "Amouage||Decision" });
  assert.match(h, /<img src="https:\/\/drive\.google\.com\/thumbnail\?id=abc&amp;sz=w1200"/);
  assert.match(h, /Trocar foto<input type="file" accept="image\/\*" data-foto="Amouage\|\|Decision" hidden>/);
  assert.match(h, /data-foto-remover="Amouage\|\|Decision"/);
  assert.match(fotoFicha({ nome: "X" }, { editavel: true, id: "A||X" }), /Adicionar foto/);
  assert.equal(fotoFicha({ nome: "X" }, {}), "");
  assert.match(fotoFicha({ nome: "X" }, { motivo: "conecte a planilha" }), /conecte a planilha/);
  assert.equal(fotoMini("", "X"), ""); assert.match(fotoMini(URL, "X", "foto-hero"), /class="foto-hero"/);
});

test("aba Mercado: coluna Foto vira p.foto e aparece na ficha", () => {
  const cab = ["Casa", "Perfume", "Tier", "Posse", "Arquétipo", "Resumo", "Topo", "Coração", "Base", "Nariz", "Wishlist", "Atualizado em", "Notas", "Foto"];
  const [p] = deLinhas([cab, ["Amouage", "Decision", "S", "Frasco Gui", "Monge", "", "", "", "", "", "", "", "", URL]], []);
  assert.equal(p.foto, URL);
  assert.match(fichaEditavel(p, { arquetipos: [], editavel: true }), /class="foto-ficha"/);
});
