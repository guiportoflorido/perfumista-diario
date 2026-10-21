// planilha.js — regras puras sobre os dados da planilha (sem rede): tier da aba Tiers vence o JSON da grade,
// frascos sem "Frasco Gui" saem da recomendação, diário da planilha + fila local viram o histórico do modelo.
import { ORDEM_SLOT } from "./util.js";
import { sobrevivencia, notaPorFrascoOcasiao } from "./estatisticas.js";

const idx = (cab, nome) => cab.indexOf(nome);

/** Linhas da aba Tiers → lista de {casa, perfume, nomeDiario, posse, tier}. */
export function lerTiers(rows) {
  if (!rows || rows.length < 2) return [];
  const c = rows[0];
  const iC = idx(c, "Casa"), iP = idx(c, "Perfume"), iN = idx(c, "Nome no diário"), iPo = idx(c, "Posse"), iT = idx(c, "Tier");
  return rows.slice(1).filter(r => r[iP]).map(r => ({ casa: r[iC] || "", perfume: r[iP], nomeDiario: r[iN] || "", posse: r[iPo] || "", tier: (r[iT] || "").trim().toUpperCase() }));
}

/** Linhas da aba Diário → [{data, slot, perfume, ocasiao, temp, td, sprays, notaDia, obs, sugerido, vivo, linha}] (só datas válidas).
 *  Lê por posição; colunas novas ficam no fim e as linhas antigas, sem elas, chegam com "". */
export function lerDiario(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({ data: String(r[0] || "").trim(), slot: String(r[1] || "").trim(), perfume: String(r[2] || "").trim(),
    ocasiao: r[3] || "", temp: r[4] || "", td: r[5] || "", sprays: r[6] || "", notaDia: r[7] || "", obs: r[8] || "", sugerido: r[9] || "", vivo: r[10] || "", linha: i + 2 }))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data) && x.perfume);
}

/** Aplica a aba Tiers sobre os frascos do JSON. Devolve frascos ajustados e os avisos. */
export function aplicarTiers(frascos, tiers) {
  const avisos = { divergentes: [], sem_posse: [], sem_linha: [] };
  if (!tiers.length) return { frascos, avisos, aplicado: false };
  const porNome = new Map();
  for (const t of tiers) { if (t.nomeDiario) porNome.set(t.nomeDiario, t); }
  for (const t of tiers) { if (!porNome.has(t.perfume)) porNome.set(t.perfume, t); }
  const out = [];
  for (const f of frascos) {
    const t = porNome.get(f.nome);
    if (!t) { avisos.sem_linha.push(f.nome); out.push(f); continue; }
    if (t.posse !== "Frasco Gui") { avisos.sem_posse.push({ nome: f.nome, posse: t.posse }); continue; }
    if (t.tier && t.tier !== f.tier) {
      if (f.camada === "grade") avisos.divergentes.push({ nome: f.nome, json: f.tier, planilha: t.tier });
      out.push({ ...f, tier: t.tier });
    } else out.push(f);
  }
  return { frascos: out, avisos, aplicado: true };
}

// ───────────── medições na pele → dados de entrada do engine ─────────────
export const MEDICOES_PADRAO = Object.freeze({ ativo: true, minSobrev: 5, minNota: 5 });
// a resposta vem à noite (~19h30) sobre o perfume da manhã (~7h): ~12 h depois. Mapeamento conservador, em horas.
const HORAS_VIVO = { vivo: 12, fraco: 8, morto: 5 };

/** Corrige, por frasco, a longevidade (vivo/fraco/morto na Noite) e a aptidão (NotaDia por ocasião) antes do engine,
 *  como aplicarTiers: o engine continua puro. Só com dados suficientes (minSobrev noites; minNota usos por ocasião).
 *  Aptidão: média ≥ 4,5 sobe 1 (teto 3), ≤ 2,5 desce 1 (piso 0), nunca cria ocasião que o frasco não tem.
 *  Devolve {frascos, medidos: [{nome, longev: {de, para, n} | null, apt: [{ocasiao, de, para, n, media}]}]}. */
export function aplicarMedicoes(frascos, hist, opcoes = {}) {
  const o = { ...MEDICOES_PADRAO, ...opcoes };
  if (!o.ativo) return { frascos, medidos: [] };
  const sv = sobrevivencia(hist, frascos), notas = notaPorFrascoOcasiao(hist, frascos), medidos = [];
  const out = frascos.map(f => {
    let g = f, longev = null;
    const s = sv.get(f.nome);
    if (s && s.n >= o.minSobrev) {
      const h = Math.round(((HORAS_VIVO.vivo * s.vivo + HORAS_VIVO.fraco * s.fraco + HORAS_VIVO.morto * s.morto) / s.n) * 2) / 2;
      g = { ...g, longev: h, perf_estimada: false, perf_origem: "medido", longev_estimada_original: f.longev, longev_n: s.n };
      longev = { de: f.longev, para: h, n: s.n };
    }
    const apt = [];
    let novo = null;
    for (const [oc, c] of notas.get(f.nome) || []) {
      if (c.n < o.minNota || !Object.prototype.hasOwnProperty.call(f.apt, oc)) continue;
      const de = f.apt[oc], para = c.media >= 4.5 ? Math.min(3, de + 1) : c.media <= 2.5 ? Math.max(0, de - 1) : de;
      if (para === de) continue;
      (novo ||= { ...f.apt })[oc] = para;
      apt.push({ ocasiao: oc, de, para, n: c.n, media: c.media });
    }
    if (novo) g = { ...g, apt: novo, apt_original: f.apt };
    if (g !== f) medidos.push({ nome: f.nome, longev, apt });
    return g;
  });
  return { frascos: out, medidos };
}

/** Histórico para o modelo e para a tela: planilha + fila local ainda não confirmada (sem duplicar). */
export function diarioUnificado(diarioPlanilha, local) {
  const chave = r => `${r.data}|${r.slot}|${r.perfume}`;
  const vistos = new Set(diarioPlanilha.map(chave));
  // enviados que a cópia da planilha ainda não traz continuam valendo; conflito e descartado não entram
  const pend = local.filter(r => r.estado !== "descartado" && r.estado !== "conflito" && !vistos.has(chave(r)))
    .map(r => ({ ...r, pendente: r.estado !== "enviado" }));
  const ord = s => ORDEM_SLOT[s] ?? 9;
  return [...diarioPlanilha, ...pend].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : ord(a.slot) - ord(b.slot)));
}

/** Nomes aceitos no registro: "Nome no diário" e "Perfume" da aba Tiers (decants e amostras inclusive). */
export function nomesRegistraveis(tiers, frascos) {
  const s = new Set();
  for (const t of tiers) { if (t.nomeDiario) s.add(t.nomeDiario); }
  for (const f of frascos) s.add(f.nome);
  for (const t of tiers) { if (!t.nomeDiario) s.add(t.perfume); }
  return [...s];
}
