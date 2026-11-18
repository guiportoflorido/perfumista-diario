// playbook.js — gera o playbook (faixa × ocasião → Seguro, Jogada, Também, sprays) a partir da coleção, com as regras de
// derivação declaradas no playbook v60 (spec/playbook_v60.md). Frasco novo na aba Coleção ganha janelas sem esperar a
// próxima geração da cadeia. Seguros e jogadas do playbook oficial ficam onde ainda são elegíveis (incumbência, decisão
// dele de 25/set/2026); os 17 overrides de julgamento do v60 valem quando os dois frascos estão na célula.
import { OCASIOES } from "../engine/index.js";
import { TETO_BEAST } from "./estatisticas.js";

const CENTRO = [35, 29.5, 24.5, 19.5, 14.5, 9];        // °C no meio de cada faixa (MQ … MF)
const FREQ = [28, 160, 308, 198, 35, 1];               // dias + noites/ano por faixa (normais INMET, tabela do v60)
const TETO_TIER = { S: 12, A: 9, B: 6, C: 3, D: 0 };
const RANK = { S: 4, A: 3, B: 2, C: 1, D: 0 };
const K_CENTRO = 2, W_CENTRO = 0.1;                     // ajustados contra o v60: 644 de 668 janelas iguais
// overrides de julgamento do v60 (faixa, ocasião, Seguro, Jogada)
export const OVERRIDES_V60 = [[0, "N.For", "Town & Country", "Lucius"], [1, "Lazer", "Hacivat", "Désobéissant"], [1, "N.For", "Aventus Absolu", "Lucius"],
  [2, "Lazer", "Gentle Fluidity Silver", "Désobéissant"], [2, "N.For", "Purpose 50", "Brompton"], [2, "Cozy D", "Gris Charnel", "Odéon"],
  [3, "T.For", "Purpose 50", "Decision"], [3, "N.Inf", "Hacivat", "Brompton"], [3, "Cozy D", "Gris Charnel", "Odéon"], [3, "Cozy N", "African Leather", "Ombre Nomade"],
  [4, "Lazer", "Gris Charnel", "Outlands"], [4, "N.Inf", "Outlands", "Brompton"], [4, "N.For", "Ombre Nomade", "Radical Rose"], [4, "Cozy D", "Gris Charnel", "Brompton"],
  [4, "Cozy N", "Grand Soir", "Bijou Zafran"], [5, "N.Inf", "Outlands", "Brompton"], [5, "Cozy N", "Ombre Nomade", "Grand Soir"]];

const centralidade = (f, fi) => 1 - Math.abs(CENTRO[fi] - f.ideal) / K_CENTRO;

/** Janelas de cada frasco: células elegíveis (faixa no envelope, aptidão ≥1, Cozy só de Ameno para baixo, tier C só nas
 *  células-lar) e, dessas, as N de maior fit (aptidão + centralidade térmica), N = teto do tier. Desempate: faixa mais
 *  frequente no ano. Devolve Map nome → [{fi, oc, apt, cen}]. */
export function janelasGeradas(frascos) {
  const out = new Map();
  for (const f of frascos) {
    const teto = TETO_TIER[f.tier] ?? 0;
    if (!teto) continue;
    const maxApt = Math.max(0, ...Object.values(f.apt || {}));
    const cand = [];
    for (let fi = f.env_hot; fi <= f.env_cold; fi++) for (const oc of OCASIOES) {
      const apt = f.apt?.[oc] || 0;
      if (!apt || (oc.startsWith("Cozy") && fi < 2) || (f.tier === "C" && apt < maxApt)) continue;
      const cen = centralidade(f, fi);
      cand.push({ fi, oc, apt, cen, fit: apt + W_CENTRO * cen });
    }
    cand.sort((a, b) => b.fit - a.fit || FREQ[b.fi] - FREQ[a.fi]);
    out.set(f.nome, cand.slice(0, teto));
  }
  return out;
}

/** Sprays da célula (regra 4 do v60). */
export function spraysCelula(f, fi) {
  if (f.nome === "Désobéissant") return 6;
  if ((f.nome === "Ombre Nomade" || f.nome === "Outlands") && fi === 3) return 2;
  let s = f.sprays_base;
  if (fi === 0) s = Math.min(s, 3);
  else if (fi === 1) s = Math.min(s, 4);
  else if (fi >= 4) s += 1;
  return Math.max(1, Math.min(s, TETO_BEAST[f.nome] ?? (f.edt ? 5 : 4)));
}

const frase = t => String(t || "").replace(/\*\*/g, "").split(/(?<=[.:;])\s/)[0].replace(/[.:;]$/, "");

/** Playbook no mesmo formato de data/playbook.json. `frascos` = grade ativa; `oficial` = playbook.json (notas,
 *  seções e incumbência de Seguros/Jogadas). */
export function gerarPlaybook(frascos, fichas = {}, oficial = null) {
  const grade = frascos.filter(f => f.camada === "grade" && f.tier !== "D");
  const porNome = new Map(grade.map(f => [f.nome, f]));
  const jan = janelasGeradas(grade);
  const faixas = oficial?.faixas || ["Muito Quente", "Quente", "Ameno", "Fresco", "Frio", "Muito Frio"];
  const ordem = (a, b) => RANK[b.f.tier] - RANK[a.f.tier] || b.apt - a.apt || b.cen - a.cen || a.f.nome.localeCompare(b.f.nome, "pt");
  const out = { fonte: "gerado pelo app a partir da aba Coleção (regras do playbook v60)", faixas, grade: {}, secoes: oficial?.secoes || {}, total_alocacoes: 0, celulas: 0 };
  faixas.forEach((nomeFx, fi) => {
    const seguros = new Map(), jogadas = new Map(), celulas = {};
    for (const oc of OCASIOES) {
      const lista = grade.flatMap(f => (jan.get(f.nome) || []).filter(j => j.fi === fi && j.oc === oc).map(j => ({ f, apt: j.apt, cen: j.cen }))).sort(ordem);
      if (!lista.length) continue;
      const tem = n => lista.find(x => x.f.nome === n);
      const of = oficial?.grade?.[nomeFx]?.celulas?.[oc];
      const ov = OVERRIDES_V60.find(o => o[0] === fi && o[1] === oc);
      const sa = x => x && ["S", "A"].includes(x.f.tier);
      const livre = (mapa, cap) => x => (mapa.get(x.f.nome) || 0) < cap;
      // Seguro: override > incumbente do oficial > melhor S/A (cap 3 por frasco na faixa)
      let seg = [ov && tem(ov[2]), of && tem(of.seguro)].find(x => sa(x)) || lista.find(x => sa(x) && livre(seguros, 3)(x)) || null;
      // Jogada: override/incumbente valem como estão (o v60 mantém pares de mesmo arquétipo); a nova exige arquétipo diferente
      let jog = seg ? [ov && tem(ov[3]), of && tem(of.jogada)].find(x => sa(x) && x !== seg)
        || lista.find(x => sa(x) && x !== seg && x.f.arquetipo !== seg.f.arquetipo && livre(jogadas, 2)(x)) || null : null;
      if (seg) seguros.set(seg.f.nome, (seguros.get(seg.f.nome) || 0) + 1);
      if (jog) jogadas.set(jog.f.nome, (jogadas.get(jog.f.nome) || 0) + 1);
      const tambem = lista.filter(x => x !== seg && x !== jog).map(x => x.f.nome);
      const fi_ = n => fichas[n] || {};
      celulas[oc] = {
        seguro: seg?.f.nome || "", sprays: seg ? String(spraysCelula(seg.f, fi)) : "", seguro_perfil: seg ? fi_(seg.f.nome).perfil || "" : "", seguro_tier: seg?.f.tier || "",
        jogada: jog?.f.nome || "", jogada_txt: jog ? frase(fi_(jog.f.nome).leitura) || fi_(jog.f.nome).perfil || "" : "", jogada_tier: jog?.f.tier || "",
        tambem, texto: "",
      };
      out.total_alocacoes += lista.length; out.celulas++;
    }
    out.grade[nomeFx] = { nota: oficial?.grade?.[nomeFx]?.nota || "", celulas };
  });
  out.janelas = new Map([...porNome.keys()].map(n => [n, (jan.get(n) || []).length]));
  return out;
}

/** Quanto o playbook gerado bate com o oficial: janelas iguais / janelas do oficial, só para frascos nos dois. */
export function comparar(gerado, oficial) {
  const cel = pb => { const m = new Map(); (pb?.faixas || []).forEach((fx, fi) => Object.entries(pb.grade[fx]?.celulas || {}).forEach(([oc, c]) =>
    [c.seguro, c.jogada, ...(c.tambem || [])].filter(Boolean).forEach(n => { if (!m.has(n)) m.set(n, new Set()); m.get(n).add(`${fi}|${oc}`); }))); return m; };
  const g = cel(gerado), o = cel(oficial);
  let iguais = 0, total = 0;
  for (const [n, s] of o) { if (!g.has(n)) continue; for (const x of s) { total++; if (g.get(n).has(x)) iguais++; } }
  return { iguais, total };
}
