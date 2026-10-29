// graficos.js — análises gráficas da aba Análises, em SVG feito à mão (sem biblioteca, funciona offline):
// mandala dos arquétipos (sua forma), termômetro de uso, rio de arquétipos por semana e Dia → Noite.
// Funções puras: recebem dados já recortados no período e devolvem HTML/SVG. Cores dos arquétipos via corArq.
import { esc } from "./util.js";
import { corArq, arqIconeSVG } from "./icones.js";
import { faixaIdx } from "../engine/index.js";

const f1 = x => x.toFixed(1);
const num = v => (v === "" || v == null ? NaN : Number(String(v).replace(",", ".")));
const FX_COR = ["var(--fMQ)", "var(--fQ)", "var(--fA)", "var(--fF)", "var(--fFr)", "var(--fMF)"];
const FX_CURTA = ["MQ", "Q", "A", "F", "Fr", "MF"];

// ───────────────────────── 1 · mandala: sua forma ─────────────────────────
export const TRANSBORDA = 7;   // frascos no mesmo arquétipo a partir dos quais a fatia “transborda”

/** Dados da mandala: por arquétipo, frascos da grade e usos no período (contagens.por). */
export function dadosMandala(arquetipos, frascos, por) {
  return arquetipos.map(a => {
    const fs = frascos.filter(f => f.arquetipo === a.nome);
    const usos = fs.reduce((s, f) => s + (por.get(f.nome)?.n || 0), 0);
    return { nome: a.nome, cor: a.cor, frascos: fs.length, usos };
  });
}

/** SVG da mandala: setores dos 16 arquétipos, contorno tracejado = coleção, forma dourada = uso. Marca onde ele vai
 *  fundo (maior uso), os arquétipos que tem e nunca alcançou no período e as fatias que transbordam. */
export function mandalaSVG(dados) {
  const W = 560, C = W / 2, R0 = 78, R1 = 214, RL = 246, n = dados.length, SEG = 2 * Math.PI / n;
  const ang = i => -Math.PI / 2 + (i + 0.5) * SEG;
  const pol = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const maxF = Math.max(1, ...dados.map(d => d.frascos)), maxU = Math.max(1, ...dados.map(d => d.usos));
  const partes = [];
  dados.forEach((d, i) => {
    const a0 = -Math.PI / 2 + i * SEG + 0.012, a1 = -Math.PI / 2 + (i + 1) * SEG - 0.012;
    const [x0, y0] = pol(R0, a0), [x1, y1] = pol(R1, a0), [x2, y2] = pol(R1, a1), [x3, y3] = pol(R0, a1);
    const nunca = d.frascos && !d.usos, fundo = d.usos === maxU && d.usos > 0;
    partes.push(`<path class="md-setor${nunca ? " nunca" : ""}${fundo ? " fundo" : ""}" d="M${f1(x0)},${f1(y0)} L${f1(x1)},${f1(y1)} A${R1},${R1} 0 0 1 ${f1(x2)},${f1(y2)} L${f1(x3)},${f1(y3)} A${R0},${R0} 0 0 0 ${f1(x0)},${f1(y0)}Z" fill="${d.cor}" stroke="${d.cor}"/>`);
    // arco externo na cor do arquétipo; tracejado vermelho se transborda
    const [e0x, e0y] = pol(R1 + 7, a0), [e1x, e1y] = pol(R1 + 7, a1);
    partes.push(`<path class="md-borda${d.frascos >= TRANSBORDA ? " transborda" : ""}" d="M${f1(e0x)},${f1(e0y)} A${R1 + 7},${R1 + 7} 0 0 1 ${f1(e1x)},${f1(e1y)}" stroke="${d.cor}"/>`);
    const [ix, iy] = pol(R1 - 26, ang(i));
    partes.push(`<g class="md-ic${nunca ? " apagado" : ""}">${arqIconeSVG(d.nome, ix, iy, 22)}</g>`);
    // rótulo curvo
    const baixo = Math.sin(ang(i)) > 0.05;
    const [p0x, p0y] = pol(RL, baixo ? a1 : a0), [p1x, p1y] = pol(RL, baixo ? a0 : a1);
    partes.push(`<path id="md${i}" d="M${f1(p0x)},${f1(p0y)} A${RL},${RL} 0 0 ${baixo ? 0 : 1} ${f1(p1x)},${f1(p1y)}" fill="none"/>`);
    partes.push(`<text class="md-rot${nunca ? " apagado" : ""}${d.nome.length > 10 ? " longo" : ""}" fill="${d.cor}" dy="${baixo ? 12 : 0}"><textPath href="#md${i}" startOffset="50%" text-anchor="middle">${esc(d.nome)}</textPath></text>`);
  });
  const forma = (val, max) => dados.map((d, i) => pol(R0 + (R1 - 38 - R0) * (val(d) / max), ang(i)));
  const caminho = pts => pts.map(([x, y], k) => `${k ? "L" : "M"}${f1(x)},${f1(y)}`).join(" ") + "Z";
  const col = forma(d => d.frascos, maxF), uso = forma(d => d.usos, maxU);
  partes.push(`<path class="md-colecao" d="${caminho(col)}"/>`);
  partes.push(`<path class="md-uso" d="${caminho(uso)}"/>`);
  uso.forEach(([x, y], i) => { if (dados[i].usos) partes.push(`<circle class="md-pt" cx="${f1(x)}" cy="${f1(y)}" r="4.5"><title>${esc(dados[i].nome)}: ${dados[i].usos} uso${dados[i].usos === 1 ? "" : "s"} · ${dados[i].frascos} frasco${dados[i].frascos === 1 ? "" : "s"}</title></circle>`); });
  partes.push(`<circle class="md-miolo" cx="${C}" cy="${C}" r="${R0 - 6}"/><text class="md-centro" x="${C}" y="${C - 4}" text-anchor="middle">sua</text><text class="md-centro" x="${C}" y="${C + 22}" text-anchor="middle">forma</text>`);
  return `<svg class="mandala" viewBox="-20 -20 ${W + 40} ${W + 40}" role="img" aria-label="Mandala dos arquétipos: forma dourada = uso no período, contorno tracejado = coleção">${partes.join("")}</svg>`;
}

/** Bloco completo da mandala com os selos e a leitura em texto. */
export function blocoMandala(dados) {
  const maxU = Math.max(0, ...dados.map(d => d.usos));
  const fundo = dados.filter(d => d.usos === maxU && maxU > 0).map(d => d.nome);
  const nunca = dados.filter(d => d.frascos && !d.usos).map(d => d.nome);
  const transb = dados.filter(d => d.frascos >= TRANSBORDA);
  return `<div class="bloco mandala-bloco"><h3>Sua forma</h3>
    <div class="md-selos">${nunca.length ? `<span class="md-selo nunca">nunca alcançado · ${nunca.length}</span>` : ""}${fundo.length ? `<span class="md-selo fundo">onde você vai fundo · ${esc(fundo.join(", "))}</span>` : ""}</div>
    ${mandalaSVG(dados)}
    <p class="md-legenda"><span class="sw uso"></span>uso no período <span class="sw colecao"></span>coleção (frascos)${transb.length ? ` <span class="sw transborda"></span>transborda (${TRANSBORDA}+)` : ""}</p>
    ${nunca.length ? `<p class="nota">Tem frasco e não usou no período: <b>${esc(nunca.join(", "))}</b>.</p>` : ""}
    ${transb.length ? `<p class="md-frase">Quando uma fatia transborda (${esc(transb.map(d => `${d.nome} ${d.frascos}`).join(", "))}), fique com os melhores e deixe o resto ir.</p>` : ""}
  </div>`;
}

// ───────────────────────── 2 · termômetro: cada uso na temperatura em que foi usado ─────────────────────────
/** Pontos do termômetro: usos com Temp, frasco da grade (arquétipo pela coleção). */
export function dadosTermometro(hist, frascos) {
  const arq = new Map(frascos.map(f => [f.nome, f.arquetipo]));
  return hist.map(r => ({ r, T: num(r.temp), arq: arq.get(r.perfume) })).filter(x => Number.isFinite(x.T) && x.arq)
    .map(x => ({ nome: x.r.perfume, data: x.r.data, slot: x.r.slot, T: x.T, arq: x.arq }));
}

export function termometroSVG(pts) {
  const W = 560, H = 190, L = 24, Rr = W - 16, base = 150, T0 = 6, T1 = 38;
  const x = T => L + (Math.min(Math.max(T, T0), T1) - T0) / (T1 - T0) * (Rr - L);
  const cortes = [[T0, 12, 5], [12, 17, 4], [17, 22, 3], [22, 27, 2], [27, 32, 1], [32, T1, 0]];
  const partes = cortes.map(([a, b, i]) => `<rect x="${f1(x(a))}" y="${base + 4}" width="${f1(x(b) - x(a))}" height="10" rx="3" fill="${FX_COR[i]}" opacity=".85"/><text class="tm-fx" x="${f1((x(a) + x(b)) / 2)}" y="${base + 30}" text-anchor="middle">${FX_CURTA[i]}</text>`);
  for (let t = 10; t <= 35; t += 5) partes.push(`<text class="tm-t" x="${f1(x(t))}" y="${base + 46}" text-anchor="middle">${t}°</text>`);
  // empilha pontos por grau (enxame simples)
  const pilha = new Map();
  const ord = [...pts].sort((a, b) => a.T - b.T || (a.data < b.data ? -1 : 1));
  for (const p of ord) {
    const k = Math.round(p.T), h = pilha.get(k) || 0; pilha.set(k, h + 1);
    const cy = base - 9 - h * 13;
    partes.push(`<circle class="tm-pt ${p.slot[0] === "N" ? "noite" : "dia"}" cx="${f1(x(p.T))}" cy="${f1(cy)}" r="5.5" fill="${corArq(p.arq)}" stroke="${corArq(p.arq)}"><title>${esc(p.nome)} · ${String(p.T).replace(".", ",")} °C · ${p.data.split("-").reverse().join("/")}</title></circle>`);
  }
  if (pts.length) {
    const ts = pts.map(p => p.T).sort((a, b) => a - b), med = ts[Math.floor(ts.length / 2)];
    partes.push(`<line class="tm-med" x1="${f1(x(med))}" x2="${f1(x(med))}" y1="12" y2="${base + 2}"/><text class="tm-medt" x="${f1(x(med))}" y="9" text-anchor="middle">mediana ${String(med).replace(".", ",")}°</text>`);
  }
  return `<svg class="termometro" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Termômetro: cada ponto é um uso na temperatura do registro">${partes.join("")}</svg>`;
}

export function blocoTermometro(pts) {
  if (pts.length < 3) return "";
  const porFx = new Map();
  for (const p of pts) { const i = faixaIdx(p.T); porFx.set(i, (porFx.get(i) || 0) + 1); }
  const top = [...porFx].sort((a, b) => b[1] - a[1])[0];
  return `<div class="bloco"><h3>Termômetro</h3>
    ${termometroSVG(pts)}
    <p class="nota">Cada ponto é um uso, na temperatura do registro e na cor do arquétipo (contorno = Noite). Sua faixa mais vivida: <b>${FX_CURTA[top[0]]}</b> (${top[1]} de ${pts.length} usos com temperatura).</p></div>`;
}

// ───────────────────────── 3 · rio de arquétipos por semana ─────────────────────────
const segundaDe = iso => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

/** Semanas (segunda-feira) × arquétipo: [{semana, total, por: Map arq → n}] em ordem. */
export function dadosRio(hist, frascos) {
  const arq = new Map(frascos.map(f => [f.nome, f.arquetipo])), sem = new Map();
  for (const r of hist) {
    const a = arq.get(r.perfume); if (!a) continue;
    const k = segundaDe(r.data); if (!sem.has(k)) sem.set(k, new Map());
    const m = sem.get(k); m.set(a, (m.get(a) || 0) + 1);
  }
  return [...sem].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([semana, por]) => ({ semana, por, total: [...por.values()].reduce((s, x) => s + x, 0) }));
}

/** Rio: cada semana é uma coluna 100 % empilhada por arquétipo; colunas ligadas por faixas curvas (efeito de rio). */
export function rioSVG(semanas, ordemArq) {
  const W = 560, H = 220, top = 8, bot = H - 26, n = semanas.length, larg = Math.min(46, (W - 20) / Math.max(n, 1) * 0.5);
  const xs = semanas.map((_, i) => n === 1 ? W / 2 : 20 + larg / 2 + i * ((W - 40 - larg) / (n - 1)));
  const faixas = semanas.map(s => { let y = top; return new Map(ordemArq.map(a => { const h = (s.por.get(a) || 0) / s.total * (bot - top); const seg = [y, y + h]; y += h; return [a, seg]; })); });
  const partes = [];
  for (const a of ordemArq) {
    for (let i = 0; i < n - 1; i++) {   // fitas entre colunas
      const [a0, a1] = faixas[i].get(a), [b0, b1] = faixas[i + 1].get(a);
      if (a1 - a0 < 0.1 && b1 - b0 < 0.1) continue;
      const xa = xs[i] + larg / 2, xb = xs[i + 1] - larg / 2, xm = (xa + xb) / 2;
      partes.push(`<path class="rio-fita" fill="${corArq(a)}" d="M${f1(xa)},${f1(a0)} C${f1(xm)},${f1(a0)} ${f1(xm)},${f1(b0)} ${f1(xb)},${f1(b0)} L${f1(xb)},${f1(b1)} C${f1(xm)},${f1(b1)} ${f1(xm)},${f1(a1)} ${f1(xa)},${f1(a1)}Z"/>`);
    }
  }
  semanas.forEach((s, i) => {
    for (const a of ordemArq) {
      const [y0, y1] = faixas[i].get(a);
      if (y1 - y0 < 0.1) continue;
      partes.push(`<rect class="rio-col" x="${f1(xs[i] - larg / 2)}" y="${f1(y0)}" width="${f1(larg)}" height="${f1(y1 - y0)}" fill="${corArq(a)}"><title>${esc(a)}: ${s.por.get(a)} na semana de ${s.semana.split("-").reverse().slice(0, 2).join("/")}</title></rect>`);
    }
    partes.push(`<text class="rio-t" x="${f1(xs[i])}" y="${H - 8}" text-anchor="middle">${s.semana.slice(8, 10)}/${s.semana.slice(5, 7)}</text>`);
  });
  return `<svg class="rio" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rio de arquétipos: mistura de arquétipos por semana">${partes.join("")}</svg>`;
}

export function blocoRio(semanas, arquetipos) {
  if (semanas.length < 2) return "";
  const ordem = arquetipos.map(a => a.nome).filter(a => semanas.some(s => s.por.get(a)));
  return `<div class="bloco"><h3>Rio de arquétipos</h3>${rioSVG(semanas, ordem)}
    <p class="nota">Cada coluna é uma semana (começa na segunda), dividida pela participação de cada arquétipo nos usos. As fitas mostram o que cresce e o que some.</p>
    <div class="rio-leg">${ordem.map(a => `<span><i style="background:${corArq(a)}"></i>${esc(a)}</span>`).join("")}</div></div>`;
}

// ───────────────────────── 4 · Dia → Noite ─────────────────────────
/** Pares do mesmo dia: arquétipo do último uso do Dia (M/M2) → do primeiro uso da Noite (N/N2). Map "a|b" → n. */
export function dadosDiaNoite(hist, frascos) {
  const arq = new Map(frascos.map(f => [f.nome, f.arquetipo])), dias = new Map();
  for (const r of hist) {
    const a = arq.get(r.perfume); if (!a) continue;
    if (!dias.has(r.data)) dias.set(r.data, {});
    const d = dias.get(r.data);
    if (r.slot[0] === "M") d.M = a; else if (r.slot[0] === "N" && !d.N) d.N = a;
  }
  const pares = new Map();
  for (const d of dias.values()) if (d.M && d.N) pares.set(`${d.M}|${d.N}`, (pares.get(`${d.M}|${d.N}`) || 0) + 1);
  return pares;
}

export function diaNoiteSVG(pares) {
  const W = 560, top = 10, gap = 6, xL = 150, xR = W - 150, bw = 14;
  const tot = [...pares.values()].reduce((s, x) => s + x, 0);
  const lado = k => { const m = new Map(); for (const [p, n] of pares) { const a = p.split("|")[k]; m.set(a, (m.get(a) || 0) + n); } return [...m].sort((a, b) => b[1] - a[1]); };
  const esq = lado(0), dir = lado(1), H = Math.max(160, 14 * tot + gap * Math.max(esq.length, dir.length) + 2 * top), escala = (H - 2 * top - gap * (Math.max(esq.length, dir.length) - 1)) / tot;
  const pos = lista => { let y = top; return new Map(lista.map(([a, n]) => { const p = [y, y + n * escala]; y += n * escala + gap; return [a, p]; })); };
  const pe = pos(esq), pd = pos(dir), usoE = new Map(), usoD = new Map(), partes = [];
  const ordem = [...pares].sort((a, b) => { const [a0, a1] = a[0].split("|"), [b0, b1] = b[0].split("|"); return pe.get(a0)[0] - pe.get(b0)[0] || pd.get(a1)[0] - pd.get(b1)[0]; });
  for (const [p, n] of ordem) {
    const [a, b] = p.split("|"), h = n * escala;
    const ya = pe.get(a)[0] + (usoE.get(a) || 0), yb = pd.get(b)[0] + (usoD.get(b) || 0);
    usoE.set(a, (usoE.get(a) || 0) + h); usoD.set(b, (usoD.get(b) || 0) + h);
    const xm = (xL + xR) / 2;
    partes.push(`<path class="dn-fita" fill="${corArq(a)}" d="M${xL + bw},${f1(ya)} C${xm},${f1(ya)} ${xm},${f1(yb)} ${xR},${f1(yb)} L${xR},${f1(yb + h)} C${xm},${f1(yb + h)} ${xm},${f1(ya + h)} ${xL + bw},${f1(ya + h)}Z"><title>${esc(a)} → ${esc(b)}: ${n} dia${n === 1 ? "" : "s"}</title></path>`);
  }
  for (const [a, [y0, y1]] of pe) partes.push(`<rect x="${xL}" y="${f1(y0)}" width="${bw}" height="${f1(y1 - y0)}" rx="3" fill="${corArq(a)}"/><text class="dn-rot" x="${xL - 8}" y="${f1((y0 + y1) / 2 + 5)}" text-anchor="end">${esc(a)}</text>`);
  for (const [a, [y0, y1]] of pd) partes.push(`<rect x="${xR}" y="${f1(y0)}" width="${bw}" height="${f1(y1 - y0)}" rx="3" fill="${corArq(a)}"/><text class="dn-rot" x="${xR + bw + 8}" y="${f1((y0 + y1) / 2 + 5)}">${esc(a)}</text>`);
  return `<svg class="dianoite" viewBox="0 0 ${W} ${f1(H)}" role="img" aria-label="Dia → Noite: arquétipo da manhã ligado ao da noite do mesmo dia">${partes.join("")}</svg>`;
}

export function blocoDiaNoite(pares) {
  const tot = [...pares.values()].reduce((s, x) => s + x, 0);
  if (tot < 3) return "";
  const [top, n] = [...pares].sort((a, b) => b[1] - a[1])[0];
  const mesmo = [...pares].filter(([p]) => p.split("|")[0] === p.split("|")[1]).reduce((s, [, x]) => s + x, 0);
  return `<div class="bloco"><h3>Dia → Noite</h3>
    <div class="dn-cab"><span>☀︎ Dia</span><span>☾ Noite</span></div>
    ${diaNoiteSVG(pares)}
    <p class="nota">Em ${tot} dias com Dia e Noite, a dupla mais repetida foi <b>${esc(top.replace("|", " → "))}</b> (${n}×). ${mesmo ? `${mesmo === 1 ? "1 dia ficou" : `${mesmo} dias ficaram`} no mesmo arquétipo.` : "Nunca repetiu o arquétipo no mesmo dia."}</p></div>`;
}
