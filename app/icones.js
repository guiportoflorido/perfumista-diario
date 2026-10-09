// icones.js — um ícone por arquétipo (traço 24×24, cor do arquétipo na roda do observatório).
// Usado na roda, nos cartões do Hoje, nas tabelas, nas fichas e no Histórico.
import { esc } from "./util.js";

export const ARQ_PATHS = {
  "Mediterrâneo": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 6.5v11M6.5 12h11M8.1 8.1l7.8 7.8M15.9 8.1l-7.8 7.8"/>',
  "Marinho": '<path d="M2 8.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0"/><path d="M2 13.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0"/><path d="M2 18.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0"/>',
  "Minimalista": '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>',
  "Botânico": '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15Z"/><path d="M5 19 14.5 9.5"/><path d="M10 14h4M12.5 11.5v3"/>',
  "Barbeiro": '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.2 8.2 20 20M8.2 15.8 20 4"/>',
  "Geólogo": '<path d="M12 2.5 19 8l-3 13H8L5 8Z"/><path d="M5 8h14M9.5 8 12 2.5 14.5 8 12 21 9.5 8"/>',
  "Chiprista": '<path d="M12 21V7"/><path d="M12 8.5c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5Z"/><path d="M12 17.5c0-2.6 2-4.6 5-4.6 0 2.6-2 4.6-5 4.6Z"/>',
  "Florista Branco": '<circle cx="12" cy="6.6" r="3.4"/><circle cx="17.1" cy="10.4" r="3.4"/><circle cx="15.2" cy="16.4" r="3.4"/><circle cx="8.8" cy="16.4" r="3.4"/><circle cx="6.9" cy="10.4" r="3.4"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/>',
  "Rosal": '<path d="M12 21v-6"/><path d="M12 15c-4 0-6-3-6-6.5 2 0 3 .6 4 1.6C10 7 11 5 12 3.8c1 1.2 2 3.2 2 6.3 1-1 2-1.6 4-1.6 0 3.5-2 6.5-6 6.5Z"/><path d="M12 19c-1.5-1.8-3.5-2.4-5.5-2"/>',
  "Empoado": '<path d="M7 17a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.7-1.6A4.5 4.5 0 0 1 17 17Z"/><path d="M8.5 20.5h.01M12 21h.01M15.5 20.5h.01"/>',
  "Marceneiro": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v2.5M18.4 5.6l-1.6 1.6"/>',
  "Monge": '<path d="M12 21v-7"/><path d="M8 21h8"/><path d="M12 11.5c-2-1.5-2-3.5 0-5s2-3.5 0-5"/><path d="M15.5 11.5c-1.4-1-1.4-2.4 0-3.6"/><path d="M8.5 11.5c-1.4-1-1.4-2.4 0-3.6"/>',
  "Curtidor": '<path d="M6 3c1 1 2 1.5 3 1 1.5 1 4.5 1 6 0 1 .5 2 0 3-1 0 2 .5 3 2 4-1 3-1 6 0 9-1.5 1-2 2-2 4-1-1-2-1.5-3-1-1.5-1-4.5-1-6 0-1-.5-2 0-3 1 0-2-.5-3-2-4 1-3 1-6 0-9 1.5-1 2-2 2-4Z"/><path d="M9 9.5h6M9 14.5h6" stroke-dasharray="1.5 2"/>',
  "Sultão": '<path d="M15 3.5A9 9 0 1 0 20.5 15 7 7 0 1 1 15 3.5Z"/><path d="m17.6 6.6.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="currentColor"/>',
  "Lareira": '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-10-1.5 2-2 3.5-2 5-1.5-1-2.5-2.5-2.5-4.5C7 8 5 11 5 15c0 4.3 3 7 7 7Z"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-1.8 1.5-2.7 3-4.5 1.5 1.8 3 2.7 3 4.5 0 1.8-1.3 3-3 3Z"/>',
  "Confeiteiro": '<path d="M5 11h14l-2 10H7Z"/><path d="M5 11a3.5 3.5 0 0 1 2-6.3A4.5 4.5 0 0 1 15.5 4 3.5 3.5 0 0 1 19 11"/><path d="M10 11l.8 10M14 11l-.8 10"/><circle cx="12" cy="3" r="1" fill="currentColor"/>',
};

let CORES = {};
export function definirCores(arquetipos) { CORES = Object.fromEntries((arquetipos || []).map(a => [a.nome, a.cor])); }
export const corArq = nome => CORES[nome] || "currentColor";

/** Ícone HTML (SVG inline) do arquétipo, na cor dele. */
export function arqIcone(nome, tam = 16, classe = "") {
  const p = ARQ_PATHS[nome];
  if (!p) return "";
  return `<svg class="arq-ic ${classe}" viewBox="0 0 24 24" width="${tam}" height="${tam}" style="color:${corArq(nome)}" aria-hidden="true" focusable="false">${p}</svg>`;
}

/** Ícone + nome do arquétipo. */
export const arqTag = (nome, tam = 15) => (nome ? `<span class="arq-tag">${arqIcone(nome, tam)}${esc(nome)}</span>` : "—");

/** Grupo SVG para desenhar o ícone dentro de outro SVG (roda), centrado em (x, y). */
export function arqIconeSVG(nome, x, y, tam) {
  const p = ARQ_PATHS[nome];
  if (!p) return "";
  const s = tam / 24;
  return `<g class="r-ic" transform="translate(${(x - tam / 2).toFixed(1)} ${(y - tam / 2).toFixed(1)}) scale(${s.toFixed(3)})" style="color:${corArq(nome)}">${p}</g>`;
}
