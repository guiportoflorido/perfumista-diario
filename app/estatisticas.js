// estatisticas.js — contas do Histórico, Coleção e calibração de sprays. Só dados do Diário: nada projetado.
// A camada custo fica fora de toda estatística (regra dele); Bedouin Rose (D) fica fora da grade.
import { diasEntre } from "../engine/index.js";

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

/** Contagens por frasco da grade a partir do histórico (planilha + fila). */
export function contagens(hist, frascos, hoje) {
  const grade = frascos.filter(daGrade);
  const nomes = new Set(grade.map(f => f.nome));
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

/** Uso × janelas: participação de cada frasco nos usos vs. participação nas 651 janelas do playbook. */
export function usoVsJanelas(por) {
  const totJ = [...por.values()].reduce((s, c) => s + (c.f.janelas || 0), 0);
  const totU = [...por.values()].reduce((s, c) => s + c.n, 0);
  return [...por.values()].map(c => ({ nome: c.f.nome, tier: c.f.tier, janelas: c.f.janelas || 0, usos: c.n,
    pJ: totJ ? c.f.janelas / totJ : 0, pU: totU ? c.n / totU : 0, esperado: totJ ? totU * (c.f.janelas || 0) / totJ : 0 }))
    .map(x => ({ ...x, desvio: x.usos - x.esperado }));
}

/** Calibração: desvio real − sugerido, só para registros feitos pelo app com sugestão do modelo. */
export function calibracao(fila) {
  const pares = fila.filter(r => r.estado !== "descartado" && r.sugerido !== "" && r.sugerido != null && r.sprays !== "" && r.sprays != null)
    .map(r => ({ nome: r.perfume, real: Number(String(r.sprays).replace(",", ".")), sug: Number(r.sugerido) }))
    .filter(p => Number.isFinite(p.real) && Number.isFinite(p.sug));
  const media = a => a.reduce((s, x) => s + x, 0) / a.length;
  const por = new Map();
  for (const p of pares) { if (!por.has(p.nome)) por.set(p.nome, []); por.get(p.nome).push(p.real - p.sug); }
  return { n: pares.length, geral: pares.length ? media(pares.map(p => p.real - p.sug)) : null,
    por: [...por.entries()].map(([nome, d]) => ({ nome, n: d.length, media: media(d) })).sort((a, b) => b.media - a.media || b.n - a.n) };
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
