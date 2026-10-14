// fotos.js — foto de cada perfume: tirada ou escolhida no aparelho, reduzida aqui (JPEG) e guardada pelo Apps Script na
// aba Fotos da própria planilha (sem Google Drive). Na aba Mercado, a coluna Foto tem só a versão ("aba Fotos · data");
// a imagem é buscada à parte (ação "fotos") e guardada no aparelho (Cache Storage), uma vez por versão.
// Uma foto por perfume, vale para frasco e amostra. Aparece em círculo no cabeçalho da ficha (no lugar do ícone do
// arquétipo) e nos cartões de Hoje.
import { esc } from "./util.js";
import { chamar } from "./api.js";

const LADO_MAX = 1000, LIMITE = 440000;   // base64 até 440 mil caracteres (a planilha guarda até 450 mil por foto)
const CACHE = "perfumista-fotos";

/** Só links https (fotos antigas por link); qualquer outra coisa é ignorada. */
export const fotoSegura = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || "").trim()) ? String(u).trim() : "");

/** Atributos do <img>: link https direto, ou marca para buscar na planilha (casa||nome + versão). */
function fonte(p) {
  const v = String(p?.foto || "").trim();
  if (!v) return "";
  const url = fotoSegura(v);
  if (url) return `src="${esc(url)}"`;
  if (!p.casa || !p.nome) return "";
  return `data-foto-planilha="${esc(p.casa + "||" + p.nome)}" data-foto-v="${esc(v)}"`;
}

/** Ícone do cabeçalho da ficha: a foto recortada em círculo, ou o ícone do arquétipo (`icone`, HTML) se não houver foto. */
export function iconeFicha(p, icone = "") {
  const src = fonte(p);
  if (src) return `<span class="ficha-ic ficha-foto"><img ${src} alt="Foto de ${esc(p.nome || "")}" decoding="async" referrerpolicy="no-referrer"></span>`;
  return icone ? `<span class="ficha-ic">${icone}</span>` : "";
}

/** Botões da foto na ficha (a foto em si fica no cabeçalho, ver iconeFicha). `p` = perfume da aba Mercado; `id` = casa||perfume. */
export function fotoFicha(p, { editavel = false, id = "", motivo = "" } = {}) {
  const tem = Boolean(fonte(p));
  if (editavel && id) return `<div class="foto-acoes"><label class="btn sec peq">${tem ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" data-foto="${esc(id)}" hidden></label>
        ${tem ? `<button class="btn sec peq" type="button" data-foto-remover="${esc(id)}">Remover foto</button>` : ""}</div>`;
  return motivo ? `<p class="nota">${esc(motivo)}</p>` : "";
}

/** Miniatura para cartões e listas (nada se não houver foto). `p` = perfume da aba Mercado. */
export function fotoMini(p, cls = "foto-mini") {
  const src = fonte(p);
  return src ? `<img class="${cls}" ${src} alt="" decoding="async" referrerpolicy="no-referrer" aria-hidden="true" title="${esc(p.nome || "")}">` : "";
}

/** Lê a imagem escolhida, reduz para JPEG e devolve o base64 (sem o prefixo data:), dentro do limite da planilha. */
export async function reduzirImagem(arquivo) {
  if (!arquivo || !/^image\//.test(arquivo.type || "image/")) throw new Error("escolha uma imagem");
  let img;
  try { img = await createImageBitmap(arquivo, { imageOrientation: "from-image" }); }
  catch {
    img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("não consegui ler a imagem")); i.src = URL.createObjectURL(arquivo); });
  }
  for (const [lado, q] of [[LADO_MAX, 0.8], [LADO_MAX, 0.65], [800, 0.6], [640, 0.55], [480, 0.5]]) {
    const k = Math.min(1, lado / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const b64 = c.toDataURL("image/jpeg", q).split(",")[1];
    if (b64.length <= LIMITE) return b64;
  }
  throw new Error("imagem grande demais mesmo reduzida");
}

/** Envia a foto; devolve a versão gravada na coluna Foto. Já deixa a imagem guardada no aparelho. */
export async function subirFoto(casa, perfume, base64) {
  const j = await chamar("subirFoto", { casa, perfume, imagem: base64, tipo: "image/jpeg" }, { timeoutMs: 60000 });
  await guardar(casa + "||" + perfume, j.versao, base64, "image/jpeg");
  return j.versao;
}

export const removerFotoPlanilha = (casa, perfume) => chamar("removerFoto", { casa, perfume }, { timeoutMs: 25000 });

// ── imagens guardadas no aparelho ──
const memoria = new Map();   // "casa||nome|versão" → URL blob
const chaveReq = (id, v) => new Request(new URL(`__foto/${encodeURIComponent(id)}?v=${encodeURIComponent(v)}`, document.baseURI));

function blobDe(base64, tipo) {
  const bin = atob(base64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: tipo || "image/jpeg" });
}

async function guardar(id, v, base64, tipo) {
  const blob = blobDe(base64, tipo);
  memoria.set(id + "|" + v, URL.createObjectURL(blob));
  try { if (self.caches) await (await caches.open(CACHE)).put(chaveReq(id, v), new Response(blob, { headers: { "Content-Type": blob.type } })); } catch { /* sem espaço: fica só na memória */ }
}

async function doAparelho(id, v) {
  const m = memoria.get(id + "|" + v);
  if (m) return m;
  try {
    const r = self.caches && await caches.match(chaveReq(id, v));
    if (r) { const url = URL.createObjectURL(await r.blob()); memoria.set(id + "|" + v, url); return url; }
  } catch { /* segue para a planilha */ }
  return "";
}

const pendentes = new Set();   // "id|v" já pedidos à planilha
let agendado = false;

/** Preenche os <img data-foto-planilha> sem src: do aparelho ou, se faltar, da planilha (em lotes). */
async function hidratar(raiz) {
  agendado = false;
  const imgs = [...raiz.querySelectorAll("img[data-foto-planilha]:not([src])")];
  if (!imgs.length) return;
  const faltam = new Map();
  for (const img of imgs) {
    const id = img.dataset.fotoPlanilha, v = img.dataset.fotoV, url = await doAparelho(id, v);
    if (url) img.src = url;
    else if (!pendentes.has(id + "|" + v)) faltam.set(id + "|" + v, { id, v });
  }
  const lista = [...faltam.values()];
  for (let i = 0; i < lista.length; i += 6) {
    const lote = lista.slice(i, i + 6);
    lote.forEach(x => pendentes.add(x.id + "|" + x.v));
    try {
      const j = await chamar("fotos", { itens: lote.map(x => { const [casa, perfume] = x.id.split("||"); return { casa, perfume }; }) }, { timeoutMs: 45000 });
      for (const f of j.fotos || []) {
        const x = lote.find(y => y.id.toLowerCase() === (f.casa + "||" + f.perfume).toLowerCase());
        if (x && f.imagem) await guardar(x.id, x.v, f.imagem, f.tipo);   // guarda com a versão que a página pediu
      }
    } catch { /* sem rede: a foto aparece na próxima vez */ }
    lote.forEach(x => pendentes.delete(x.id + "|" + x.v));
  }
  for (const img of raiz.querySelectorAll("img[data-foto-planilha]:not([src])")) {
    const url = memoria.get(img.dataset.fotoPlanilha + "|" + img.dataset.fotoV);
    if (url) img.src = url;
  }
}

/** Observa a página e carrega as fotos que aparecerem. Chamar uma vez ao abrir o app. */
export function iniciarFotos(raiz = document.body) {
  const agendar = () => { if (!agendado) { agendado = true; setTimeout(() => hidratar(raiz), 0); } };
  new MutationObserver(agendar).observe(raiz, { childList: true, subtree: true });
  agendar();
}
