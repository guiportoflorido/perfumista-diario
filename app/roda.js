// roda.js — Coleção visual (roda dos 16 arquétipos × tier, como no observatório) e Mercado (avaliação v51).
import { FAIXAS } from "../engine/index.js";
import { esc, ROT_OC, OCAS_TODAS, pinta, tierHTML, nf } from "./util.js";
import { daGrade } from "./estatisticas.js";

const TIERS = ["S", "A", "B", "C"];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

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

// ───────────────────────── mercado ─────────────────────────
/** Junta a avaliação v51 com a aba Tiers (tier e posse da planilha vencem). */
export function mercadoComPlanilha(perfumes, tiers) {
  if (!tiers?.length) return perfumes;
  const m = new Map(tiers.map(t => [norm(t.casa) + "|" + norm(t.perfume), t]));
  return perfumes.map(p => {
    const t = m.get(norm(p.casa) + "|" + norm(p.nome));
    return t ? { ...p, tier: t.tier || p.tier, posse: t.posse || p.posse, daPlanilha: true } : p;
  });
}

const POSSES = [["", "Toda posse"], ["Frasco Gui", "Na coleção"], ["Frasco Bia", "Frasco Bia"], ["amostra", "Amostras"], ["nao", "Não tenho"]];

export function filtrarMercado(lista, f) {
  const q = norm(f.q);
  return lista.filter(p => {
    if (f.tier === "sem" ? p.tier : f.tier && p.tier !== f.tier) return false;
    if (f.posse === "amostra" ? !/amostra/i.test(p.posse) : f.posse === "nao" ? /frasco/i.test(p.posse) : f.posse && p.posse !== f.posse) return false;
    if (f.arq && p.arquetipo !== f.arq) return false;
    if (f.wish && !p.wish) return false;
    if (q && !norm(`${p.nome} ${p.casa} ${p.nariz} ${p.topo} ${p.coracao} ${p.base}`).includes(q)) return false;
    return true;
  }).sort((a, b) => ("SABCD".indexOf(a.tier) + 1 || 9) - ("SABCD".indexOf(b.tier) + 1 || 9) || a.casa.localeCompare(b.casa) || a.nome.localeCompare(b.nome));
}

export function telaMercado({ mercado, arquetipos, filtro, limite }) {
  if (!mercado) return `<div class="bloco"><p class="nota">Carregando a base de 1.205 perfumes…</p></div>`;
  const total = mercado.length, comTier = mercado.filter(p => p.tier).length, wish = mercado.filter(p => p.wish).length;
  const meus = mercado.filter(p => p.posse === "Frasco Gui").length;
  const lista = filtrarMercado(mercado, filtro);
  const oport = mercado.filter(p => (p.tier === "S" || p.tier === "A") && !/frasco/i.test(p.posse));
  const porArq = arquetipos.map(a => ({ a, merc: mercado.filter(p => p.arquetipo === a.nome).length, meus: mercado.filter(p => p.arquetipo === a.nome && p.posse === "Frasco Gui").length }));
  const maxM = Math.max(...porArq.map(x => x.merc), 1);
  const op = (v, r, at) => `<option value="${esc(v)}" ${String(at ?? "") === String(v) ? "selected" : ""}>${esc(r)}</option>`;
  return `
  <div class="kpis">
    <div class="kpi"><span class="v">${nf(total, 0)}</span><span class="l">perfumes na base</span></div>
    <div class="kpi"><span class="v">${comTier}</span><span class="l">com tier seu</span></div>
    <div class="kpi"><span class="v">${meus}</span><span class="l">na sua coleção</span></div>
  </div>
  <div class="bloco"><h3>Mercado × coleção por arquétipo</h3>
    <div class="mxc">${porArq.sort((x, y) => y.merc - x.merc).map(x => `<button class="mxc-l" data-mf-arq="${esc(x.a.nome)}">
      <span class="t"><span class="pinta" style="background:${x.a.cor}"></span>${esc(x.a.nome)}</span>
      <span class="trilho"><span style="width:${(x.merc / maxM) * 100}%;background:${x.a.cor};opacity:.35"></span><span class="meus" style="width:${(x.meus / maxM) * 100}%;background:${x.a.cor}"></span></span>
      <span class="n">${x.meus}/${x.merc}</span></button>`).join("")}</div>
    <p class="nota">Barra clara = perfumes da base naquele arquétipo; barra cheia = seus frascos. Toque para filtrar.</p>
  </div>
  <details class="bloco"><summary>S ou A que você não tem como frasco · ${oport.length}</summary>
    <p class="nota">Ponto de partida para wishlist, não recomendação de compra: compra passa pelos 5 gates.</p>
    <div class="lista">${oport.sort((a, b) => a.tier.localeCompare(b.tier) || a.nome.localeCompare(b.nome)).map(itemMercado).join("")}</div>
  </details>
  <div class="bloco">
    <input type="search" id="mf-q" placeholder="Buscar perfume, casa, nariz ou nota" value="${esc(filtro.q || "")}" aria-label="Buscar no mercado">
    <div class="chips rolagem">${[["", "Todo tier"], ...["S", "A", "B", "C", "D"].map(t => [t, `Tier ${t}`]), ["sem", "Sem tier"]].map(([v, r]) => `<button class="chip" data-mf="tier" data-v="${v}" aria-pressed="${(filtro.tier || "") === v}">${r}</button>`).join("")}
      <button class="chip" data-mf="wish" data-v="${filtro.wish ? "" : "1"}" aria-pressed="${Boolean(filtro.wish)}">★ Wishlist (${wish})</button></div>
    <div class="campos">
      <label>Posse<select id="mf-posse">${POSSES.map(([v, r]) => op(v, r, filtro.posse)).join("")}</select></label>
      <label>Arquétipo<select id="mf-arq">${op("", "Todos", filtro.arq)}${arquetipos.map(a => op(a.nome, a.nome, filtro.arq)).join("")}</select></label>
    </div>
    <p class="nota">${lista.length} perfume${lista.length === 1 ? "" : "s"}. Tier e posse vêm da aba Tiers quando o perfume está lá; o resto, da avaliação v51.</p>
  </div>
  <div class="lista">${lista.slice(0, limite).map(itemMercado).join("") || `<p class="vazio">Nada com esses filtros.</p>`}</div>
  ${lista.length > limite ? `<button class="btn sec" data-acao="mf-mais">Mostrar mais (${lista.length - limite})</button>` : ""}`;
}

function itemMercado(p) {
  const id = `${p.casa}||${p.nome}`;
  return `<article class="card compacto"><span class="pos">${p.tier ? tierHTML(p.tier) : `<span class="tier sem">–</span>`}</span>
    <div style="min-width:0"><button class="nome" data-merc="${esc(id)}">${esc(p.nome)}</button>${p.wish ? ` <span class="selo manual">★</span>` : ""}
      <div class="casa">${esc(p.casa)}${p.arquetipo ? ` · ${esc(p.arquetipo)}` : ""}${p.posse ? ` · <b>${esc(p.posse === "Frasco Gui" ? "na coleção" : p.posse)}</b>` : ""}</div></div><span></span></article>`;
}

export function fichaMercado(p) {
  const barra = (rot, v) => `<div class="barra"><span class="t">${rot}</span><span class="trilho"><span style="width:${(v / 9) * 100}%"></span></span><span class="n">${v}/9</span></div>`;
  return `<div class="linha-flex"><h2 id="fichaT">${esc(p.nome)}</h2>${p.tier ? tierHTML(p.tier) : ""}<span class="esp"></span><button class="btn sec peq" data-fechar>Fechar</button></div>
    <p class="nota">${esc(p.casa)}${p.nariz ? ` · ${esc(p.nariz)}` : ""}${p.arquetipo ? ` · ${esc(p.arquetipo)}` : ""}</p>
    <dl class="kv">
      <dt>Posse</dt><dd>${esc(p.posse || "não tem")}${p.wish ? ` · <span class="selo manual">★ wishlist</span>` : ""}</dd>
      <dt>Tier</dt><dd>${p.tier ? `${esc(p.tier)}${p.daPlanilha ? ` <span class="nota">(aba Tiers)</span>` : ""}` : "sem tier seu"}</dd>
      ${p.resumo ? `<dt>Perfil</dt><dd>${esc(p.resumo)}</dd>` : ""}
      <dt>Topo</dt><dd>${esc(p.topo || "—")}</dd>
      <dt>Coração</dt><dd>${esc(p.coracao || "—")}</dd>
      <dt>Base</dt><dd>${esc(p.base || "—")}</dd>
      ${p.gap ? `<dt>Gap</dt><dd>${esc(p.gap)}</dd>` : ""}
    </dl>
    <div class="bloco"><h3>Clima <span class="selo aviso">estimativa da avaliação v51</span></h3>${barra("Calor", p.calor)}${barra("Ameno", p.ameno)}${barra("Frio", p.frio)}</div>
    <p class="nota">Fonte: avaliacao_perfumes_v51. Pirâmide e perfil como estão na base; para compra, os 5 gates.</p>`;
}
