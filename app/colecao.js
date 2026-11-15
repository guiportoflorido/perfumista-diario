// colecao.js — aba "Coleção" da planilha → frascos e fichas do app (mesmo formato de data/frascos.json e fichas.json).
// Uma linha por frasco; ele gere a coleção por ali (Ativo, Camada, Tier, ficha). Sem a aba (ou sem linha válida), o app
// segue com os JSON gerados de spec/. As regras de derivação espelham spec/frascos_v9.py (carregar e perf_por_regra).
import { OCASIOES } from "../engine/index.js";

export const ABA_COLECAO = "Coleção";
export const COLS_COLECAO = ["Ativo", "Casa", "Perfume", "Camada", "Tier", "Arquétipo", "Concentração", "Eixo", "Doçura", "Peso", "Td",
  "Faixa mais quente", "Faixa mais fria", "Aptidão", "Sprays-base", "Chuva", "Longevidade (h)", "Projeção", "Curva", "Pirâmide", "Vizinhos",
  "Leitura", "Atualizado em"];
export const FAIXAS_COD = ["MQ", "Q", "A", "F", "Fr", "MF"];
const FAIXA_LIM = [[32, 38], [27, 32], [22, 27], [17, 22], [12, 17], [6, 12]];   // (lo, hi) °C, como spec/frascos_v9.py
const EMOJI = ["🔴", "🟠", "🟡", "🔵", "🟣", "⚫"];
const CAMADAS = { Grade: "grade", Custo: "custo", Decant: "grade" };

const num = v => { const n = Number(String(v ?? "").trim().replace(",", ".")); return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : n; };
const ehExtrait = conc => /extrait|parfum|absolu|intensivo/i.test(conc);

/** Estimativa por regra: {longev, proj, curva} (espelha perf_por_regra de spec/frascos_v9.py). */
export function perfPorRegra(conc, peso, doc) {
  let L, P;
  if (/edt/i.test(conc)) { L = peso <= 2 ? 6 : 7; P = peso <= 2 ? 2 : 3; }
  else if (ehExtrait(conc)) { L = { 1: 6, 2: 7, 3: 9, 4: 11, 5: 12 }[peso]; P = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 }[peso]; }
  else { L = { 1: 5, 2: 6, 3: 8, 4: 10, 5: 12 }[peso]; P = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 }[peso]; }
  const curva = peso <= 2 && doc <= 1 ? "S" : peso >= 4 || doc >= 2 ? "F" : "L";
  return { longev: L, proj: P, curva };
}

/** "Lazer 3 · T.Inf 2" → {Lazer: 3, "T.Inf": 2}; null se algum pedaço não for “Ocasião n” válido. */
export function lerAptidao(s) {
  const apt = {};
  for (const parte of String(s || "").split("·").map(x => x.trim()).filter(Boolean)) {
    const m = parte.match(/^(.+?)\s+(\d)$/);
    if (!m || !OCASIOES.includes(m[1].trim())) return null;
    apt[m[1].trim()] = Number(m[2]);
  }
  return Object.keys(apt).length ? apt : null;
}

/** Linhas da aba Coleção → {frascos, fichas, avisos, inativos}. `janelas` = Map nome → janelas do playbook (contagem).
 *  Linha incompleta ou com valor fora da lista não entra (vira aviso com o número da linha). */
export function deLinhasColecao(linhas, { janelas = new Map() } = {}) {
  const out = { frascos: [], fichas: {}, avisos: [], inativos: [] };
  if (!linhas || linhas.length < 2) return out;
  const cab = linhas[0].map(c => String(c).trim()), i = n => cab.indexOf(n);
  if (i("Perfume") < 0 || i("Camada") < 0) { out.avisos.push("Aba Coleção sem as colunas Perfume e Camada."); return out; }
  const v = (r, n) => (i(n) >= 0 ? String(r[i(n)] ?? "").trim() : "");
  const vistos = new Set();
  linhas.slice(1).forEach((r, k) => {
    const nome = v(r, "Perfume"), linha = k + 2;
    if (!nome) return;
    const falha = msg => out.avisos.push(`Linha ${linha} (${nome}): ${msg}`);
    if (vistos.has(nome.toLowerCase())) return falha("perfume repetido — vale a primeira linha");
    vistos.add(nome.toLowerCase());
    if (/^n(ã|a)o$/i.test(v(r, "Ativo"))) { out.inativos.push(nome); return; }
    const camada = CAMADAS[v(r, "Camada")], tier = v(r, "Tier").toUpperCase(), arq = v(r, "Arquétipo"), td = v(r, "Td").toUpperCase();
    const eixo = v(r, "Eixo").toUpperCase(), conc = v(r, "Concentração") || "n/d";
    const peso = num(v(r, "Peso")), doc = num(v(r, "Doçura")), sprays = num(v(r, "Sprays-base")), chuva = num(v(r, "Chuva")) ?? 0;
    const hot = FAIXAS_COD.indexOf(v(r, "Faixa mais quente")), cold = FAIXAS_COD.indexOf(v(r, "Faixa mais fria"));
    const apt = lerAptidao(v(r, "Aptidão"));
    if (!camada) return falha("Camada tem de ser Grade, Custo ou Decant");
    if (!"SABCD".includes(tier) || tier.length !== 1) return falha("Tier tem de ser S, A, B, C ou D");
    if (!arq) return falha("falta o Arquétipo");
    if (!["C", "S", "N"].includes(td)) return falha("Td tem de ser C, S ou N");
    if (!["P", "S", "F"].includes(eixo)) return falha("Eixo tem de ser P, S ou F");
    if (![1, 2, 3, 4, 5].includes(peso)) return falha("Peso tem de ser 1 a 5");
    if (![0, 1, 2, 3].includes(doc)) return falha("Doçura tem de ser 0 a 3");
    if (hot < 0 || cold < 0 || hot > cold) return falha("Faixas inválidas (a mais quente tem de vir antes da mais fria: MQ, Q, A, F, Fr, MF)");
    if (!apt) return falha("Aptidão no formato “Lazer 3 · T.Inf 2”");
    if (!(sprays >= 1)) return falha("Sprays-base tem de ser um número");
    const regra = perfPorRegra(conc, peso, doc);
    const L = num(v(r, "Longevidade (h)")), P = num(v(r, "Projeção")), C = v(r, "Curva").toUpperCase();
    const leitura = L != null && P != null && ["S", "L", "F"].includes(C);
    const ideal = Math.max(7.5, Math.min(36.5, 34.5 - 5 * ((hot + cold) / 2 + 0.5 * (peso - 3))));
    const nJan = (janelas.get(nome) || []).length;
    const f = {
      nome, casa: v(r, "Casa"), camada, tier, arquetipo: arq, eixo, doc, peso, td, env_hot: hot, env_cold: cold,
      env_lo: FAIXA_LIM[cold][0], env_hi: FAIXA_LIM[hot][1], ideal, conc, edt: /edt/i.test(conc), apt, sprays_base: sprays,
      janelas: camada === "grade" && nJan ? nJan : null, chuva, sem_piramide: false,
      longev: leitura ? L : regra.longev, proj: leitura ? P : regra.proj, curva: leitura ? C : regra.curva,
      perf_estimada: !leitura, perf_origem: leitura ? "leitura" : "regra", janelas_estimadas: false, origem: "colecao",
      ...(v(r, "Camada") === "Decant" ? { decant: true } : {}),
    };
    out.frascos.push(f);
    out.fichas[nome] = {
      nome, casa: f.casa, conc, arquetipo: arq, tier, perfil: v(r, "Pirâmide"), eixo, doc: String(doc), peso: String(peso), td,
      envelope: `${EMOJI[hot]}${FAIXAS_COD[hot]}–${EMOJI[cold]}${FAIXAS_COD[cold]}`, aptidao: v(r, "Aptidão"), sprays_base: String(sprays),
      janelas: f.janelas ? String(f.janelas) : "—", vizinhos: v(r, "Vizinhos"), leitura: v(r, "Leitura"),
    };
  });
  return out;
}

/** Fichas da aba por cima das do JSON: campo de texto vazio na aba mantém o do JSON (ex.: Leitura não copiada). */
export function juntarFichas(base, daAba) {
  const out = { ...base };
  for (const [nome, f] of Object.entries(daAba)) {
    const b = base[nome] || {};
    out[nome] = { ...b, ...Object.fromEntries(Object.entries(f).filter(([, x]) => x !== "")) };
  }
  return out;
}
