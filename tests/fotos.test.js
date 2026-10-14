// Fotos: links https antigos entram direto; foto da aba Fotos vira marca para buscar na planilha; ficha mostra botões
// conforme edição; miniatura some sem foto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoSegura, fotoFicha, iconeFicha, fotoMini } from "../app/fotos.js";
import { deLinhas, fichaEditavel } from "../app/mercado.js";

const URL = "https://drive.google.com/thumbnail?id=abc&sz=w1200";

test("fotoSegura aceita só https sem aspas/espaços", () => {
  assert.equal(fotoSegura(URL), URL);
  for (const ruim of ["http://x/y.jpg", "javascript:alert(1)", 'https://x/"onerror="1', "", null]) assert.equal(fotoSegura(ruim), "");
});

test("ficha: foto vai em círculo no cabeçalho (no lugar do ícone do arquétipo); botões Trocar/Remover ou Adicionar; só leitura mostra o motivo", () => {
  const h = iconeFicha({ nome: "Decision", foto: URL }, "<svg>arq</svg>");
  assert.match(h, /<span class="ficha-ic ficha-foto"><img src="https:\/\/drive\.google\.com\/thumbnail\?id=abc&amp;sz=w1200"/);
  assert.doesNotMatch(h, /arq/);
  assert.equal(iconeFicha({ nome: "X" }, "<svg>arq</svg>"), '<span class="ficha-ic"><svg>arq</svg></span>');
  assert.equal(iconeFicha(null, ""), "");
  const b = fotoFicha({ nome: "Decision", foto: URL }, { editavel: true, id: "Amouage||Decision" });
  assert.doesNotMatch(b, /<img/);
  assert.match(b, /Trocar foto<input type="file" accept="image\/\*" data-foto="Amouage\|\|Decision" hidden>/);
  assert.match(b, /data-foto-remover="Amouage\|\|Decision"/);
  assert.match(fotoFicha({ nome: "X" }, { editavel: true, id: "A||X" }), /Adicionar foto/);
  assert.equal(fotoFicha({ nome: "X" }, {}), "");
  assert.match(fotoFicha({ nome: "X" }, { motivo: "conecte a planilha" }), /conecte a planilha/);
  assert.equal(fotoMini({ nome: "X", foto: "" }), ""); assert.match(fotoMini({ nome: "X", foto: URL }, "foto-hero"), /class="foto-hero" src="https/);
});

test("foto guardada na aba Fotos: <img> sem src, marcada com casa||nome e versão (o app busca depois)", () => {
  const p = { casa: "Amouage", nome: "Decision", foto: "aba Fotos · 2026-10-14T12:00:00.000Z" };
  const h = iconeFicha(p, "<svg></svg>");
  assert.match(h, /<img data-foto-planilha="Amouage\|\|Decision" data-foto-v="aba Fotos · 2026-10-14T12:00:00.000Z" alt="Foto de Decision"/);
  assert.doesNotMatch(h, /src=/); assert.match(fotoFicha(p, { editavel: true, id: "Amouage||Decision" }), /Trocar foto/);
  assert.match(fotoMini(p), /class="foto-mini" data-foto-planilha="Amouage\|\|Decision"/);
  assert.equal(fotoMini({ nome: "Decision", foto: "aba Fotos · x" }), "");   // sem casa não dá para buscar
  assert.doesNotMatch(fotoMini({ casa: 'A"><b>', nome: "x", foto: "v" }), /"><b>/);
});

test("aba Mercado: coluna Foto vira p.foto e aparece na ficha", () => {
  const cab = ["Casa", "Perfume", "Tier", "Posse", "Arquétipo", "Resumo", "Topo", "Coração", "Base", "Nariz", "Wishlist", "Atualizado em", "Notas", "Foto"];
  const [p] = deLinhas([cab, ["Amouage", "Decision", "S", "Frasco Gui", "Monge", "", "", "", "", "", "", "", "", URL]], []);
  assert.equal(p.foto, URL);
  assert.match(fichaEditavel(p, { arquetipos: [], editavel: true }), /class="ficha-ic ficha-foto"><img src="https/);
});
