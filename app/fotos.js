// fotos.js — foto de cada perfume: tirada ou escolhida no aparelho, reduzida aqui (JPEG até 1280 px) e guardada pelo
// Apps Script numa pasta do Google Drive; o link fica na coluna Foto da aba Mercado (uma foto por perfume, vale para
// frasco e amostra). Aparece na ficha (Coleção, Mercado, Amostras) e nos cartões da aba Hoje.
import { esc } from "./util.js";
import { chamar } from "./api.js";

const LADO_MAX = 1280, QUALIDADE = 0.82;

/** Só links https (o que o Apps Script grava); qualquer outra coisa é ignorada. */
export const fotoSegura = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || "").trim()) ? String(u).trim() : "");

/** Bloco da ficha: foto (ou espaço vazio) + botões. `id` = casa||perfume da linha do Mercado. */
export function fotoFicha(p, { editavel = false, id = "", motivo = "" } = {}) {
  const url = fotoSegura(p?.foto);
  const botoes = editavel && id
    ? `<div class="foto-acoes"><label class="btn sec peq">${url ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" data-foto="${esc(id)}" hidden></label>
        ${url ? `<button class="btn sec peq" type="button" data-foto-remover="${esc(id)}">Remover</button>` : ""}</div>`
    : motivo ? `<p class="nota">${esc(motivo)}</p>` : "";
  if (!url && !botoes) return "";
  return `<div class="foto-ficha">${url ? `<img src="${esc(url)}" alt="Foto de ${esc(p.nome || "")}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}${botoes}</div>`;
}

/** Miniatura para cartões e listas (nada se não houver foto). */
export const fotoMini = (url, nome, cls = "foto-mini") =>
  fotoSegura(url) ? `<img class="${cls}" src="${esc(fotoSegura(url))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" aria-hidden="true" title="${esc(nome || "")}">` : "";

/** Lê a imagem escolhida, reduz para JPEG e devolve o base64 (sem o prefixo data:). */
export async function reduzirImagem(arquivo) {
  if (!arquivo || !/^image\//.test(arquivo.type || "image/")) throw new Error("escolha uma imagem");
  let img;
  try { img = await createImageBitmap(arquivo, { imageOrientation: "from-image" }); }
  catch {
    img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("não consegui ler a imagem")); i.src = URL.createObjectURL(arquivo); });
  }
  const w = img.width, h = img.height, k = Math.min(1, LADO_MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", QUALIDADE).split(",")[1];
}

export async function subirFoto(casa, perfume, base64) {
  const j = await chamar("subirFoto", { casa, perfume, imagem: base64, tipo: "image/jpeg" }, { timeoutMs: 60000 });
  return j.url;
}
