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
