// estatisticas.js — contas do Histórico, Coleção e calibração de sprays. Só dados do Diário: nada projetado.
// A camada custo fica fora de toda estatística (regra dele); Bedouin Rose (D) fica fora da grade.
import { diasEntre, faixaIdx, OCASIOES } from "../engine/index.js";
import { ROT_OC } from "./util.js";
import { materialDoDia } from "./diversao.js";

/** Só Dia (M) e Noite (N), sem a 2ª aplicação: vale para a rotação do motor, o calendário (uma cor por slot) e a resposta
 *  “vivo/fraco/morto”. Para medir USO (último uso, esquecidos, NotaDia, Wrapped…) use ehUso, que inclui M2/N2. */
export const deAnalise = r => r.slot === "M" || r.slot === "N";

export const daGrade = f => f.camada === "grade" && f.tier !== "D";

/** É uso do frasco (para último uso, esquecidos, “sem uso”, contagens da Coleção): Dia e Noite, inclusive a 2ª aplicação
 *  (M2/N2). Esportes (E) fica fora — é da camada custo. As demais análises (NotaDia, slots, rotação) seguem só M/N. */
export const ehUso = r => r.slot === "M" || r.slot === "N" || r.slot === "M2" || r.slot === "N2";

/** Janelas de cada frasco no playbook: [{faixa, faixaIdx, ocasiao, papel}] */
export function janelasPorFrasco(playbook) {
  const m = new Map();
  if (!playbook) return m;
  playbook.faixas.forEach((faixa, fi) => {
    const cel = playbook.grade[faixa].celulas;
    for (const [oc, c] of Object.entries(cel)) {
      const add = (nome, papel) => { if (!nome) return; if (!m.has(nome)) m.set(nome, []); m.get(nome).push({ faixa, faixaIdx: fi, ocasiao: oc, papel }); };
      add(c.seguro, "Seguro"); add(c.jogada, "Jogada"); (c.tambem || []).forEach(n => add(n, "Também"));
    }
  });
  return m;
}

/** Contagens por frasco da grade a partir do histórico (planilha + fila). `todos`: inclui camada custo e fora da grade
 *  (só para a lista da Coleção; análises e estatísticas seguem só com a grade). */
export function contagens(hist, frascos, hoje, { todos = false } = {}) {
  const grade = todos ? frascos : frascos.filter(daGrade);
  const nomes = new Set(grade.map(f => f.nome));
  hist = hist.filter(ehUso);   // 2ª aplicação também é uso (antes ficava fora e o frasco aparecia “sem uso”)
  const regs = hist.filter(r => nomes.has(r.perfume) && r.data <= hoje);
  const por = new Map(grade.map(f => [f.nome, { f, n: 0, n30: 0, M: 0, N: 0, ultimo: null }]));
  for (const r of regs) {
    const c = por.get(r.perfume);
    c.n++; if (diasEntre(hoje, r.data) < 30) c.n30++;
    if (r.slot[0] === "M") c.M++; else c.N++;
    if (!c.ultimo || r.data > c.ultimo) c.ultimo = r.data;
  }
  for (const c of por.values()) c.dias = c.ultimo ? diasEntre(hoje, c.ultimo) : null;
  const primeiro = hist.reduce((m, r) => (!m || r.data < m ? r.data : m), null);
  return { por, total: regs.length, cobertura: primeiro ? diasEntre(hoje, primeiro) + 1 : 0, primeiro,
    foraDaGrade: hist.filter(r => !nomes.has(r.perfume) && r.data <= hoje).length };
}

export function agrupar(por, chave) {
  const m = new Map();
  for (const c of por.values()) { const k = chave(c.f); m.set(k, (m.get(k) || 0) + c.n); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Esquecidos: frascos da grade sem uso há ≥ limite dias, ou sem registro no diário. */
export function esquecidos(por, limite = 45) {
  return [...por.values()].filter(c => c.dias === null || c.dias >= limite)
    .sort((a, b) => "SABC".indexOf(a.f.tier) - "SABC".indexOf(b.f.tier) || (b.dias ?? 1e9) - (a.dias ?? 1e9) || a.f.nome.localeCompare(b.f.nome));
}

/** Semana ISO da data (AAAA-MM-DD) → "AAAA-Www" (segunda a domingo; a semana 1 tem a 1ª quinta do ano). */
export function semanaISO(iso) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);   // quinta da mesma semana decide o ano
  const ano = d.getUTCFullYear(), jan4 = new Date(Date.UTC(ano, 0, 4, 12));
  const sem = 1 + Math.round((d - jan4) / 864e5 / 7 + ((jan4.getUTCDay() + 6) % 7 - 3) / 7);
  return `${ano}-W${String(sem).padStart(2, "0")}`;
}

/** Esquecido da semana (raspadinha do Histórico). `esq` = esquecidos(…); `so` = slot da hora de hoje (rodar()).
 *  Entre os esquecidos que passam nos filtros de hoje (fora de so.fora e no ranking), o de maior score; se nenhum
 *  serve, o esquecido há mais tempo (sem registro conta como o mais antigo), marcado usavel: false. Sem esquecidos → null. */
export function esquecidoDaSemana(esq, so, semana) {
  if (!esq?.length) return null;
  const score = new Map((so?.ranking || []).map(x => [x.nome, x.score]));
  const usaveis = esq.filter(c => !so?.fora?.[c.f.nome] && score.has(c.f.nome))
    .sort((a, b) => score.get(b.f.nome) - score.get(a.f.nome) || a.f.nome.localeCompare(b.f.nome, "pt"));
  if (usaveis.length) { const c = usaveis[0]; return { nome: c.f.nome, dias: c.dias, score: score.get(c.f.nome), usavel: true, semana }; }
  const c = [...esq].sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity) || a.f.nome.localeCompare(b.f.nome, "pt"))[0];
  return { nome: c.f.nome, dias: c.dias, score: null, usavel: false, semana };
}

/** Uso × janelas: participação de cada frasco nos usos vs. participação nas janelas do playbook (668 desde 23/out/2026, playbook v60). */
export function usoVsJanelas(por) {
  const totJ = [...por.values()].reduce((s, c) => s + (c.f.janelas || 0), 0);
  const totU = [...por.values()].reduce((s, c) => s + c.n, 0);
  return [...por.values()].map(c => ({ nome: c.f.nome, tier: c.f.tier, janelas: c.f.janelas || 0, usos: c.n,
    pJ: totJ ? c.f.janelas / totJ : 0, pU: totU ? c.n / totU : 0, esperado: totJ ? totU * (c.f.janelas || 0) / totJ : 0 }))
    .map(x => ({ ...x, desvio: x.usos - x.esperado }));
}

/** Calibração: desvio real − sugerido. Recebe o histórico unificado (planilha + fila do aparelho) — pode vir com o mesmo
 *  registro duas vezes (linha da planilha e cópia local): deduplica por data|slot|perfume, ficando com a versão que tem
 *  sugerido. Só pares com sprays e sugerido numéricos; descartados e conflitos não contam. */
export function calibracao(regs) {
  const num = v => (v === "" || v == null ? NaN : Number(String(v).replace(",", ".")));
  const porChave = new Map();
  for (const r of regs) {
    if (r.estado === "descartado" || r.estado === "conflito") continue;
    const k = `${r.data}|${r.slot}|${r.perfume}`, ja = porChave.get(k);
    if (!ja || (!Number.isFinite(num(ja.sugerido)) && Number.isFinite(num(r.sugerido)))) porChave.set(k, r);
  }
  const pares = [...porChave.values()].map(r => ({ nome: r.perfume, real: num(r.sprays), sug: num(r.sugerido) }))
    .filter(p => Number.isFinite(p.real) && Number.isFinite(p.sug));
  const media = a => a.reduce((s, x) => s + x, 0) / a.length;
  const por = new Map();
  for (const p of pares) { if (!por.has(p.nome)) por.set(p.nome, []); por.get(p.nome).push(p.real - p.sug); }
  return { n: pares.length, geral: pares.length ? media(pares.map(p => p.real - p.sug)) : null,
    por: [...por.entries()].map(([nome, d]) => ({ nome, n: d.length, media: media(d) })).sort((a, b) => b.media - a.media || b.n - a.n) };
}

/** NotaDia (fit do slot, 1–5) como número; aceita vírgula. Fora de 1–5 (notas antigas em outra escala) não entra na conta. */
export function notaNum(v) {
  const n = v === "" || v == null ? NaN : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** NotaDia por frasco da grade: média geral, n e média por faixa de temperatura (pela Temp do registro; sem Temp entra
 *  só na média geral). Dia e Noite, inclusive 2ª aplicação (ehUso). Devolve Map nome → {f, n, media, faixas: Map idx → {n, media}}. */
export function notaPorFrascoFaixa(hist, frascos) {
  const grade = new Map(frascos.filter(daGrade).map(f => [f.nome, f]));
  const acc = new Map();
  for (const r of hist) {
    if (!ehUso(r) || !grade.has(r.perfume)) continue;
    const nota = notaNum(r.notaDia);
    if (nota == null) continue;
    if (!acc.has(r.perfume)) acc.set(r.perfume, { f: grade.get(r.perfume), soma: 0, n: 0, faixas: new Map() });
    const a = acc.get(r.perfume); a.soma += nota; a.n++;
    const t = r.temp === "" || r.temp == null ? NaN : Number(String(r.temp).replace(",", "."));
    if (Number.isFinite(t)) {
      const i = faixaIdx(t), fx = a.faixas.get(i) || { soma: 0, n: 0 };
      fx.soma += nota; fx.n++; a.faixas.set(i, fx);
    }
  }
  return new Map([...acc].map(([nome, a]) => [nome, { f: a.f, n: a.n, media: a.soma / a.n,
    faixas: new Map([...a.faixas].sort((x, y) => x[0] - y[0]).map(([i, fx]) => [i, { n: fx.n, media: fx.soma / fx.n }])) }]));
}

const OC_DO_ROTULO = Object.fromEntries(Object.entries(ROT_OC).map(([k, v]) => [v, k]));
/** Ocasião do registro no código do engine (T.Inf, Cozy N…); aceita o rótulo de tela (“Trab. Informal”). */
export const ocasiaoCod = v => { const s = String(v ?? "").trim(); return OCASIOES.includes(s) ? s : OC_DO_ROTULO[s] || null; };

/** NotaDia por frasco da grade e por OCASIÃO do registro (mesma lógica de notaPorFrascoFaixa; só Dia e Noite).
 *  Devolve Map nome → Map ocasião → {n, media}. Registro sem ocasião reconhecida não entra. */
export function notaPorFrascoOcasiao(hist, frascos) {
  const grade = new Set(frascos.filter(daGrade).map(f => f.nome));
  const acc = new Map();
  for (const r of hist) {
    if (!ehUso(r) || !grade.has(r.perfume)) continue;
    const nota = notaNum(r.notaDia), oc = ocasiaoCod(r.ocasiao);
    if (nota == null || !oc) continue;
    if (!acc.has(r.perfume)) acc.set(r.perfume, new Map());
    const m = acc.get(r.perfume), c = m.get(oc) || { soma: 0, n: 0 };
    c.soma += nota; c.n++; m.set(oc, c);
  }
  return new Map([...acc].map(([nome, m]) => [nome, new Map([...m].map(([oc, c]) => [oc, { n: c.n, media: c.soma / c.n }]))]));
}

/** Sobrevivência na pele: a resposta "vivo / fraco / morto" vem no registro da Noite (N) e vale para o último perfume
 *  do Dia (M ou M2) da mesma data. Devolve Map perfume → {n, vivo, fraco, morto} (só perfumes que estão em `frascos`).
 *  Mede; quem corrige a longevidade do frasco (antes do engine) é aplicarMedicoes, em planilha.js. */
export function sobrevivencia(hist, frascos) {
  const nomes = new Set(frascos.map(f => f.nome));
  const manhaDe = new Map();
  for (const r of hist) if (r.slot === "M" || r.slot === "M2") manhaDe.set(r.data, r);   // hist em ordem: fica o último do Dia
  const out = new Map();
  for (const r of hist) {
    if (r.slot !== "N" || !["vivo", "fraco", "morto"].includes(r.vivo)) continue;
    const m = manhaDe.get(r.data);
    if (!m || !nomes.has(m.perfume)) continue;
    const c = out.get(m.perfume) || { n: 0, vivo: 0, fraco: 0, morto: 0 };
    c.n++; c[r.vivo]++; out.set(m.perfume, c);
  }
  return out;
}

// Tetos próprios dos beasts (playbook v60, regra 4) — o ajuste opcional nunca passa deles.
export const TETO_BEAST = { "Ombre Nomade": 3, "Oud Satin Mood": 2, "Purpose 50": 3, "Brompton": 3, "Vibrato": 3, "Tygar Extrait": 3,
  "Beach Hut Man": 3, "Hacivat": 3, "Outlands": 3, "Caden": 3, "Grand Soir": 3 };

/** Ajuste opcional "+N sprays" (desligado por padrão). Devolve o número a mostrar ao lado do número do modelo. */
export function ajustarSprays(f, sprModelo, aj) {
  if (!aj || !aj.ativo || f.nome === "Désobéissant") return sprModelo;
  const extra = Number(aj.por?.[f.nome] ?? aj.geral ?? 0) || 0;
  if (!extra) return sprModelo;
  const teto = TETO_BEAST[f.nome] ?? (f.edt ? 5 : 4);
  return Math.max(1, Math.min(sprModelo + extra, Math.max(teto, sprModelo)));
}

// ───────────────────────── Wrapped do mês ─────────────────────────
/** Resumo de um mês (mes 1–12) para o Wrapped. Só Dia e Noite, só frascos da grade. Campo sem dado = null (o story
 *  correspondente é pulado). `duelos` (opcional, do Elo) dá o maior subidão do mês; `eloDe(duelos)` → Map nome → {rating}. */
export function resumoMes(hist, frascos, ano, mes, { duelos = [], eloDe = null } = {}) {
  const pref = `${ano}-${String(mes).padStart(2, "0")}`;
  const grade = new Map(frascos.filter(daGrade).map(f => [f.nome, f]));
  const doMes = hist.filter(r => ehUso(r) && grade.has(r.perfume) && r.data.startsWith(pref));
  const nulo = { total: null, distintos: null, totalGrade: grade.size, frascoDoMes: null, arquetipo: null, maisQuente: null, maisFrio: null,
    resgates: null, notaMedia: null, sequencia: null, subidao: null, material: null, dias: new Map() };
  if (!doMes.length) return nulo;
  const num = v => { const n = v === "" || v == null ? NaN : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
  // frasco do mês: mais usos; empate → maior NotaDia média
  const por = new Map();
  for (const r of doMes) {
    const c = por.get(r.perfume) || { n: 0, notas: [] };
    c.n++; const nt = notaNum(r.notaDia); if (nt != null) c.notas.push(nt); por.set(r.perfume, c);
  }
  const media = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const [nomeTop, cTop] = [...por].sort((a, b) => b[1].n - a[1].n || (media(b[1].notas) ?? -1) - (media(a[1].notas) ?? -1) || a[0].localeCompare(b[0], "pt"))[0];
  // arquétipo dominante
  const porArq = new Map();
  for (const r of doMes) { const a = grade.get(r.perfume).arquetipo; porArq.set(a, (porArq.get(a) || 0) + 1); }
  const [arq, nArq] = [...porArq].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))[0];
  // extremos de temperatura (Temp do registro)
  const comT = doMes.map(r => ({ r, T: num(r.temp) })).filter(x => x.T != null);
  const ext = sinal => { if (!comT.length) return null; const x = [...comT].sort((a, b) => sinal * (b.T - a.T) || (a.r.data < b.r.data ? -1 : 1))[0]; return { data: x.r.data, T: x.T, perfume: x.r.perfume }; };
  // resgates: 1º uso no mês de um frasco parado há 45+ dias (ou nunca usado, se o diário já cobria 45 dias antes)
  const antes = hist.filter(r => ehUso(r) && r.data < pref + "-01");
  const inicioDiario = hist.filter(ehUso).reduce((m, r) => (!m || r.data < m ? r.data : m), null);
  const resgates = [];
  for (const nome of por.keys()) {
    const pri = doMes.find(r => r.perfume === nome).data;
    const ult = antes.filter(r => r.perfume === nome).reduce((m, r) => (!m || r.data > m ? r.data : m), null);
    if (ult ? diasEntre(pri, ult) >= 45 : diasEntre(pri, inicioDiario) >= 45) resgates.push(nome);
  }
  // NotaDia média do mês
  const notas = doMes.map(r => notaNum(r.notaDia)).filter(n => n != null);
  // dias: arquétipo do dia (Dia; sem Dia, a Noite) e sequência máxima de dias seguidos sem repetir o arquétipo do dia anterior
  const arqsDia = new Map();
  for (const r of doMes) { const a = grade.get(r.perfume).arquetipo; if (!arqsDia.has(r.data)) arqsDia.set(r.data, new Set()); arqsDia.get(r.data).add(a); }
  const dias = new Map([...arqsDia.keys()].sort().map(d => [d, (doMes.find(r => r.data === d && r.slot === "M") || doMes.find(r => r.data === d)).perfume]).map(([d, p]) => [d, grade.get(p).arquetipo]));
  let seq = 0, atual = 0, ant = null;
  for (const d of [...arqsDia.keys()].sort()) {
    const cont = ant && diasEntre(d, ant) === 1 && ![...arqsDia.get(d)].some(a => arqsDia.get(ant).has(a));
    atual = cont ? atual + 1 : 1; seq = Math.max(seq, atual); ant = d;
  }
  // subidão de Elo no mês
  let subidao = null;
  const dMes = duelos.filter(d => d.data.startsWith(pref));
  if (eloDe && dMes.length) {
    const ini = eloDe(duelos.filter(d => d.data < pref + "-01")), fim = eloDe(duelos.filter(d => d.data <= pref + "-31"));
    for (const nome of new Set(dMes.flatMap(d => [d.a, d.b]))) {
      const de = ini.get(nome)?.rating ?? 1500, para = fim.get(nome)?.rating ?? 1500;
      if (para - de > 0 && (!subidao || para - de > subidao.ganho)) subidao = { nome, de, para, ganho: para - de };
    }
  }
  // material mais frequente dos nomes dos dias
  const mats = new Map();
  for (const [d, a] of dias) { const m = materialDoDia(d, a); if (m) mats.set(m, (mats.get(m) || 0) + 1); }
  const material = [...mats].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))[0]?.[0] ?? null;
  return { total: doMes.length, distintos: por.size, totalGrade: grade.size,
    frascoDoMes: { nome: nomeTop, n: cTop.n, nota: media(cTop.notas), arquetipo: grade.get(nomeTop).arquetipo },
    arquetipo: { nome: arq, pct: nArq / doMes.length }, maisQuente: ext(1), maisFrio: ext(-1),
    resgates: resgates.length ? resgates : null, notaMedia: media(notas), sequencia: seq >= 2 ? seq : null, subidao, material, dias };
}

// ───────────────────────── Análises (aba Mais › Análises) ─────────────────────────
// Todas recebem o histórico já recortado no período, de Dia/Noite inclusive 2ª aplicação (ehUso) — Esportes e a camada custo ficam de fora.

/** Onde ele usa × onde o playbook manda: cada registro com Temp e Ocasião vira uma célula faixa × ocasião; “dentro” =
 *  o frasco tem janela nessa célula. Devolve {n, dentro, mapa: Map "fi|oc" → n, fora: [{nome, data, faixaIdx, oc}]}. */
export function aderenciaPlaybook(hist, frascos, janelas) {
  const grade = new Set(frascos.filter(daGrade).map(f => f.nome));
  const mapa = new Map(), fora = [];
  let n = 0, dentro = 0;
  for (const r of hist) {
    const oc = ocasiaoCod(r.ocasiao), T = r.temp === "" || r.temp == null ? NaN : Number(String(r.temp).replace(",", "."));
    if (!grade.has(r.perfume) || !oc || !Number.isFinite(T)) continue;
    const fi = faixaIdx(T), k = `${fi}|${oc}`;
    n++; mapa.set(k, (mapa.get(k) || 0) + 1);
    if ((janelas.get(r.perfume) || []).some(j => j.faixaIdx === fi && j.ocasiao === oc)) dentro++;
    else fora.push({ nome: r.perfume, data: r.data, faixaIdx: fi, oc });
  }
  return { n, dentro, mapa, fora };
}

/** Concentração do uso: participação dos 5 mais usados, quantos frascos fazem 50 % e 80 % dos usos e o “número
 *  efetivo” de frascos (1 / Σ p²: 10 = como se usasse 10 frascos por igual). */
export function concentracao(por) {
  const us = [...por.values()].map(c => c.n).filter(n => n > 0).sort((a, b) => b - a);
  const tot = us.reduce((s, x) => s + x, 0);
  if (!tot) return null;
  const ate = frac => { let s = 0; for (let i = 0; i < us.length; i++) { s += us[i]; if (s >= frac * tot - 1e-9) return i + 1; } return us.length; };
  return { total: tot, usados: us.length, top5: us.slice(0, 5).reduce((s, x) => s + x, 0) / tot, metade: ate(0.5), oitenta: ate(0.8),
    efetivo: 1 / us.reduce((s, x) => s + (x / tot) ** 2, 0) };
}

/** Uso por tier normalizado: usos, frascos do tier e usos por frasco (B usado como A é sinal; A parado também). */
export function usoPorTier(por) {
  return ["S", "A", "B", "C"].map(t => {
    const cs = [...por.values()].filter(c => c.f.tier === t), usos = cs.reduce((s, c) => s + c.n, 0);
    return { tier: t, frascos: cs.length, usos, porFrasco: cs.length ? usos / cs.length : 0, parados: cs.filter(c => !c.n).length };
  }).filter(x => x.frascos);
}

/** Dia da semana × slot: [{dia: 0..6 (seg..dom), M, N}] */
export function porDiaSemana(hist) {
  const out = Array.from({ length: 7 }, (_, d) => ({ dia: d, M: 0, N: 0 }));
  for (const r of hist) { if (!ehUso(r)) continue; const d = (new Date(r.data + "T12:00:00Z").getUTCDay() + 6) % 7; out[d][r.slot[0]]++; }
  return out;
}

/** Constância do diário no período [de, ate]: dias com registro, dias com Dia e Noite, maior sequência e a atual. */
export function constancia(hist, de, ate) {
  const dias = new Map();
  for (const r of hist) { if (!dias.has(r.data)) dias.set(r.data, new Set()); dias.get(r.data).add(r.slot); }
  const ini = de || [...dias.keys()].sort()[0];
  if (!ini) return null;
  const total = diasEntre(ate, ini) + 1;
  let maior = 0, run = 0, ontem = 0;
  for (let i = 0; i < total; i++) {
    const d = new Date(ini + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i);
    const k = d.toISOString().slice(0, 10);
    if (i === total - 1) ontem = run;
    run = dias.has(k) ? run + 1 : 0; maior = Math.max(maior, run);
  }
  const atual = run || ontem;   // hoje ainda sem registro não quebra a sequência
  const ambos = [...dias.values()].filter(s => s.has("M") && s.has("N")).length;
  return { total, comRegistro: dias.size, ambos, maior, atual };
}
