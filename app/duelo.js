// duelo.js — “Qual dos dois?”: modos Agora (clima real) e Cenário (situação sorteada), pareamento justo, modelo de gosto
// por condição (Power Ranking, ajustado do log inteiro) e fila local dos duelos. Só leitura: não alimenta o motor, e os
// ratings nunca aparecem durante o duelo, para não viciar a escolha.
import { ler, gravar } from "./store.js";
import { chamar, configurado } from "./api.js";
import { daGrade } from "./estatisticas.js";
import { esc, tierHTML, ROT_OC } from "./util.js";
import { FAIXAS_CURTAS, OCASIOES, bandaTd } from "../engine/index.js";
import { arqTag } from "./icones.js";

const TIERS = ["S", "A", "B", "C"];
export const ELO_INICIAL = 1500, ELO_MIN_N = 5, ESCALA = 173.7;   // 173,7 = 400 / ln 10: a mesma escala do Elo
const chavePar = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// ───────────── dimensões do cenário ─────────────
export const PERIODOS = ["Manha", "Tarde", "Noite", "Madrugada"];
export const TDS = ["seco", "neutro", "carregado"];
export const CHUVAS = ["sem", "pancada", "continua"];
export const SUBS = {
  "Lazer": ["praia/piscina", "parque/caminhada", "shopping", "churrasco com amigos", "aeroporto e voo", "almoço de domingo em família"],
  "T.Inf": ["dia normal de escritório", "almoço de trabalho", "sala de reunião fechada"],
  "T.For": ["reunião com diretoria", "apresentação externa", "evento corporativo"],
  "N.Inf": ["bar/happy hour", "jantar casual", "cinema/teatro", "show"],
  "N.For": ["casamento", "jantar sofisticado a dois", "festa formal"],
  "Cozy D": ["home office", "domingo em casa"],
  "Cozy N": ["sofá e série", "pós-banho em casa"],
};
export const MAE_DA_SUB = Object.fromEntries(Object.entries(SUBS).flatMap(([m, l]) => l.map(s => [s, m])));
export const DIMS = ["temp", "td", "chuva", "periodo", "ocasiao"];   // β por valor; a sub-ocasião é o γ
export const VALORES = { temp: FAIXAS_CURTAS, td: TDS, chuva: CHUVAS, periodo: PERIODOS, ocasiao: OCASIOES, sub: Object.keys(MAE_DA_SUB) };
export const periodoDaHora = h => (h < 6 ? "Madrugada" : h < 12 ? "Manha" : h < 18 ? "Tarde" : "Noite");
const EMPATE = "=";

/** Linhas da aba Duelos (com cabeçalho) → duelos válidos, em ordem cronológica:
 *  {data, hora, a, b, vencedor ("=" = empate), contexto, modo, temp, td, chuva, periodo, ocasiao, sub}.
 *  Linha antiga (sem G–M): modo agora, temp tirada de “faixa N” do contexto, período pela hora, resto vazio. */
export function lerDuelos(rows) {
  if (!rows || rows.length < 2) return [];
  const t = v => String(v ?? "").trim();
  return rows.slice(1).map(r => {
    const d = { data: t(r[0]), hora: t(r[1]), a: t(r[2]), b: t(r[3]), vencedor: t(r[4]), contexto: String(r[5] || ""),
      modo: t(r[6]), temp: t(r[7]), td: t(r[8]), chuva: t(r[9]), periodo: t(r[10]), ocasiao: t(r[11]), sub: t(r[12]) };
    if (!d.modo) {
      d.modo = "agora";
      const fx = d.contexto.match(/faixa\s+(\d)/);
      if (!d.temp && fx) d.temp = FAIXAS_CURTAS[Number(fx[1])] || "";
      const h = parseInt(d.hora, 10);
      if (!d.periodo && Number.isFinite(h)) d.periodo = periodoDaHora(h);
    }
    for (const k of [...DIMS, "sub"]) if (d[k] && !VALORES[k].includes(d[k])) d[k] = "";
    if (d.sub && !d.ocasiao) d.ocasiao = MAE_DA_SUB[d.sub];
    return d;
  }).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.data) && d.a && d.b && d.a !== d.b && (d.vencedor === d.a || d.vencedor === d.b || d.vencedor === EMPATE))
    .sort(ordemDuelo);
}
const ordemDuelo = (x, y) => (x.data + x.hora < y.data + y.hora ? -1 : x.data + x.hora > y.data + y.hora ? 1 : 0);
const chaveDuelo = d => [d.data, d.hora, d.a, d.b].join("|");

/** Planilha + fila do aparelho ainda não confirmada, sem duplicar (chave Data|Hora|A|B). */
export function duelosUnificados(planilha, fila) {
  const vistos = new Set(planilha.map(chaveDuelo));
  return [...planilha, ...fila.filter(d => !vistos.has(chaveDuelo(d)))].sort(ordemDuelo);
}

// ───────────── gerador de cenário (plausível para SP) ─────────────
// Faixa → temperatura concreta (°C inteiros dentro da faixa do motor) e bandas de Td possíveis (Td ≤ T − 1).
const T_FAIXA = { MQ: [33, 37], Q: [27, 32], A: [22, 26], F: [17, 21], Fr: [12, 16], MF: [8, 11] };
const TD_BANDA = { seco: [6, 11], neutro: [12, 19], carregado: [20, 24] };   // SP: Td abaixo de ~6 °C é raro
const OC_DIA = ["T.Inf", "T.For", "Cozy D"], OC_NOITE = ["N.Inf", "N.For", "Cozy N"];
// horas plausíveis para usar perfume: 8 AM a 11 PM (Madrugada fica só para duelos do modo Agora feitos de madrugada)
const HORAS_CENARIO = { Manha: [8, 11], Tarde: [12, 17], Noite: [18, 23] };
/** 14 → “2 PM”; 8 → “8 AM”; 12 → “12 PM”. */
export const horaAmPm = h => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const DIAS_SEM = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Vetos do cenário (true = combinação plausível). */
export function cenarioValido(c) {
  if (c.periodo === "Madrugada" && ["MQ", "Q"].includes(c.temp)) return false;
  if ((c.periodo === "Manha" || c.periodo === "Noite") && c.temp === "MQ") return false;
  if (c.periodo === "Tarde" && c.temp === "MF") return false;
  if (c.chuva === "continua" && c.temp === "MQ") return false;
  const oc = c.ocasiao || MAE_DA_SUB[c.sub];
  if (OC_DIA.includes(oc) && !["Manha", "Tarde"].includes(c.periodo)) return false;
  if (OC_NOITE.includes(oc) && !["Noite", "Madrugada"].includes(c.periodo)) return false;
  if (oc === "Lazer" && c.periodo === "Madrugada") return false;
  if (c.sub === "praia/piscina" && (!["MQ", "Q", "A"].includes(c.temp) || c.chuva === "continua")) return false;
  if (c.sub && MAE_DA_SUB[c.sub] !== c.ocasiao) return false;
  if (c.T != null && c.Td != null && (c.Td > c.T - 1 || bandaTd(c.Td) !== c.td)) return false;
  if (c.hora != null && periodoDaHora(c.hora) !== c.periodo) return false;
  return true;
}

/** Contagem de duelos por valor de cada dimensão (para o gerador cobrir o que falta e para o “n do recorte”). */
function contarValores(duelos) {
  const n = {};
  for (const k of [...DIMS, "sub"]) n[k] = new Map();
  for (const d of duelos) for (const k of [...DIMS, "sub"]) if (d[k]) n[k].set(d[k], (n[k].get(d[k]) || 0) + 1);
  return n;
}
function sortearPeso(lista, peso, aleatorio) {
  const ws = lista.map(peso), tot = ws.reduce((a, b) => a + b, 0);
  let r = aleatorio() * tot;
  for (let i = 0; i < lista.length; i++) { r -= ws[i]; if (r <= 0) return lista[i]; }
  return lista[lista.length - 1];
}
const inteiroEntre = (a, b, aleatorio) => a + Math.min(b - a, Math.floor(aleatorio() * (b - a + 1)));

/** Sorteia um cenário (entre 8 AM e 11 PM): período → hora → faixa → T → Td (banda via bandaTd) → chuva → sub-ocasião (a mãe vem junto).
 *  Só valores que não caem num veto; entre eles, peso ∝ 1/√(1 + duelos já feitos com aquele valor). */
export function gerarCenario(duelos = [], aleatorio = Math.random) {
  const n = contarValores(duelos), w = k => v => 1 / Math.sqrt(1 + (n[k].get(v) || 0));
  const subsOk = c => Object.keys(MAE_DA_SUB).filter(s => cenarioValido({ ...c, sub: s, ocasiao: MAE_DA_SUB[s] }));
  const c = {};
  c.periodo = sortearPeso(Object.keys(HORAS_CENARIO), w("periodo"), aleatorio);
  const [h0, h1] = HORAS_CENARIO[c.periodo];
  c.hora = inteiroEntre(h0, h1, aleatorio);
  c.temp = sortearPeso(FAIXAS_CURTAS.filter(t => cenarioValido({ periodo: c.periodo, temp: t })), w("temp"), aleatorio);
  c.T = inteiroEntre(...T_FAIXA[c.temp], aleatorio);
  c.td = sortearPeso(TDS.filter(b => TD_BANDA[b][0] <= c.T - 1), w("td"), aleatorio);
  c.Td = inteiroEntre(TD_BANDA[c.td][0], Math.min(TD_BANDA[c.td][1], c.T - 1), aleatorio);
  c.chuva = sortearPeso(CHUVAS.filter(ch => cenarioValido({ periodo: c.periodo, temp: c.temp, chuva: ch }) && subsOk({ ...c, chuva: ch }).length), w("chuva"), aleatorio);
  c.sub = sortearPeso(subsOk(c), w("sub"), aleatorio);
  c.ocasiao = MAE_DA_SUB[c.sub];
  const util = ["T.Inf", "T.For"].includes(c.ocasiao), domingo = /domingo/.test(c.sub);
  c.dia = domingo ? 0 : util ? inteiroEntre(1, 5, aleatorio) : inteiroEntre(0, 6, aleatorio);
  return c;
}

/** “Quinta, 2 PM · 29°C · abafado (Td 21) · pancada de chuva · almoço de trabalho” */
export function textoCenario(c) {
  const ar = { carregado: "abafado", neutro: "ar normal", seco: "ar seco" }[c.td];
  const chuva = { sem: "sem chuva", pancada: "pancada de chuva", continua: "chuva contínua" }[c.chuva];
  return `${DIAS_SEM[c.dia ?? 3]}, ${horaAmPm(c.hora)} · ${c.T}°C · ${ar} (Td ${c.Td}) · ${chuva} · ${c.sub}`;
}

// ───────────── modelo: Bradley–Terry com efeitos por condição (MAP, em lote) ─────────────
// score(f, s) = θ[f] + Σ_d β[f][d][s.d] + γ[f][s.sub]; P(A vence B) = σ(score A − score B); empate = 0,5.
// Priors normais de média 0: θ σ 1,5 · β σ 0,5 · γ σ 0,35. Gradiente ascendente a partir de 0, lr 0,05 (limitado a
// 1/curvatura de cada parâmetro, para não divergir com frascos muito duelados), até max|grad| < 1e-5 ou 2000 iterações.
const PREC = { t: 1 / 1.5 ** 2, b: 1 / 0.5 ** 2, g: 1 / 0.35 ** 2 };
const sig = x => 1 / (1 + Math.exp(-x));
const memo = new Map();   // poucos logs diferentes por tela (hoje e “há 7 dias”, início e fim do mês): guarda os 4 últimos

/** Ajusta o modelo ao log inteiro. Devolve {theta, beta, gamma, n, vitorias, cont} (Maps por frasco) e score(nome, s). */
export function ajustar(duelos) {
  const ord = [...duelos].sort((x, y) => (chaveDuelo(x) + x.vencedor < chaveDuelo(y) + y.vencedor ? -1 : 1));   // ordem fixa: mesma soma
  const chave = `${ord.length}|${ord.length ? chaveDuelo(ord[ord.length - 1]) + ord[ord.length - 1].vencedor : ""}`;
  if (memo.has(chave)) return memo.get(chave);
  // índice dos parâmetros
  const idx = new Map(), tipo = [];
  const id = (k, t) => { if (!idx.has(k)) { idx.set(k, tipo.length); tipo.push(t); } return idx.get(k); };
  const n = new Map(), vit = new Map(), cont = new Map();
  const conta = (f, k, v) => { if (!cont.has(f)) cont.set(f, {}); const c = cont.get(f); c[k] = c[k] || new Map(); c[k].set(v, (c[k].get(v) || 0) + 1); };
  const linhas = ord.map(d => {
    const ps = f => {
      const l = [id(`t|${f}`, "t")];
      for (const k of DIMS) if (d[k]) { l.push(id(`b|${f}|${k}|${d[k]}`, "b")); conta(f, k, d[k]); }
      if (d.sub) { l.push(id(`g|${f}|${d.sub}`, "g")); conta(f, "sub", d.sub); }
      return l;
    };
    for (const f of [d.a, d.b]) n.set(f, (n.get(f) || 0) + 1);
    if (d.vencedor !== EMPATE) vit.set(d.vencedor, (vit.get(d.vencedor) || 0) + 1);
    return { pa: ps(d.a), pb: ps(d.b), y: d.vencedor === EMPATE ? 0.5 : d.vencedor === d.a ? 1 : 0 };
  });
  const P = tipo.length, w = new Float64Array(P), g = new Float64Array(P), passo = new Float64Array(P);
  // curvatura (cota de Gershgorin): prior + 0,25 × parâmetros do duelo, somado em cada duelo em que o parâmetro entra
  const curv = Float64Array.from(tipo, t => PREC[t]);
  for (const l of linhas) { const k = 0.25 * (l.pa.length + l.pb.length); for (const p of l.pa) curv[p] += k; for (const p of l.pb) curv[p] += k; }
  for (let p = 0; p < P; p++) passo[p] = Math.min(0.05, 1 / curv[p]);
  for (let it = 0; it < 2000; it++) {
    for (let p = 0; p < P; p++) g[p] = -PREC[tipo[p]] * w[p];
    for (const l of linhas) {
      let sa = 0, sb = 0;
      for (const p of l.pa) sa += w[p];
      for (const p of l.pb) sb += w[p];
      const r = l.y - sig(sa - sb);
      for (const p of l.pa) g[p] += r;
      for (const p of l.pb) g[p] -= r;
    }
    let mx = 0;
    for (let p = 0; p < P; p++) { const a = Math.abs(g[p]); if (a > mx) mx = a; }
    if (mx < 1e-5) break;
    for (let p = 0; p < P; p++) w[p] += passo[p] * g[p];
  }
  const val = k => (idx.has(k) ? w[idx.get(k)] : 0);
  const modelo = {
    n, vitorias: vit, cont,
    theta: f => val(`t|${f}`),
    beta: (f, k, v) => val(`b|${f}|${k}|${v}`),
    gamma: (f, s) => val(`g|${f}|${s}`),
    /** score num recorte/cenário: só as dimensões preenchidas entram */
    score(f, s = {}) {
      let x = val(`t|${f}`);
      for (const k of DIMS) if (s[k]) x += val(`b|${f}|${k}|${s[k]}`);
      if (s.sub) x += val(`g|${f}|${s.sub}`);
      return x;
    },
  };
  memo.set(chave, modelo);
  if (memo.size > 4) memo.delete(memo.keys().next().value);
  return modelo;
}
export const rating = x => ELO_INICIAL + ESCALA * x;

/** Compatibilidade: “Elo” geral (sem filtro) = 1500 + 173,7 θ. Map nome → {rating, n, vitorias} (todos os frascos). */
export function elo(duelos, frascos = []) {
  const m = ajustar(duelos), out = new Map();
  for (const nome of new Set([...frascos.map(f => f.nome), ...m.n.keys()]))
    out.set(nome, { rating: rating(m.theta(nome)), n: m.n.get(nome) || 0, vitorias: m.vitorias.get(nome) || 0 });
  return out;
}

/** n do recorte: o mínimo, entre as dimensões filtradas, de duelos do frasco com aquele valor (sem filtro: n total). */
function nRecorte(m, nome, filtro) {
  const ks = Object.keys(filtro).filter(k => filtro[k]);
  if (!ks.length) return m.n.get(nome) || 0;
  return Math.min(...ks.map(k => m.cont.get(nome)?.[k]?.get(filtro[k]) || 0));
}

/** Power Ranking da grade num recorte (filtro {temp, td, chuva, periodo, ocasiao, sub}; vazio = Geral).
 *  [{nome, f, rating, delta_vs_geral, n_recorte}] do maior para o menor. */
export function powerRanking(duelos, frascos, filtro = {}) {
  const m = ajustar(duelos);
  return frascos.filter(daGrade).map(f => {
    const geral = m.theta(f.nome), aqui = m.score(f.nome, filtro);
    return { nome: f.nome, f, rating: rating(aqui), delta_vs_geral: ESCALA * (aqui - geral), n_recorte: nRecorte(m, f.nome, filtro) };
  }).sort((a, b) => b.rating - a.rating || a.nome.localeCompare(b.nome, "pt"));
}

/** Onde o frasco brilha / cai: valores de dimensão com n ≥ 3, pelo efeito (β ou γ) em pontos de rating. */
export function brilhaCai(duelos, nome, min = 3) {
  const m = ajustar(duelos), c = m.cont.get(nome) || {}, itens = [];
  for (const k of [...DIMS, "sub"]) for (const [v, q] of c[k] || []) if (q >= min)
    itens.push({ k, v, n: q, efeito: ESCALA * (k === "sub" ? m.gamma(nome, v) : m.beta(nome, k, v)) });
  itens.sort((a, b) => b.efeito - a.efeito);
  return { brilha: itens.filter(x => x.efeito > 0).slice(0, 2), cai: itens.filter(x => x.efeito < 0).slice(-2).reverse() };
}

/** Rótulo humano de um valor de dimensão: “no calor”, “à noite”, “na chuva”, “em almoço de trabalho”. */
export function rotuloValor(k, v) {
  if (k === "temp") return { MQ: "no calor forte", Q: "no calor", A: "no ameno", F: "no fresco", Fr: "no frio", MF: "no frio forte" }[v];
  if (k === "td") return { seco: "no ar seco", neutro: "no ar normal", carregado: "no abafado" }[v];
  if (k === "chuva") return { sem: "sem chuva", pancada: "com pancada de chuva", continua: "na chuva contínua" }[v];
  if (k === "periodo") return { Manha: "de manhã", Tarde: "à tarde", Noite: "à noite", Madrugada: "de madrugada" }[v];
  if (k === "ocasiao") return `em ${ROT_OC[v] || v}`;
  return `em ${v}`;
}

/** Próximo par [A, B]. Candidatos: frascos da grade (já sem os que não são “Frasco Gui”, via aplicarTiers).
 *  Custo do par = 3 × duelos entre os dois + 2 × (prioridade − 1) + 0,25 × duelos de cada um; prioridade 1 = mesmo
 *  arquétipo e mesmo tier, 2 = mesmo arquétipo e tiers vizinhos, 3 = qualquer par. No modo Cenário, + 1,5 × |p̂ − 0,5|
 *  (p̂ = chance prevista de A vencer B naquele cenário): prefere pares de resultado incerto. Empate: sorteio. */
export function pareamento(frascos, duelos = [], aleatorio = Math.random, cenario = null) {
  const fs = frascos.filter(daGrade).filter(f => TIERS.includes(f.tier));
  if (fs.length < 2) return null;
  const nDe = new Map(), nPar = new Map();
  for (const d of duelos) {
    nDe.set(d.a, (nDe.get(d.a) || 0) + 1); nDe.set(d.b, (nDe.get(d.b) || 0) + 1);
    const k = chavePar(d.a, d.b); nPar.set(k, (nPar.get(k) || 0) + 1);
  }
  const m = cenario ? ajustar(duelos) : null, sc = m && new Map(fs.map(f => [f.nome, m.score(f.nome, cenario)]));
  let melhor = Infinity, empates = [];
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    const a = fs[i], b = fs[j];
    const mesmoArq = a.arquetipo === b.arquetipo, dt = Math.abs(TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
    const prio = mesmoArq && dt === 0 ? 1 : mesmoArq && dt === 1 ? 2 : 3;
    let custo = 3 * (nPar.get(chavePar(a.nome, b.nome)) || 0) + 2 * (prio - 1) + 0.25 * ((nDe.get(a.nome) || 0) + (nDe.get(b.nome) || 0));
    if (sc) custo += 1.5 * Math.abs(sig(sc.get(a.nome) - sc.get(b.nome)) - 0.5);
    if (custo < melhor - 1e-9) { melhor = custo; empates = [[a, b]]; }
    else if (Math.abs(custo - melhor) < 1e-9) empates.push([a, b]);
  }
  const par = empates[Math.min(empates.length - 1, Math.floor(aleatorio() * empates.length))];
  return aleatorio() < 0.5 ? par : [par[1], par[0]];
}

// ───────────── diversão: previsão, movimento na semana, títulos ─────────────
/** Chance prevista de A vencer B na situação s (cenário ou condições de agora), antes de gravar a escolha. */
export function previsao(duelos, a, b, s = {}) {
  const m = ajustar(duelos);
  return { p: sig(m.score(a, s) - m.score(b, s)), nA: m.n.get(a) || 0, nB: m.n.get(b) || 0 };
}
/** Zebra: o escolhido tinha ≤ 30 % de chance pelo modelo, e os dois já tinham 3+ duelos (senão é chute do modelo). */
export const ehZebra = (pr, venceuA) => pr.nA >= 3 && pr.nB >= 3 && (venceuA ? pr.p : 1 - pr.p) <= 0.3;

/** Posições no Geral hoje × há 7 dias (só frascos com duelo). Map nome → {pos, antes, sobe} (sobe > 0 = subiu). */
export function movimentoSemana(duelos, frascos, hoje) {
  const d7 = new Date(hoje + "T12:00:00Z"); d7.setUTCDate(d7.getUTCDate() - 7);
  const corte = d7.toISOString().slice(0, 10);
  const antigos = duelos.filter(d => d.data <= corte);
  const pos = ds => new Map(powerRanking(ds, frascos).filter(x => ajustar(ds).n.get(x.nome)).map((x, i) => [x.nome, i + 1]));
  const agora = pos(duelos), antes = antigos.length ? pos(antigos) : new Map();
  return new Map([...agora].map(([nome, p]) => [nome, { pos: p, antes: antes.get(nome) ?? null, sobe: antes.has(nome) ? antes.get(nome) - p : null }]));
}

// títulos por condição: quem mais sobe naquele valor (β ou γ, n ≥ 3, efeito ≥ 15 pontos)
const TITULOS = {
  temp: { MQ: "☀️ Rei do sol", Q: "🏖️ Dono do verão", A: "🌤️ Senhor do meio-termo", F: "🍃 Craque do fresco", Fr: "🧣 Lorde do frio", MF: "🐻‍❄️ Urso polar" },
  td: { seco: "🏜️ Mestre do ar seco", neutro: "⚖️ Equilibrista", carregado: "🌫️ Domador do abafado" },
  chuva: { sem: "😎 Céu limpo", pancada: "⛈️ Caçador de pancada", continua: "☂️ Guarda-chuva oficial" },
  periodo: { Manha: "🌅 Madrugador", Tarde: "🕒 Rei da tarde", Noite: "🌙 Lobo da noite", Madrugada: "🦉 Coruja" },
};
export function tituloDe(k, v) {
  if (TITULOS[k]?.[v]) return TITULOS[k][v];
  return k === "ocasiao" ? `🎯 Craque em ${ROT_OC[v] || v}` : `🎯 Craque em ${v}`;
}
/** Títulos do Ranking: para cada valor de dimensão, o frasco da grade que mais sobe nele. [{k, v, titulo, nome, efeito, n}] */
export function titulos(duelos, frascos, min = 3) {
  const m = ajustar(duelos), out = [];
  for (const k of [...DIMS, "sub"]) for (const v of VALORES[k]) {
    let melhor = null;
    for (const f of frascos.filter(daGrade)) {
      const n = m.cont.get(f.nome)?.[k]?.get(v) || 0;
      if (n < min) continue;
      const efeito = ESCALA * (k === "sub" ? m.gamma(f.nome, v) : m.beta(f.nome, k, v));
      if (efeito >= 15 && (!melhor || efeito > melhor.efeito)) melhor = { k, v, titulo: tituloDe(k, v), nome: f.nome, efeito, n };
    }
    if (melhor) out.push(melhor);
  }
  return out.sort((a, b) => b.efeito - a.efeito);
}

/** Cara do cenário: emoji e tom de fundo pela temperatura/chuva/período. */
export function climaCenario(c) {
  const emoji = c.chuva === "continua" ? "🌧️" : c.chuva === "pancada" ? "⛈️" : c.periodo === "Noite" ? "🌙" : ["MQ", "Q"].includes(c.temp) ? "☀️" : ["Fr", "MF"].includes(c.temp) ? "🥶" : "⛅";
  const tom = { MQ: "quente", Q: "quente", A: "ameno", F: "fresco", Fr: "frio", MF: "frio" }[c.temp] || "ameno";
  return { emoji, tom: c.periodo === "Noite" ? `${tom} noite` : tom };
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
    const j = await chamar("duelo_registrar", { linhas: fila.map(({ id, data, hora, a, b, vencedor, contexto, modo, temp, td, chuva, periodo, ocasiao, sub }) =>
      ({ id, data, hora, a, b, vencedor, contexto, modo: modo || "agora", temp: temp || "", td: td || "", chuva: chuva || "", periodo: periodo || "", ocasiao: ocasiao || "", sub: sub || "" })) });
    const ok = new Set(j.gravadas.map(g => g.id));
    gravar("duelosFila", filaDuelos().filter(d => !ok.has(d.id)));
    return { enviados: ok.size };
  } catch (e) {
    return { enviados: 0, erro: e.message, rede: e.codigo === "rede" };
  }
}

// ───────────── telas ─────────────

/** Tela do Duelo (Coleção › Duelo). par = [fA, fB]; foto(f) = HTML da foto/ícone; nHoje = duelos de hoje;
 *  modo "agora" | "cenario"; cenario = situação sorteada (card acima dos frascos). Nenhum rating aparece aqui. */
export const META_DIA = 10;
export function telaDuelo({ par, foto, nHoje, modo = "agora", cenario = null, seguidos = 0, reacao = "" }) {
  const alterna = `<div class="segmentos duelo-modo" role="tablist" aria-label="Modo do duelo">${[["agora", "Agora"], ["cenario", "Cenário"]].map(([v, r]) =>
    `<button role="tab" data-duelo-modo="${v}" aria-selected="${modo === v}">${r}</button>`).join("")}</div>`;
  if (!par) return `<h2>Duelo</h2>${alterna}<div class="bloco"><p class="vazio">Precisa de pelo menos dois frascos da grade.</p></div>`;
  const card = (f, i) => `<button class="duelo-card" data-duelo-vence="${i}" aria-label="Prefiro ${esc(f.nome)}">
      ${foto(f)}<span class="dc-tx"><b>${esc(f.nome)}</b>${tierHTML(f.tier)}<span class="casa">${esc(f.casa)}</span><span class="casa">${arqTag(f.arquetipo, 14)}</span></span></button>`;
  const cen = modo === "cenario" && cenario, cc = cen && climaCenario(cenario);
  const meta = Math.min(nHoje, META_DIA), bateu = nHoje >= META_DIA;
  return `<h2>Duelo</h2>
  ${alterna}
  <p class="nota">${cen ? "Imagine a situação abaixo: qual dos dois você usaria nela?" : "Qual dos dois você usaria agora, com o clima de hoje?"} Cada escolha vai para a aba Duelos da planilha e alimenta o Power Ranking (Coleção › Ranking; nunca aparece aqui).</p>
  <div class="duelo-placar">
    <span class="meta-dia ${bateu ? "ok" : ""}" title="Meta do dia"><span class="trilho"><span style="width:${(meta / META_DIA) * 100}%"></span></span>${bateu ? "🏆" : "🎯"} ${nHoje}/${META_DIA} hoje</span>
    ${seguidos >= 2 ? `<span class="seguidos ${seguidos >= 10 ? "quente" : ""}">🔥 ${seguidos} seguidos</span>` : ""}
  </div>
  ${reacao ? `<p class="duelo-reacao" role="status">${esc(reacao)}</p>` : ""}
  ${cen ? `<div class="cenario-card tom-${cc.tom.replace(" ", " tom-")}"><span class="cen-emoji" aria-hidden="true">${cc.emoji}</span><div><span class="cen-rot">Cenário</span><p>${esc(textoCenario(cenario))}</p></div></div>` : ""}
  <div class="duelo">${card(par[0], 0)}<span class="duelo-ou"><span class="vs">VS</span></span>${card(par[1], 1)}</div>
  <div class="linha-flex duelo-acoes"><button class="btn sec peq" data-acao="duelo-empate">🤷 Tanto faz</button><button class="btn sec peq" data-acao="duelo-pular">Pular par</button>${cen ? `<button class="btn sec peq" data-acao="duelo-cenario">🎲 Outro cenário</button>` : ""}</div>`;
}

const ROT_DIM = { temp: "Temperatura", td: "Umidade", chuva: "Chuva", periodo: "Período", ocasiao: "Ocasião", sub: "Situação" };
const ROT_VAL = { seco: "seco", neutro: "normal", carregado: "abafado", sem: "sem chuva", pancada: "pancada", continua: "contínua",
  Manha: "Manhã", Tarde: "Tarde", Noite: "Noite", Madrugada: "Madrugada" };
const rotChip = (k, v) => (k === "ocasiao" ? ROT_OC[v] || v : ROT_VAL[v] || v);

/** Coleção › Ranking: chips por dimensão (um valor por dimensão; sem chip = Geral), lista da grade e especialistas. */
export function telaRanking({ duelos, frascos, filtro = {}, hoje = "", arqIcone = () => "" }) {
  const ativo = Object.keys(filtro).filter(k => filtro[k]);
  const subs = filtro.ocasiao ? SUBS[filtro.ocasiao] : Object.keys(MAE_DA_SUB);
  const chips = k => `<div class="rk-dim"><span class="rot">${ROT_DIM[k]}</span><div class="chips rolagem">${(k === "sub" ? subs : VALORES[k]).map(v =>
    `<button class="chip" data-rk-dim="${k}" data-rk-val="${esc(v)}" aria-pressed="${filtro[k] === v}">${esc(rotChip(k, v))}</button>`).join("")}</div></div>`;
  const lista = powerRanking(duelos, frascos, filtro);
  const reais = duelos.filter(d => d.modo !== "cenario").length;
  const desde = x => (x.n_recorte >= 3 ? (Math.abs(x.delta_vs_geral) < 0.5 ? `<span class="nota">=</span>` : `<span class="rk-delta ${x.delta_vs_geral > 0 ? "sobe" : "cai"}">${x.delta_vs_geral > 0 ? "↑" : "↓"}${Math.round(Math.abs(x.delta_vs_geral))}</span>`) : `<span class="selo aviso">poucos dados</span>`);
  const recorte = ativo.map(k => rotuloValor(k, filtro[k])).join(" · ");
  const esp = ativo.length ? lista.filter(x => x.n_recorte >= 3) : [];
  const sobe = [...esp].filter(x => x.delta_vs_geral > 0.5).sort((a, b) => b.delta_vs_geral - a.delta_vs_geral).slice(0, 3);
  const cai = [...esp].filter(x => x.delta_vs_geral < -0.5).sort((a, b) => a.delta_vs_geral - b.delta_vs_geral).slice(0, 3);
  const mov = !ativo.length && hoje ? movimentoSemana(duelos, frascos, hoje) : new Map();
  const seta = x => { const mv = mov.get(x.nome); return mv?.sobe ? `<span class="rk-mov ${mv.sobe > 0 ? "sobe" : "cai"}" title="na semana">${mv.sobe > 0 ? "▲" : "▼"}${Math.abs(mv.sobe)}</span>` : mv && mv.antes == null ? `<span class="rk-mov novo" title="novo na semana">novo</span>` : ""; };
  const comDuelo = lista.filter(x => x.n_recorte > 0 || !ativo.length && x.rating !== 1500);
  const podio = duelos.length && comDuelo.length >= 3 ? `<div class="podio">${[1, 0, 2].map(i => { const x = comDuelo[i];
    return `<button class="podio-lugar p${i + 1}" data-ficha="${esc(x.nome)}"><span class="medalha">${["🥇", "🥈", "🥉"][i]}</span>${arqIcone(x.f.arquetipo, 30)}<b>${esc(x.nome)}</b><span class="nota">${fmtElo(x.rating)}</span><span class="degrau">${i + 1}</span></button>`; }).join("")}</div>` : "";
  const tts = !ativo.length ? titulos(duelos, frascos) : [];
  const itemEsp = (x, verbo) => `<li><button class="nome-inline" data-ficha="${esc(x.nome)}">${esc(x.nome)}</button> ${tierHTML(x.f.tier)} · ${verbo} ${esc(recorte)} <b>${x.delta_vs_geral > 0 ? "+" : "−"}${Math.round(Math.abs(x.delta_vs_geral))}</b></li>`;
  return `<h2>Ranking</h2>
  ${podio}
  <details class="bloco rk-filtros" ${ativo.length ? "open" : ""}><summary>${ativo.length ? `Recorte: ${esc(recorte)}` : "Filtrar por condição"}</summary>
    <p class="nota">${ativo.length ? `<button class="btn sec peq" data-acao="rk-limpar">Voltar ao Geral</button>` : "Toque num valor para ver o ranking naquela condição; toque de novo para limpar."}</p>
    ${["temp", "td", "chuva", "periodo", "ocasiao", "sub"].map(chips).join("")}</details>
  ${tts.length ? `<div class="bloco"><h3>Títulos</h3><div class="titulos">${tts.slice(0, 8).map(t => `<button class="titulo" data-ficha="${esc(t.nome)}"><span>${esc(t.titulo)}</span><b>${esc(t.nome)}</b><span class="nota">+${Math.round(t.efeito)} · ${t.n} duelos</span></button>`).join("")}</div></div>` : ""}
  ${sobe.length || cai.length ? `<div class="bloco"><h3>Especialistas</h3><ul class="elo-lista">${sobe.map(x => itemEsp(x, "Sobe")).join("")}${cai.map(x => itemEsp(x, "Cai")).join("")}</ul></div>` : ""}
  <div class="bloco"><ol class="rk-lista">${lista.map((x, i) => `<li><span class="rk-pos">${i + 1}</span>
      <button class="nome-inline" data-ficha="${esc(x.nome)}">${esc(x.nome)}</button>${tierHTML(x.f.tier)}<span class="esp"></span>
      ${ativo.length ? desde(x) : seta(x)}<b class="rk-r">${fmtElo(x.rating)}</b><span class="nota rk-n">${x.n_recorte}</span></li>`).join("")}</ol>
    <p class="nota">${duelos.length} duelo${duelos.length === 1 ? "" : "s"}, ${duelos.length ? Math.round(100 * reais / duelos.length) : 0}% reais (modo Agora). Rating 1 500 = neutro; n = duelos do frasco ${ativo.length ? "no recorte (o menor entre os valores escolhidos)" : "no total"}; ↑↓ vs Geral só com n ≥ 3.</p></div>`;
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
