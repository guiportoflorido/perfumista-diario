// duelo.js — “Qual dos dois?”: pareamento justo, Elo de gosto calculado do log inteiro e fila local dos duelos.
// O Elo é só leitura (Coleção, ficha, Histórico); durante o duelo ele nunca aparece, para não viciar a escolha.
import { ler, gravar } from "./store.js";
import { chamar, configurado } from "./api.js";
import { daGrade } from "./estatisticas.js";
import { esc, tierHTML } from "./util.js";
import { arqTag } from "./icones.js";

const TIERS = ["S", "A", "B", "C"];
export const ELO_INICIAL = 1500, ELO_MIN_N = 5;
const chavePar = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Linhas da aba Duelos (com cabeçalho) → [{data, hora, a, b, vencedor, contexto}] válidas, em ordem cronológica. */
export function lerDuelos(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).map(r => ({ data: String(r[0] || "").trim(), hora: String(r[1] || "").trim(), a: String(r[2] || "").trim(),
    b: String(r[3] || "").trim(), vencedor: String(r[4] || "").trim(), contexto: String(r[5] || "") }))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.data) && d.a && d.b && d.a !== d.b && (d.vencedor === d.a || d.vencedor === d.b))
    .sort(ordemDuelo);
}
const ordemDuelo = (x, y) => (x.data + x.hora < y.data + y.hora ? -1 : x.data + x.hora > y.data + y.hora ? 1 : 0);
const chaveDuelo = d => [d.data, d.hora, d.a, d.b].join("|");

/** Planilha + fila do aparelho ainda não confirmada, sem duplicar (chave Data|Hora|A|B). */
export function duelosUnificados(planilha, fila) {
  const vistos = new Set(planilha.map(chaveDuelo));
  return [...planilha, ...fila.filter(d => !vistos.has(chaveDuelo(d)))].sort(ordemDuelo);
}

/** Próximo par [A, B]. Candidatos: frascos da grade (já sem os que não são “Frasco Gui”, via aplicarTiers).
 *  Custo do par = 3 × duelos entre os dois + 2 × (prioridade − 1) + 0,25 × duelos de cada um; prioridade 1 = mesmo
 *  arquétipo e mesmo tier, 2 = mesmo arquétipo e tiers vizinhos, 3 = qualquer par. Empate: sorteio. */
export function pareamento(frascos, duelos = [], aleatorio = Math.random) {
  const fs = frascos.filter(daGrade).filter(f => TIERS.includes(f.tier));
  if (fs.length < 2) return null;
  const nDe = new Map(), nPar = new Map();
  for (const d of duelos) {
    nDe.set(d.a, (nDe.get(d.a) || 0) + 1); nDe.set(d.b, (nDe.get(d.b) || 0) + 1);
    const k = chavePar(d.a, d.b); nPar.set(k, (nPar.get(k) || 0) + 1);
  }
  let melhor = Infinity, empates = [];
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i], b = fs[j];
    const mesmoArq = a.arquetipo === b.arquetipo, dt = Math.abs(TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
    const prio = mesmoArq && dt === 0 ? 1 : mesmoArq && dt === 1 ? 2 : 3;
    const custo = 3 * (nPar.get(chavePar(a.nome, b.nome)) || 0) + 2 * (prio - 1) + 0.25 * ((nDe.get(a.nome) || 0) + (nDe.get(b.nome) || 0));
    if (custo < melhor - 1e-9) { melhor = custo; empates = [[a, b]]; }
    else if (Math.abs(custo - melhor) < 1e-9) empates.push([a, b]);
  }
  const par = empates[Math.min(empates.length - 1, Math.floor(aleatorio() * empates.length))];
  return aleatorio() < 0.5 ? par : [par[1], par[0]];
}

/** Elo de cada frasco, recalculado do zero a partir do log (em ordem): começa em 1500; K = 32 nos 10 primeiros duelos
 *  do frasco, depois 16. Devolve Map nome → {rating, n, vitorias} (todos os frascos, mesmo sem duelo). */
export function elo(duelos, frascos = []) {
  const m = new Map(frascos.map(f => [f.nome, { rating: ELO_INICIAL, n: 0, vitorias: 0 }]));
  const de = nome => { if (!m.has(nome)) m.set(nome, { rating: ELO_INICIAL, n: 0, vitorias: 0 }); return m.get(nome); };
  for (const d of [...duelos].sort(ordemDuelo)) {
    const A = de(d.a), B = de(d.b), ea = 1 / (1 + 10 ** ((B.rating - A.rating) / 400)), sa = d.vencedor === d.a ? 1 : 0;
    const ka = A.n < 10 ? 32 : 16, kb = B.n < 10 ? 32 : 16;
    A.rating += ka * (sa - ea); B.rating += kb * ((1 - sa) - (1 - ea));
    A.n++; B.n++; if (sa) A.vitorias++; else B.vitorias++;
  }
  return m;
}

/** “1 612”: Elo arredondado com espaço de milhar. */
export const fmtElo = r => String(Math.round(r)).replace(/\B(?=(\d{3})+$)/g, " ");

/** Descompassos (Histórico): tier S/A com Elo < 1450 e tier B/C com Elo > 1550, só com n ≥ 5; os 3 maiores. */
export function descompassos(m, frascos, max = 3) {
  return frascos.map(f => ({ f, e: m.get(f.nome) })).filter(({ f, e }) => e && e.n >= ELO_MIN_N &&
    ((["S", "A"].includes(f.tier) && e.rating < 1450) || (["B", "C"].includes(f.tier) && e.rating > 1550)))
    .sort((x, y) => Math.abs(y.e.rating - ELO_INICIAL) - Math.abs(x.e.rating - ELO_INICIAL)).slice(0, max);
}

// ───────────── fila local (mesmo espírito da fila do Diário) ─────────────
export const filaDuelos = () => ler("duelosFila", []);
export function adicionarDuelo(d) {
  const novo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...d };
  gravar("duelosFila", [...filaDuelos(), novo]);
  return novo;
}

/** Envia a fila para a aba Duelos. Gravado (ou já existente) sai da fila; sem rede, fica para a próxima. */
export async function enviarDuelos() {
  const fila = filaDuelos();
  if (!fila.length || !configurado()) return { enviados: 0 };
  try {
    const j = await chamar("duelo_registrar", { linhas: fila.map(({ id, data, hora, a, b, vencedor, contexto }) => ({ id, data, hora, a, b, vencedor, contexto })) });
    const ok = new Set(j.gravadas.map(g => g.id));
    gravar("duelosFila", filaDuelos().filter(d => !ok.has(d.id)));
    return { enviados: ok.size };
  } catch (e) {
    return { enviados: 0, erro: e.message, rede: e.codigo === "rede" };
  }
}

// ───────────── telas ─────────────

/** Tela do Duelo (Coleção › Duelo). par = [fA, fB]; foto(f) = HTML da foto/ícone; nHoje = duelos de hoje. Sem Elo aqui. */
export function telaDuelo({ par, foto, nHoje }) {
  if (!par) return `<h2>Duelo</h2><div class="bloco"><p class="vazio">Precisa de pelo menos dois frascos da grade.</p></div>`;
  const card = (f, i) => `<button class="duelo-card" data-duelo-vence="${i}" aria-label="Prefiro ${esc(f.nome)}">
      ${foto(f)}<span class="dc-tx"><b>${esc(f.nome)}</b>${tierHTML(f.tier)}<span class="casa">${esc(f.casa)}</span><span class="casa">${arqTag(f.arquetipo, 14)}</span></span></button>`;
  return `<h2>Duelo</h2>
  <p class="nota">Qual dos dois você usaria agora? Toque no preferido. Cada escolha vai para a aba Duelos da planilha e vira um Elo de gosto (aparece na Coleção, nunca aqui).</p>
  <div class="duelo">${card(par[0], 0)}<span class="duelo-ou">ou</span>${card(par[1], 1)}</div>
  <div class="linha-flex"><span class="nota">${nHoje} duelo${nHoje === 1 ? "" : "s"} hoje</span><span class="esp"></span><button class="btn sec peq" data-acao="duelo-pular">Pular par</button></div>`;
}

/** Bloco “Duelos” do Histórico: top 5 e bottom 5 por Elo (n ≥ 5) e os maiores descompassos com o tier. */
export function blocoDuelos(m, frascos, total) {
  if (!total) return "";
  const fs = frascos.filter(daGrade).map(f => ({ f, e: m.get(f.nome) })).filter(x => x.e && x.e.n >= ELO_MIN_N).sort((a, b) => b.e.rating - a.e.rating);
  const linha = ({ f, e }) => `<li><button class="nome-inline" data-ficha="${esc(f.nome)}">${esc(f.nome)}</button> ${tierHTML(f.tier)} <b>${fmtElo(e.rating)}</b> <span class="nota">(${e.vitorias}/${e.n})</span></li>`;
  const desc = descompassos(m, frascos.filter(daGrade));
  return `<div class="bloco"><h3>Duelos · Elo de gosto</h3>
    <p class="nota">${total} duelo${total === 1 ? "" : "s"} no total. Elo começa em 1 500; só entra aqui com 5+ duelos. Elo baixo com tier alto é sinal de desbaste.</p>
    ${fs.length ? `<div class="duas"><div><h3>Topo</h3><ol class="elo-lista">${fs.slice(0, 5).map(linha).join("")}</ol></div>
      <div><h3>Lanterna</h3><ol class="elo-lista">${fs.slice(-5).reverse().map(linha).join("")}</ol></div></div>` : `<p class="nota">Nenhum frasco com 5 duelos ainda.</p>`}
    ${desc.length ? `<h3>Descompassos com o tier</h3><ul class="elo-lista">${desc.map(x => `<li>${linha(x).slice(4, -5)} · ${["S", "A"].includes(x.f.tier) ? "tier alto, Elo baixo" : "tier baixo, Elo alto"}</li>`).join("")}</ul>` : ""}
  </div>`;
}
