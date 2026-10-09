// roda.js — Coleção visual (roda dos 16 arquétipos × tier, como no observatório) e Mercado (avaliação v51).
import { esc } from "./util.js";
import { arqIconeSVG } from "./icones.js";
import { daGrade } from "./estatisticas.js";

const TIERS = ["S", "A", "B", "C"];

// ───────────────────────── roda ─────────────────────────
const CX = 450, CY = 450, R_IN = 150, R_OUT = 385, R_LBL = 418;
const RAIO_TIER = { S: R_OUT - 28, A: R_OUT - 88, B: R_OUT - 148, C: R_IN + 30 };
const pol = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const f1 = x => x.toFixed(1);

/** SVG da roda: setores dos 16 arquétipos (ícone + contagem), órbitas por tier, um ponto por frasco. */
export function rodaSVG({ frascos, arquetipos, gaps, verGaps, usosPor }) {
  const grade = frascos.filter(daGrade);
  const n = arquetipos.length, SEG = (2 * Math.PI) / n, GAP = 0.012;
  const idx = Object.fromEntries(arquetipos.map((a, i) => [a.nome, i]));
  const partes = [];
  arquetipos.forEach((a, i) => {
    const a0 = -Math.PI / 2 + i * SEG + GAP, a1 = -Math.PI / 2 + (i + 1) * SEG - GAP, mid = (a0 + a1) / 2;
    const [x0, y0] = pol(R_IN, a0), [x1, y1] = pol(R_OUT, a0), [x2, y2] = pol(R_OUT, a1), [x3, y3] = pol(R_IN, a1);
    partes.push(`<path class="r-setor" data-arq="${esc(a.nome)}" d="M${f1(x0)},${f1(y0)} L${f1(x1)},${f1(y1)} A${R_OUT},${R_OUT} 0 0 1 ${f1(x2)},${f1(y2)} L${f1(x3)},${f1(y3)} A${R_IN},${R_IN} 0 0 0 ${f1(x0)},${f1(y0)}Z" fill="${a.cor}" stroke="${a.cor}"/>`);
    const baixo = Math.sin(mid) > 0.05;
    const [p0x, p0y] = pol(R_LBL, baixo ? a1 : a0), [p1x, p1y] = pol(R_LBL, baixo ? a0 : a1);
    partes.push(`<path id="rl${i}" d="M${f1(p0x)},${f1(p0y)} A${R_LBL},${R_LBL} 0 0 ${baixo ? 0 : 1} ${f1(p1x)},${f1(p1y)}" fill="none"/>`);
    partes.push(`<text class="r-rot${a.nome.length > 9 ? " longo" : ""}" fill="${a.cor}" dy="${baixo ? 22 : 0}"><textPath href="#rl${i}" startOffset="50%" text-anchor="middle">${esc(a.nome)}</textPath></text>`);
    const c = grade.filter(f => f.arquetipo === a.nome).length;
    const [ix, iy] = pol(R_IN - 30, mid);
    partes.push(arqIconeSVG(a.nome, ix, iy, 34));
    const [cx, cy] = pol(R_IN - 64, mid);
    partes.push(`<text class="r-cnt" x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" dominant-baseline="middle" fill="${a.cor}">${c || "·"}</text>`);
  });
  for (const t of TIERS) {
    partes.push(`<circle cx="${CX}" cy="${CY}" r="${RAIO_TIER[t]}" class="r-orb r-orb-${t}"/>`);
    const [x, y] = pol(RAIO_TIER[t], -Math.PI / 2);
    partes.push(`<g class="r-tl"><circle cx="${f1(x)}" cy="${f1(y)}" r="15"/><text x="${f1(x)}" y="${f1(y + 6)}" text-anchor="middle">${t}</text></g>`);
  }
  partes.push(`<text class="r-centro" x="${CX}" y="${CY + 4}" text-anchor="middle">${grade.length}</text><text class="r-centro2" x="${CX}" y="${CY + 34}" text-anchor="middle">frascos</text>`);
  if (verGaps) for (const g of gaps) {
    const mid = -Math.PI / 2 + (idx[g.arquetipo] + 0.5) * SEG;
    const [x, y] = pol((R_IN + R_OUT) / 2, mid);
    partes.push(`<g class="r-gap"><circle cx="${f1(x)}" cy="${f1(y)}" r="20"/><text x="${f1(x)}" y="${f1(y + 7)}" text-anchor="middle">${g.n}</text></g>`);
  }
  for (const a of arquetipos) {
    const doArq = grade.filter(f => f.arquetipo === a.nome);
    const i = idx[a.nome];
    for (const t of TIERS) {
      const fila = doArq.filter(f => f.tier === t).sort((x, y) => x.nome.localeCompare(y.nome));
      fila.forEach((f, k) => {
        const ang = -Math.PI / 2 + i * SEG + SEG * 0.13 + SEG * 0.74 * ((k + 0.5) / fila.length);
        const r = RAIO_TIER[t] + (fila.length > 3 ? (k % 2 ? -13 : 13) : 0);
        const [x, y] = pol(r, ang);
        const usos = usosPor?.get(f.nome) || 0;
        partes.push(`<g class="r-fr" data-fr="${esc(f.nome)}" style="transform-origin:${f1(x)}px ${f1(y)}px" role="button" tabindex="0" aria-label="${esc(f.nome)}, tier ${f.tier}">
          <circle class="r-hit" cx="${f1(x)}" cy="${f1(y)}" r="26"/>
          <circle cx="${f1(x)}" cy="${f1(y)}" r="${12 + Math.min(usos, 6)}" fill="${a.cor}" class="r-ponto" style="--d:${(i * 40 + TIERS.indexOf(t) * 90 + k * 25)}ms"/></g>`);
      });
    }
  }
  return `<svg class="roda" id="roda" viewBox="-30 -30 960 960" role="img" aria-label="Roda dos 16 arquétipos: cada ponto é um frasco, órbita externa = tier S">${partes.join("")}</svg>`;
}

export function telaRoda({ frascos, arquetipos, gaps, verGaps, usosPor }) {
  return `
  <div class="bloco roda-bloco" id="rodaBloco">
    ${rodaSVG({ frascos, arquetipos, gaps, verGaps, usosPor })}
    <div class="roda-prev" id="rodaPrev" hidden></div>
    <div class="roda-legenda"><span>Passe o dedo ou o mouse sobre as bolas</span><span>Toque na prévia para abrir a ficha</span><span>Órbita externa = tier S · bola maior = mais usado em 30 dias</span></div>
    <div class="linha-flex" style="justify-content:center"><button class="chip" data-acao="ver-gaps" aria-pressed="${verGaps}">${verGaps ? "Ocultar gaps" : "Mostrar gaps"}</button></div>
    ${verGaps ? `<ul class="gaps">${gaps.map(g => `<li><span class="gap-n">${g.n}</span><b>${esc(g.gap)}</b> · ${esc(g.arquetipo)} · <span class="nota">${esc(g.status)}</span></li>`).join("")}</ul>` : ""}
  </div>`;
}
