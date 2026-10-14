// util.js — formatação compartilhada pelas telas.
import { FAIXAS } from "../engine/index.js";

export const $ = (s, el = document) => el.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const ROT_OC = { Lazer: "Lazer", "T.Inf": "Trab. Informal", "T.For": "Trab. Formal", "N.Inf": "Noite Informal", "N.For": "Noite Formal", "Cozy D": "Cozy Dia", "Cozy N": "Cozy Noite" };
export const OCAS_TODAS = Object.keys(ROT_OC);
export const faixaHTML = idx => `<span class="pinta f${idx}" aria-hidden="true"></span>${FAIXAS[idx]}`;
export const pinta = idx => `<span class="pinta f${idx}" aria-hidden="true"></span>`;
export const nf = (x, d = 1) => (x == null || x === "" || Number.isNaN(Number(x)) ? "—" : Number(x).toLocaleString("pt-BR", { maximumFractionDigits: d }));
export const virg = x => String(x).replace(".", ",");
export const tierHTML = t => `<span class="tier ${esc(t)}" title="Tier ${esc(t)}">${esc(t)}</span>`;
export const slotNome = s => (s === "M" ? "Dia" : s === "N" ? "Noite" : "?");

/** Markdown mínimo do playbook (tabelas, listas, negrito/itálico, parágrafos). Entrada é arquivo do projeto, escapada. */
export function md(txt) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`(.+?)`/g, "<code>$1</code>");
  const linhas = txt.split("\n"), out = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.startsWith("|")) {
      const bloco = []; while (i < linhas.length && linhas[i].startsWith("|")) bloco.push(linhas[i++]); i--;
      const cel = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const [cab, , ...corpo] = bloco;
      out.push(`<div class="tabela"><table><thead><tr>${cel(cab).map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${corpo.map(r => `<tr>${cel(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    } else if (/^\s*[-*] /.test(l)) {
      const it = []; while (i < linhas.length && /^\s*[-*] /.test(linhas[i])) it.push(linhas[i++].replace(/^\s*[-*] /, "")); i--;
      out.push(`<ul>${it.map(x => `<li>${inline(x)}</li>`).join("")}</ul>`);
    } else if (/^\d+\. /.test(l)) {
      const it = []; while (i < linhas.length && /^\d+\. /.test(linhas[i])) it.push(linhas[i++].replace(/^\d+\. /, "")); i--;
      out.push(`<ol>${it.map(x => `<li>${inline(x)}</li>`).join("")}</ol>`);
    } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join("");
}

// ───────────────────────── ordenação em até 3 níveis (tabelas da Coleção e do Mercado) ─────────────────────────
/** Lista de critérios [{k, dir}] (máx. 3). Aceita o formato antigo {ord, dir}. */
export function ordsDe(f, padrao = "tier") {
  if (Array.isArray(f.ords) && f.ords.length) return f.ords.slice(0, 3);
  return [{ k: f.ord || padrao, dir: f.dir || "asc" }];
}
/** Tocar num cabeçalho: vira o 1º critério (se já é o 1º, inverte); os outros descem. */
export function tocarOrd(ords, k) {
  if (ords[0]?.k === k) return [{ k, dir: ords[0].dir === "asc" ? "desc" : "asc" }, ...ords.slice(1)];
  return [{ k, dir: "asc" }, ...ords.filter(o => o.k !== k)].slice(0, 3);
}
/** Comparador encadeado. cmp(k, a, b) compara um critério em ordem crescente; vazios ficam no fim nos dois sentidos. */
export function compararMulti(ords, cmp, desempate) {
  return (a, b) => {
    for (const { k, dir } of ords) {
      const r = cmp(k, a, b);
      if (r.vazio) { if (r.c) return r.c; continue; }
      if (r.c) return dir === "desc" ? -r.c : r.c;
    }
    return desempate(a, b);
  };
}
/** Compara valores: números, textos (pt) e vazios sempre no fim. */
export function cmpValor(x, y) {
  const vx = x === "" || x == null, vy = y === "" || y == null;
  if (vx || vy) return { vazio: true, c: vx === vy ? 0 : vx ? 1 : -1 };
  return { c: typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt") };
}
/** Botão de cabeçalho com o selo do nível (①②③) e a seta. attr = nome do data-atributo (ex.: "col-ord"). */
export function cabOrd(k, rot, ords, attr) {
  const i = ords.findIndex(o => o.k === k), o = ords[i];
  const selo = i >= 0 ? `<span class="ord-n">${"①②③"[i]}</span>${o.dir === "asc" ? "↑" : "↓"}` : "";
  return `<button data-${attr}="${k}" aria-sort="${i === 0 ? (o.dir === "asc" ? "ascending" : "descending") : "none"}" class="${i >= 0 ? `ord-ativa ord-${i}` : ""}">${rot}${selo ? ` ${selo}` : ""}</button>`;
}
/** Painel com 3 seletores (1º, 2º, 3º) e a direção de cada um. prefixo identifica a tabela ("col" ou "mf"). */
export function painelOrd(ords, colunas, prefixo) {
  const linha = n => {
    const o = ords[n] || { k: "", dir: "asc" };
    return `<div class="ord-linha"><span class="ord-rot">${n + 1}º</span>
      <select data-ord-sel="${prefixo}" data-n="${n}" aria-label="${n + 1}º critério">${n ? `<option value="">—</option>` : ""}${colunas.map(([k, r]) => `<option value="${esc(k)}" ${o.k === k ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <button class="chip" data-ord-dir="${prefixo}" data-n="${n}" ${o.k ? "" : "disabled"} aria-label="Inverter direção">${o.dir === "asc" ? "↑ crescente" : "↓ decrescente"}</button></div>`;
  };
  return `<details class="ordenar" ${ords.length > 1 ? "open" : ""}><summary>Ordenar por <span class="nota">${ords.map((o, i) => `${i + 1}º ${esc(colunas.find(c => c[0] === o.k)?.[1] || o.k)} ${o.dir === "asc" ? "↑" : "↓"}`).join(" · ")}</span></summary>
    <div class="ord-painel">${linha(0)}${linha(1)}${linha(2)}</div></details>`;
}
/** Aplica a mudança de um seletor ou botão de direção do painel. */
export function mudarOrds(ords, n, { k, inverter }) {
  const r = ords.map(o => ({ ...o }));
  if (inverter) { if (r[n]) r[n].dir = r[n].dir === "asc" ? "desc" : "asc"; return r; }
  if (!k) return n === 0 ? r : r.slice(0, n);                // "—" corta este nível e os seguintes
  r[n] = { k, dir: r[n]?.dir || "asc" };
  return r.filter((o, i) => o && (o.k !== k || i === n)).slice(0, 3);
}

// ───────────────────────── filtro "Amostra" (Coleção e Mercado) ─────────────────────────
export const OPC_AMOSTRA = [["", "Todas"], ["tem", "Com amostra em mãos"], ["gui", "Amostra do Gui"], ["bia", "Amostra da Bia"], ["nao", "Sem amostra"]];
/** donos = Set("Gui"/"Bia") das amostras em mãos daquele perfume (ou undefined). */
export function passaAmostra(v, donos) {
  if (!v) return true;
  const tem = Boolean(donos && donos.size);
  return v === "tem" ? tem : v === "nao" ? !tem : v === "gui" ? Boolean(donos?.has("Gui")) : v === "bia" ? Boolean(donos?.has("Bia")) : true;
}
export const temFiltro = (f, chaves) => chaves.some(k => f[k] !== undefined && f[k] !== null && f[k] !== "");
