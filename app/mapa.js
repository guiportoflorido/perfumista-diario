// mapa.js — Mapa clima da coleção (o mapa_climatico_colecao da cadeia, dentro do app, sem biblioteca): cada frasco da
// grade numa esfera — horizontal = temperatura ideal (frio à esquerda), vertical = ponto de orvalho (zona pela coluna Td:
// C sobe no ar carregado, N indiferente, S sobe no seco; dentro da zona, mais leve e seco = aguenta mais vapor) ou
// índice de chuva (hipótese do Claude). Cor = arquétipo, tamanho = tier. Linhas de hoje: T máxima e Td/chuva do dia.
import { esc } from "./util.js";
import { corArq } from "./icones.js";

const W = 900, H = 640, M = { l: 44, r: 16, t: 48, b: 40 };
const TX = [6, 38];                                     // °C no eixo horizontal
const FX = [["MF", 6, 12, "var(--fMF)"], ["Fr", 12, 17, "var(--fFr)"], ["F", 17, 22, "var(--fF)"], ["A", 22, 27, "var(--fA)"], ["Q", 27, 32, "var(--fQ)"], ["MQ", 32, 38, "var(--fMQ)"]];
const RAIO = { S: 9, A: 7.5, B: 6.5, C: 5.5, D: 5.5 };
const x = t => M.l + (t - TX[0]) / (TX[1] - TX[0]) * (W - M.l - M.r);
const yTd = td => M.t + (26 - td) / 22 * (H - M.t - M.b);            // Td 4–26 °C, alto = ar carregado
const yCh = r => M.t + (1.8 - r) / 3.6 * (H - M.t - M.b);             // chuva −1,8…1,8, alto = gosta de chuva
const ZONA = { C: [20, 26], N: [12, 20], S: [4, 12] };
const f1 = n => n.toFixed(1);
const curto = n => (n.length > 14 ? n.slice(0, 13) + "…" : n);

/** Posições (x, y) afastadas o mínimo para não sobrepor esfera e nome (caixas; relaxação determinística). */
export function posicoes(frascos, vista = "td", rotulos = "todos") {
  const ps = frascos.map((f, i) => {
    const tx = x(Math.max(TX[0] + 0.5, Math.min(TX[1] - 0.5, f.ideal)));
    let ty, z0 = M.t, z1 = H - M.b;
    if (vista === "td") {
      const [a, b] = ZONA[f.td] || ZONA.N, carga = (f.peso + f.doc - 1) / 7;   // 0 = leve e seco … 1 = denso e doce
      ty = yTd(b - carga * (b - a)); z0 = yTd(b); z1 = yTd(a);
    } else ty = yCh(f.chuva || 0);
    const r = RAIO[f.tier] || 6, comNome = rotulos === "todos" || (rotulos === "S" && f.tier === "S");
    const w = Math.max(2 * r, comNome ? curto(f.nome).length * 5.4 : 0) + 4, h = 2 * r + (comNome ? 13 : 2);
    return { f, i, x: tx, y: ty, tx, ty, r, w, h, z0: z0 + r, z1: z1 - h + r };
  });
  for (let it = 0; it < 500; it++) {
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      // caixa: esfera no topo, nome embaixo → centro da caixa = y + (h/2 − r)
      const dx = b.x - a.x, dy = (b.y + b.h / 2 - b.r) - (a.y + a.h / 2 - a.r);
      const ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      const sx = dx === 0 ? ((i + j) % 2 ? 1 : -1) : Math.sign(dx), sy = dy === 0 ? ((i * 3 + j) % 2 ? 1 : -1) : Math.sign(dy);
      if (ox / (a.w + b.w) < oy / (a.h + b.h)) { a.x -= sx * ox / 2; b.x += sx * ox / 2; }
      else { a.y -= sy * oy / 2; b.y += sy * oy / 2; }
    }
    const puxa = it < 350 ? 0.03 : 0;
    for (const p of ps) {
      p.x += (p.tx - p.x) * puxa; p.y += (p.ty - p.y) * puxa;
      p.y = Math.max(p.z0, Math.min(p.z1, p.y)); p.x = Math.max(M.l + p.w / 2, Math.min(W - M.r - p.w / 2, p.x));
    }
  }
  return ps;
}

/** SVG do mapa. `hoje` = {T, Td, chuva} (qualquer um pode faltar). */
export function mapaSVG(frascos, { vista = "td", hoje = {}, rotulos = "todos" } = {}) {
  const ps = posicoes(frascos, vista, rotulos), p = [];
  FX.forEach(([nome, a, b, cor], i) => {
    p.push(`<rect x="${f1(x(a))}" y="${M.t}" width="${f1(x(b) - x(a))}" height="${H - M.t - M.b}" class="mp-faixa${i % 2 ? "" : " par"}"/>`);
    p.push(`<circle cx="${f1((x(a) + x(b)) / 2 - 12)}" cy="22" r="5" fill="${cor}"/><text class="mp-fx" x="${f1((x(a) + x(b)) / 2 + 2)}" y="26">${nome}</text>`);
  });
  [7, 12, 17, 22, 27, 32, 37].forEach(t => p.push(`<text class="mp-ax" x="${f1(x(t))}" y="${H - M.b + 16}" text-anchor="middle">${t}°</text>`));
  if (vista === "td") {
    p.push(`<path class="mp-imposs" d="M${f1(x(TX[0]))},${f1(yTd(TX[0]))} ${[...Array(21)].map((_, k) => { const t = TX[0] + k; return `L${f1(x(t))},${f1(yTd(Math.min(26, t)))}`; }).join(" ")} L${f1(x(TX[0]))},${M.t} Z"/>`);
    [["C · ar carregado", 23], ["N · indiferente", 16], ["S · ar seco", 8]].forEach(([r, td]) => p.push(`<text class="mp-zona" x="${W - M.r - 4}" y="${f1(yTd(td))}" text-anchor="end">${r}</text>`));
    [20, 12].forEach(td => p.push(`<line class="mp-lim" x1="${M.l}" x2="${W - M.r}" y1="${f1(yTd(td))}" y2="${f1(yTd(td))}"/>`));
    [4, 8, 12, 16, 20, 24].forEach(td => p.push(`<text class="mp-ax" x="${M.l - 6}" y="${f1(yTd(td) + 4)}" text-anchor="end">${td}°</text>`));
  } else {
    [["gosta de chuva", 1.4], ["neutro", 0], ["pede sol", -1.4]].forEach(([r, v]) => p.push(`<text class="mp-zona" x="${W - M.r - 4}" y="${f1(yCh(v))}" text-anchor="end">${r}</text>`));
    p.push(`<line class="mp-lim" x1="${M.l}" x2="${W - M.r}" y1="${f1(yCh(0))}" y2="${f1(yCh(0))}"/>`);
  }
  if (Number.isFinite(hoje.T)) p.push(`<line class="mp-hoje" x1="${f1(x(hoje.T))}" x2="${f1(x(hoje.T))}" y1="${M.t}" y2="${H - M.b}"/><text class="mp-hoje-t" x="${f1(x(hoje.T) + 4)}" y="${M.t + 12}">hoje ${String(hoje.T).replace(".", ",")}°</text>`);
  if (vista === "td" && Number.isFinite(hoje.Td)) p.push(`<line class="mp-hoje" x1="${M.l}" x2="${W - M.r}" y1="${f1(yTd(hoje.Td))}" y2="${f1(yTd(hoje.Td))}"/><text class="mp-hoje-t" x="${M.l + 4}" y="${f1(yTd(hoje.Td) - 4)}">Td hoje ${String(hoje.Td).replace(".", ",")}°</text>`);
  for (const q of ps) {
    const cor = corArq(q.f.arquetipo), mostra = rotulos === "todos" || (rotulos === "S" && q.f.tier === "S");
    p.push(`<g class="mp-fr" data-ficha="${esc(q.f.nome)}" tabindex="0"><title>${esc(q.f.nome)} · ${esc(q.f.arquetipo)} · tier ${q.f.tier} · ideal ${f1(q.f.ideal).replace(".", ",")} °C</title>
      <circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${q.r}" fill="${cor}" stroke="${cor}"/>
      ${mostra ? `<text class="mp-rot" x="${f1(q.x)}" y="${f1(q.y + q.r + 10)}" text-anchor="middle">${esc(curto(q.f.nome))}</text>` : ""}</g>`);
  }
  return `<svg class="mapa-clima" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa clima da coleção">${p.join("")}</svg>`;
}

/** Tela: seletor de eixo vertical e de rótulos, o mapa e a legenda. */
export function telaMapa({ frascos, arquetipos = [], vista = "td", rotulos = "todos", hoje = {} }) {
  const grade = frascos.filter(f => f.camada === "grade" && f.tier !== "D");
  const seg = (attr, atual, ops) => `<div class="segmentos mf-ver" role="tablist">${ops.map(([v, r]) => `<button role="tab" data-${attr}="${v}" aria-selected="${atual === v}">${r}</button>`).join("")}</div>`;
  const usados = new Set(grade.map(f => f.arquetipo));
  return `<div class="bloco mapa-bloco">
    <p class="nota">${grade.length} frascos da grade pelo ponto térmico ideal (horizontal) e pelo ar que os favorece (vertical). Cor é o arquétipo, tamanho é o tier. Toque numa esfera para abrir a ficha. Camada custo fora do mapa.</p>
    ${seg("mapa-vista", vista, [["td", "Ponto de orvalho"], ["chuva", "Chuva"]])}
    ${seg("mapa-rot", rotulos, [["todos", "Todos os nomes"], ["S", "Só tier S"], ["nenhum", "Sem nomes"]])}
    <div class="mapa-rolar">${mapaSVG(grade, { vista, hoje, rotulos })}</div>
    <p class="mp-leg">${arquetipos.filter(a => usados.has(a.nome)).map(a => `<span><i style="background:${a.cor}"></i>${esc(a.nome)}</span>`).join("")}</p>
    <p class="nota">Ideal = centro do envelope da ficha, deslocado meia faixa para o frio por ponto de peso acima de 3 (a mesma centralidade do playbook). ${vista === "td" ? "A área hachurada é impossível: o ponto de orvalho nunca passa da temperatura." : "O índice de chuva é hipótese do Claude sobre a pirâmide, não dado medido."} As esferas se afastam o mínimo para não se sobrepor: a posição é aproximada; a ficha é o dado exato.</p>
  </div>`;
}
