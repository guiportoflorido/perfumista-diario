// estatisticas.js — contas do Histórico, Coleção e calibração de sprays. Só dados do Diário: nada projetado.
// A camada custo fica fora de toda estatística (regra dele); Bedouin Rose (D) fica fora da grade.
import { diasEntre, faixaIdx, OCASIOES } from "../engine/index.js";
import { ROT_OC } from "./util.js";

/** Análises só contam Dia (M) e Noite (N); Esportes (E) e 2ª aplicação (M2/N2) ficam só no registro (decisão dele, 18/out/2026). */
export const deAnalise = r => r.slot === "M" || r.slot === "N";

export const daGrade = f => f.camada === "grade" && f.tier !== "D";

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
  hist = hist.filter(deAnalise);
  const regs = hist.filter(r => nomes.has(r.perfume) && r.data <= hoje);
  const por = new Map(grade.map(f => [f.nome, { f, n: 0, n30: 0, M: 0, N: 0, ultimo: null }]));
  for (const r of regs) {
    const c = por.get(r.perfume);
    c.n++; if (diasEntre(hoje, r.data) < 30) c.n30++;
    if (r.slot === "M") c.M++; else if (r.slot === "N") c.N++;
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

/** Uso × janelas: participação de cada frasco nos usos vs. participação nas janelas do playbook (654 desde 14/out/2026). */
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
 *  só na média geral). Só Dia e Noite (deAnalise). Devolve Map nome → {f, n, media, faixas: Map idx → {n, media}}. */
export function notaPorFrascoFaixa(hist, frascos) {
  const grade = new Map(frascos.filter(daGrade).map(f => [f.nome, f]));
  const acc = new Map();
  for (const r of hist) {
    if (!deAnalise(r) || !grade.has(r.perfume)) continue;
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
    if (!deAnalise(r) || !grade.has(r.perfume)) continue;
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

// Tetos próprios dos beasts (playbook v59, regra 4) — o ajuste opcional nunca passa deles.
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
