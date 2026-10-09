// roda.js — Coleção visual (roda dos 16 arquétipos × tier, como no observatório) e Mercado (avaliação v51).
import { FAIXAS } from "../engine/index.js";
import { esc, ROT_OC, OCAS_TODAS, pinta } from "./util.js";
import { daGrade } from "./estatisticas.js";

const TIERS = ["S", "A", "B", "C"];

// ───────────────────────── roda ─────────────────────────
const CX = 450, CY = 450, R_IN = 150, R_OUT = 385, R_LBL = 418;
const RAIO_TIER = { S: R_OUT - 28, A: R_OUT - 88, B: R_OUT - 148, C: R_IN + 30 };
const pol = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const f1 = x => x.toFixed(1);

/** SVG da roda. `cel` = célula do playbook escolhida no simulador ({seguro, jogada, tambem}) ou null. */
export function rodaSVG({ frascos, arquetipos, gaps, cel, verGaps, usosPor }) {
  const grade = frascos.filter(daGrade);
  const n = arquetipos.length, SEG = (2 * Math.PI) / n, GAP = 0.012;
  const idx = Object.fromEntries(arquetipos.map((a, i) => [a.nome, i]));
  const papel = nome => (!cel ? "livre" : cel.seguro === nome ? "seguro" : cel.jogada === nome ? "jogada" : cel.tambem.includes(nome) ? "tambem" : "fora");
  const partes = [];
  // setores + rótulos curvos + contagem
  arquetipos.forEach((a, i) => {
    const a0 = -Math.PI / 2 + i * SEG + GAP, a1 = -Math.PI / 2 + (i + 1) * SEG - GAP, mid = (a0 + a1) / 2;
    const [x0, y0] = pol(R_IN, a0), [x1, y1] = pol(R_OUT, a0), [x2, y2] = pol(R_OUT, a1), [x3, y3] = pol(R_IN, a1);
    partes.push(`<path d="M${f1(x0)},${f1(y0)} L${f1(x1)},${f1(y1)} A${R_OUT},${R_OUT} 0 0 1 ${f1(x2)},${f1(y2)} L${f1(x3)},${f1(y3)} A${R_IN},${R_IN} 0 0 0 ${f1(x0)},${f1(y0)}Z" fill="${a.cor}" fill-opacity=".13" stroke="${a.cor}" stroke-opacity=".35"/>`);
    const baixo = Math.sin(mid) > 0.05;
    const [p0x, p0y] = pol(R_LBL, baixo ? a1 : a0), [p1x, p1y] = pol(R_LBL, baixo ? a0 : a1);
    partes.push(`<path id="rl${i}" d="M${f1(p0x)},${f1(p0y)} A${R_LBL},${R_LBL} 0 0 ${baixo ? 0 : 1} ${f1(p1x)},${f1(p1y)}" fill="none"/>`);
    partes.push(`<text class="r-rot${a.nome.length > 9 ? " longo" : ""}" fill="${a.cor}" dy="${baixo ? 22 : 0}"><textPath href="#rl${i}" startOffset="50%" text-anchor="middle">${esc(a.nome)}</textPath></text>`);
    const c = grade.filter(f => f.arquetipo === a.nome).length;
    const [cx, cy] = pol(R_IN - 26, mid);
    partes.push(`<text class="r-cnt" x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" dominant-baseline="middle" fill="${a.cor}">${c || "·"}</text>`);
  });
  // órbitas dos tiers
  for (const t of TIERS) {
    partes.push(`<circle cx="${CX}" cy="${CY}" r="${RAIO_TIER[t]}" class="r-orb r-orb-${t}"/>`);
    const [x, y] = pol(RAIO_TIER[t], -Math.PI / 2 - SEG * 0.0);
    partes.push(`<g class="r-tl"><circle cx="${f1(x)}" cy="${f1(y)}" r="15"/><text x="${f1(x)}" y="${f1(y + 6)}" text-anchor="middle">${t}</text></g>`);
  }
  partes.push(`<text class="r-centro" x="${CX}" y="${CY - 8}" text-anchor="middle">${grade.length}</text><text class="r-centro2" x="${CX}" y="${CY + 26}" text-anchor="middle">frascos na grade</text>`);
  // gaps
  if (verGaps) for (const g of gaps) {
    const mid = -Math.PI / 2 + (idx[g.arquetipo] + 0.5) * SEG;
    const [x, y] = pol((R_IN + R_OUT) / 2, mid);
    partes.push(`<g class="r-gap"><circle cx="${f1(x)}" cy="${f1(y)}" r="20"/><text x="${f1(x)}" y="${f1(y + 7)}" text-anchor="middle">${g.n}</text></g>`);
  }
  // frascos
  const nomesDestaque = [];
  for (const a of arquetipos) {
    const doArq = grade.filter(f => f.arquetipo === a.nome).sort((x, y) => TIERS.indexOf(x.tier) - TIERS.indexOf(y.tier) || x.nome.localeCompare(y.nome));
    const i = idx[a.nome];
    for (const t of TIERS) {
      const fila = doArq.filter(f => f.tier === t);
      fila.forEach((f, k) => {
        const span = SEG * 0.74, off = SEG * 0.13;
        const ang = -Math.PI / 2 + i * SEG + off + span * ((k + 0.5) / fila.length);
        const r = RAIO_TIER[t] + (fila.length > 3 ? (k % 2 ? -13 : 13) : 0);
        const [x, y] = pol(r, ang);
        const p = papel(f.nome), usos = usosPor?.get(f.nome) || 0;
        partes.push(`<g class="r-fr r-${p}" data-ficha="${esc(f.nome)}" role="button" tabindex="0" aria-label="${esc(f.nome)}, tier ${f.tier}">
          <circle class="r-hit" cx="${f1(x)}" cy="${f1(y)}" r="24"/>
          ${p === "seguro" || p === "jogada" ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="23" class="r-anel"/>` : ""}
          <circle cx="${f1(x)}" cy="${f1(y)}" r="${12 + Math.min(usos, 6)}" fill="${a.cor}" class="r-ponto"/></g>`);
        if (p === "seguro" || p === "jogada") nomesDestaque.push({ x, y, nome: f.nome, p });
      });
    }
  }
  for (const d of nomesDestaque) {
    const acima = d.y < CY;
    partes.push(`<text class="r-nome" x="${f1(d.x)}" y="${f1(d.y + (acima ? -34 : 48))}" text-anchor="middle">${d.p === "seguro" ? "★ " : ""}${esc(d.nome)}</text>`);
  }
  return `<svg class="roda" viewBox="-30 -30 960 960" role="img" aria-label="Roda dos 16 arquétipos: cada ponto é um frasco, órbita externa = tier S">${partes.join("")}</svg>`;
}

export function telaRoda({ frascos, arquetipos, gaps, playbook, sim, verGaps, usosPor, hojeFaixa, hojeOc }) {
  const cel = sim && sim.faixa != null && sim.oc ? playbook?.grade[playbook.faixas[sim.faixa]]?.celulas[sim.oc] || { seguro: null, jogada: null, tambem: [] } : null;
  const ocsValidas = sim?.faixa != null && playbook ? Object.keys(playbook.grade[playbook.faixas[sim.faixa]].celulas) : OCAS_TODAS;
  const chipF = (i) => `<button class="chip" data-sim-faixa="${i}" aria-pressed="${sim?.faixa === i}">${pinta(i)}${FAIXAS[i]}</button>`;
  const chipO = (o) => `<button class="chip" data-sim-oc="${o}" aria-pressed="${sim?.oc === o}" ${ocsValidas.includes(o) ? "" : "disabled"}>${ROT_OC[o]}</button>`;
  return `
  <div class="bloco roda-bloco">
    ${rodaSVG({ frascos, arquetipos, gaps, cel, verGaps, usosPor })}
    <div class="roda-legenda"><span>Órbita = tier (S por fora)</span><span>Ponto maior = mais usado</span><span>Toque num ponto para a ficha</span></div>
  </div>
  <div class="bloco">
    <div class="linha-flex"><h3>Simulador do playbook</h3><span class="esp"></span>
      ${hojeFaixa != null ? `<button class="btn sec peq" data-acao="sim-hoje">Hoje</button>` : ""}
      ${cel ? `<button class="btn sec peq" data-acao="sim-limpar">Limpar</button>` : ""}
      <button class="btn sec peq" data-acao="ver-gaps" aria-pressed="${verGaps}">${verGaps ? "Ocultar gaps" : "Gaps"}</button></div>
    <div class="chips rolagem">${FAIXAS.map((_, i) => chipF(i)).join("")}</div>
    <div class="chips rolagem">${OCAS_TODAS.map(chipO).join("")}</div>
    ${cel ? `<p class="nota">${pinta(sim.faixa)}${FAIXAS[sim.faixa]} × ${ROT_OC[sim.oc]}: ${cel.seguro ? `<b>★ ${esc(cel.seguro)}</b> (Seguro, ${esc(cel.sprays)} sprays)` : "sem Seguro"}${cel.jogada ? ` · <b>${esc(cel.jogada)}</b> (Jogada)` : ""} · ${cel.tambem.length} em Também. Os demais ficam apagados.</p>`
      : `<p class="nota">Escolha faixa e ocasião para acender só os frascos daquela célula do playbook.</p>`}
    ${verGaps ? `<ul class="gaps">${gaps.map(g => `<li><span class="gap-n">${g.n}</span><b>${esc(g.gap)}</b> · ${esc(g.arquetipo)} · <span class="nota">${esc(g.status)}</span></li>`).join("")}</ul>` : ""}
  </div>`;
}

