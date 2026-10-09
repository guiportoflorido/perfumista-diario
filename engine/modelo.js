// modelo.js — porta fiel de spec/modelo_diario_v1_6.py (Top 10 do dia em dois slots).
// Cada função espelha a homônima do Python; nada de "melhorias". Datas são strings AAAA-MM-DD.
import { CFG, FAIXAS, OCASIOES, OCAS_ALIAS, ESCUROS, DIAS } from "./config.js";

// ───────────────────────── utilitários de formato (iguais ao Python) ─────────────────────────
export function fmtG(x) { return String(Number(Number(x).toPrecision(6))); }

// f"{x:.Nf}" do Python: arredondamento correto do valor binário, empate exato → par
export function fmtF(x, n) {
  const k = 10 ** n, y = x * k;
  if (Math.abs(y % 1) === 0.5 && y / k === x) {
    const fl = Math.floor(y), r = fl % 2 === 0 ? fl : fl + 1;
    return (r / k).toFixed(n);
  }
  return x.toFixed(n);
}

export function fmtH(h) {
  h = h >= 24 ? h - 24 : h;
  const m = Math.round((h - Math.trunc(h)) * 60);
  return m === 0 ? `${Math.trunc(h)}h` : `${Math.trunc(h)}h${String(m).padStart(2, "0")}`;
}

const lower = s => s.toLowerCase();
const dayNum = iso => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
export const diasEntre = (a, b) => dayNum(a) - dayNum(b);
export const weekday = iso => (new Date(dayNum(iso) * 864e5).getUTCDay() + 6) % 7; // 0 = segunda
function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// ───────────────────────── parsing ─────────────────────────
function _hora(s) {
  s = s.trim().toLowerCase().replace(/h/g, ":");
  if (s.includes(":")) {
    const [h, m] = s.split(":");
    return parseInt(h, 10) + (m ? parseInt(m, 10) : 0) / 60;
  }
  return parseFloat(s);
}
const _num = s => parseFloat(s.replace(",", "."));
const _nomeDiario = s => s.trim().replace(/\s*\((manh[ãa]|noite|dia|m|n)\)\s*$/i, "").trim();
const validaData = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) throw new Error(`Data inválida: '${v}'`); return v.trim(); };

export function parseEntrada(txt, hoje = hojeISO()) {
  const d = { data: null, T: null, pico: 15.0, noite_T: null, Td: null, Td_nd: false, chuva: 0,
    aplico: CFG.aplico_default, noite: CFG.noite_default, tiro: CFG.tiro_default, manha: null, segs: null,
    ac_T: CFG.ac_T, roupa: "", extra: "", diario: [], avisos: [] };
  const diarioLines = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\d{4}-\d{2}-\d{2}\s*\|/.test(line)) { diarioLines.push(line); continue; }
    if (!line.includes(":")) continue;
    const i = line.indexOf(":");
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === "data") d.data = validaData(v);
    else if (k === "t") {
      const m = v.match(/(-?\d+(?:[.,]\d+)?)\s*(?:-|–|→|a|->)\s*(-?\d+(?:[.,]\d+)?)/);
      if (!m) throw new Error("T: use 'mín-máx', ex. 'T: 17-28 pico 15'");
      d.T = [_num(m[1]), _num(m[2])];
      const mp = v.match(/pico\s*(\d+(?:[:h.]\d+)?)/i);
      if (mp) d.pico = _hora(mp[1]);
      const mn = v.match(/noite\s*(-?\d+(?:[.,]\d+)?)/i);
      if (mn) d.noite_T = _num(mn[1]);
    } else if (k === "td") {
      if (/^(nd|n\/d|—|-|indispon)/.test(v.toLowerCase())) d.Td_nd = true;
      else d.Td = _num(v.match(/-?\d+(?:[.,]\d+)?/)[0]);
    } else if (k === "chuva") {
      const vl = v.toLowerCase();
      d.chuva = (vl.includes("cont") || vl.includes("forte")) ? 2 : (vl.includes("panc") || vl.includes("chuv")) ? 1 : 0;
    } else if (k === "aplico") d.aplico = _hora(v);
    else if (k === "noite" || k === "aplico noite" || k === "banho") {
      d.noite = /^(n[ãa]o|nao|n|sem|0)$/.test(v.toLowerCase()) ? null : _hora(v);
    } else if (k === "tiro") d.tiro = _hora(v);
    else if (k === "reaplico") d.avisos.push("'Reaplico' não existe mais — o dia já tem dois slots (Aplico / Noite)");
    else if (k === "manhã" || k === "manha" || k === "usei") d.manha = v.trim() || null;
    else if (k === "ac") d.ac_T = _num(v);
    else if (k === "dia") d.segs = parseSegmentos(v);
    else if (k === "roupa") d.roupa = v;
    else if (k === "extra") d.extra = v.toLowerCase();
    else if (k === "diario" || k === "diário") {
      for (let item of v.split(/[;·]/)) {
        item = item.trim();
        const m = item.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)/);
        if (m) d.diario.push([m[1], _nomeDiario(m[2])]);
      }
    }
  }
  for (const line of diarioLines) {
    const parts = line.split("|").map(p => p.trim());
    d.diario.push([validaData(parts[0]), _nomeDiario(parts[1])]);
  }
  if (d.T === null) throw new Error("Falta a linha 'T: mín-máx'.");
  if (d.Td === null && !d.Td_nd) throw new Error("Falta a linha 'Td: <°C>' (ou 'Td: nd').");
  if (d.data === null) d.data = hoje;
  if (d.tiro <= d.aplico) d.tiro += 24;
  if (d.noite !== null && !(d.aplico < d.noite && d.noite < d.tiro))
    throw new Error("'Noite:' precisa ficar entre 'Aplico:' e 'Tiro:' (ou 'Noite: nao').");
  if (d.noite === null) {
    d.slots = [{ nome: "Dia", ini: d.aplico, fim: d.tiro }];
    d.avisos.push("Noite: nao → dia de um perfume só (janela inteira no slot Dia)");
  } else {
    d.slots = [{ nome: "Dia", ini: d.aplico, fim: d.noite }, { nome: "Noite", ini: d.noite, fim: d.tiro }];
  }
  return d;
}

export function parseSegmentos(v) {
  const segs = [];
  for (let part of v.split(/[;·]/)) {
    part = part.trim();
    if (!part) continue;
    const m = part.match(/^(\d+(?:[:h.]\d+)?)\s*(?:-|–|→|a)\s*(\d+(?:[:h.]\d+)?)\s*(.*)/);
    if (!m) throw new Error(`Segmento ilegível: '${part}' — use 'início-fim ocasião [ambiente] [fechado]'`);
    const ini = _hora(m[1]); let fim = _hora(m[2]); const resto = m[3].toLowerCase();
    const toks = resto.match(/[a-zà-ú.]+/g) || [];
    let ocas = null, amb = null, fech = false;
    for (const t of toks) {
      if (Object.prototype.hasOwnProperty.call(OCAS_ALIAS, t)) ocas = OCAS_ALIAS[t];
      else if (["rua", "fora", "externo"].includes(t)) amb = "rua";
      else if (["ac", "escritorio", "escritório", "office"].includes(t)) amb = "ac";
      else if (["casa", "home"].includes(t)) amb = "casa";
      else if (["fechado", "reuniao", "reunião", "aviao", "avião", "carro", "elevador"].includes(t)) fech = true;
    }
    if (fim <= ini) fim += 24;
    segs.push({ ini, fim, ocas, amb, fechado: fech });
  }
  segs.forEach((s, i) => {
    if (s.ocas === null) {
      let ref = null;
      for (let j = i - 1; j >= 0 && ref === null; j--) if (segs[j].ocas) ref = segs[j].ocas;
      for (let j = i + 1; j < segs.length && ref === null; j++) if (segs[j].ocas) ref = segs[j].ocas;
      if (ref === null) throw new Error("Nenhum segmento com ocasião (lazer/ti/tf/ni/nf/cd/cn)");
      s.ocas = ref;
    }
    if (s.amb === null) s.amb = (s.ocas === "T.Inf" || s.ocas === "T.For") ? "ac" : s.ocas.startsWith("Cozy") ? "casa" : "rua";
  });
  return segs;
}

export function segmentosDefault(d) {
  const wd = weekday(d.data);
  const a = d.aplico, t = d.tiro;
  const n = d.noite !== null ? d.noite : 18.0;
  let segs;
  if (wd < 5) {
    segs = [{ ini: a, fim: Math.min(18, t), ocas: "T.Inf", amb: "ac", fechado: false }];
    if (n > 18) segs.push({ ini: 18, fim: n, ocas: "N.Inf", amb: "rua", fechado: false });
    if (t > n) segs.push({ ini: n, fim: t, ocas: "Cozy N", amb: "casa", fechado: false });
    d.avisos.push("Dia: sem agenda informada → assumido dia útil: trabalho informal em AC até 18h, rua até o banho, Cozy Noite em casa depois");
  } else {
    segs = [{ ini: a, fim: Math.min(n, t), ocas: "Lazer", amb: "rua", fechado: false }];
    if (t > n) segs.push({ ini: n, fim: t, ocas: "Cozy N", amb: "casa", fechado: false });
    d.avisos.push("Dia: sem agenda informada → assumido fim de semana: lazer na rua até o banho, Cozy Noite em casa depois");
  }
  return segs;
}

// ───────────────────────── modelo físico do dia ─────────────────────────
const pyMod = (a, b) => ((a % b) + b) % b;

export function T_rua(h, Tmin, Tmax, pico, noite) {
  const amp = Tmax - Tmin;
  h = h < 30 ? pyMod(h, 24) : h;
  if (h < 6) h += 24;
  if (h <= pico) return Tmin + amp * Math.sin(Math.PI / 2 * (h - 6) / Math.max(pico - 6, 1));
  const T23 = noite !== null ? noite : Tmin + 0.35 * amp;
  if (h <= 23) return Tmax + (T23 - Tmax) * (1 - Math.cos(Math.PI / 2 * (h - pico) / Math.max(23 - pico, 1)));
  return T23 + (Tmin - T23) * (h - 23) / 7;
}

export const faixaIdx = T => T > 32 ? 0 : T >= 27 ? 1 : T >= 22 ? 2 : T >= 17 ? 3 : T >= 12 ? 4 : 5;

export function bandaTd(Td) {
  if (Td === null || Td === undefined) return "nd";
  return Td >= 20 ? "carregado" : Td < 12 ? "seco" : "neutro";
}

export function presenca(e, L, curva) {
  if (e < 0) return 0.0;
  const lv = { S: [1.0, 0.75, 0.45], L: [1.0, 0.90, 0.70], F: [0.80, 0.90, 0.90] }[curva];
  if (e < 1) return lv[0];
  if (e < 3) return lv[1];
  if (e <= L) return lv[2];
  return Math.max(0.10, lv[2] * Math.exp(-(e - L) / 2.0));
}

export function linhaDoTempo(d) {
  const segs = d.segs || segmentosDefault(d);
  const [Tmin, Tmax] = d.T;
  const bandaRua = d.Td_nd ? "nd" : bandaTd(d.Td);
  const passos = [];
  let h = d.aplico;
  while (h < d.tiro - 1e-9) {
    let seg = segs.find(s => s.ini - 1e-9 <= h && h < s.fim);
    if (!seg) {
      const prev = segs.filter(s => s.fim <= h), nxt = segs.filter(s => s.ini > h);
      const ref = prev.length ? prev[prev.length - 1] : nxt.length ? nxt[0] : segs[0];
      seg = { ocas: ref.ocas, amb: "rua", fechado: false };
    }
    let T, banda;
    if (seg.amb === "ac") { T = d.ac_T; banda = CFG.ac_td_banda; }
    else {
      T = T_rua(h, Tmin, Tmax, d.pico, d.noite_T); banda = bandaRua;
      if (seg.amb === "casa") T = T + CFG.casa_inercia * (21 - T);
    }
    passos.push({ h, T, banda, faixa: faixaIdx(T), ocas: seg.ocas, amb: seg.amb, fechado: seg.fechado });
    h += CFG.passo_h;
  }
  return [passos, segs];
}

// ───────────────────────── score por frasco ─────────────────────────
export function fitTermico(T, f) {
  const { env_lo: lo, env_hi: hi, ideal } = f;
  if (lo <= T && T <= hi) return [0.8 + 0.2 * Math.exp(-(((T - ideal) / 8) ** 2)), 0.0, 0.0];
  if (T > hi) { const x = T - hi; return [0.8 * Math.exp(-((x / 3) ** 2)), x, 0.0]; }
  const x = lo - T;
  return [0.8 * Math.exp(-((x / 5) ** 2)), 0.0, x];
}

const apt = (f, o) => (f.apt[o] ?? 0);

export function avaliar(f, passos, d, slot) {
  const dt_h = CFG.passo_h;
  const aplico = slot.ini, slotLen = slot.fim - slot.ini;
  let W = 0, th = 0, tdm = 0, aptm = 0, fech = 0;
  let h_quente = 0, h_frio = 0, h_apt0 = 0, h_viva = 0, h_ac_viva = 0, h_casa_viva = 0;
  const horasOcas = new Map();
  let hottest_rua = null, coldest_viva = null, any_fechado = false;
  for (const p of passos) {
    const e = p.h - aplico;
    const w = presenca(e, f.longev, f.curva);
    const viva = w >= CFG.presenca_viva;
    let [ft, viol_q, viol_f] = fitTermico(p.T, f);
    if (p.amb !== "ac" && p.T >= 27 && f.doc >= 2) ft -= CFG.doce_calor * (f.doc - 1);
    let c;
    if (p.banda === "carregado") c = f.td === "C" ? 1 : f.td === "S" ? -1 : 0;
    else if (p.banda === "seco") c = f.td === "S" ? 1 : f.td === "C" ? -1 : 0;
    else c = 0;
    if (p.amb === "ac") c *= CFG.ac_td_fator;
    const a = apt(f, p.ocas);
    const pen_f = p.fechado ? Math.max(0.0, (f.proj + f.peso - 6) / 4) : 0.0;
    W += w; th += w * ft; tdm += w * c; aptm += w * a / 3; fech += w * Math.min(1.0, pen_f);
    if (viva) {
      h_viva += dt_h;
      horasOcas.set(p.ocas, (horasOcas.get(p.ocas) || 0) + dt_h);
      if (p.amb !== "ac" && viol_q > 1.0) h_quente += dt_h;
      if (viol_f > 1.0) h_frio += dt_h;
      if (a === 0 && p.amb !== "casa") h_apt0 += dt_h;
      if (p.amb === "ac") h_ac_viva += dt_h;
      if (p.amb === "casa") h_casa_viva += dt_h;
      if (p.fechado) any_fechado = true;
      if (p.amb !== "ac") hottest_rua = hottest_rua === null ? p.faixa : Math.min(hottest_rua, p.faixa);
      coldest_viva = coldest_viva === null ? p.faixa : Math.max(coldest_viva, p.faixa);
    }
  }
  if (W === 0) return null;
  th /= W; tdm /= W; aptm /= W; fech /= W;
  let ocas_dom = null, best = -Infinity;
  for (const [o, hh] of horasOcas) if (hh > best) { best = hh; ocas_dom = o; }
  const r = { f, slot: slot.nome, termico: th, td_mod: tdm, apt: aptm, fech, h_viva, h_quente, h_frio, h_apt0,
    h_ac_viva, h_casa_viva, hottest_rua, coldest_viva, any_fechado, ocas_dom, fora: null };
  // filtros duros (cortes escalados ao slot)
  const fr = CFG.corte_frac_slot * slotLen;
  const c_q = Math.min(CFG.corte_quente_h, fr), c_f = Math.min(CFG.corte_frio_h, fr), c_a = Math.min(CFG.corte_apt0_h, fr);
  if (f.tier === "D") r.fora = "tier D (fora da grade)";
  else if (h_quente >= c_q) r.fora = `${fmtG(h_quente)}h na rua acima do envelope (${FAIXAS[f.env_hot]} é o teto)`;
  else if (h_frio >= c_f) r.fora = `${fmtG(h_frio)}h abaixo do envelope (${FAIXAS[f.env_cold]} é o piso)`;
  else if (h_apt0 >= c_a) {
    const ocRua = new Set(passos.filter(p => p.amb !== "casa").map(p => p.ocas));
    const oc = OCASIOES.filter(o => ocRua.has(o) && apt(f, o) === 0);
    r.fora = `${fmtG(h_apt0)}h vivas fora de casa sem aptidão (${oc.join(", ")})`;
  } else if (f.tier === "C" && apt(f, ocas_dom) < 3) r.fora = `tier C fora da célula-lar (${ocas_dom ?? "None"} não é aptidão 3)`;
  else if (slot.nome === "Noite" && d._manha && d._manha.nome === f.nome)
    r.fora = "já usado hoje de manhã (o slot Noite é o segundo perfume do dia)";
  // score
  const clamp15 = x => Math.max(-1.5, Math.min(1.5, x));
  let chuva_eff = 0.0;
  if (d.chuva === 2) chuva_eff = clamp15(f.chuva);
  else if (d.chuva === 0) chuva_eff = -clamp15(f.chuva) * 0.5;
  const clima = Math.max(0.0, Math.min(1.0, th + CFG.w_td * tdm + CFG.w_chuva * chuva_eff));
  const ctx = Math.max(0.0, Math.min(1.0, aptm - CFG.w_fechado * fech));
  const base = CFG.w_clima * clima + CFG.w_ctx * ctx;
  const tm = CFG.tier_mult[f.tier] ?? 0.0;
  // rotação
  let rot = 1.0, dias = null, adapt = false;
  if (d.diario.length) {
    const minData = d.diario.reduce((m, [dd]) => (dd < m ? dd : m), d.diario[0][0]);
    const cobre45 = diasEntre(d.data, minData) >= 45;
    const usos = d.diario.filter(([, nome]) => lower(nome.trim()) === lower(f.nome)).map(([dd]) => dd);
    if (usos.length) {
      const ult = usos.reduce((m, x) => (x > m ? x : m));
      dias = diasEntre(d.data, ult);
      for (const [lim, mult] of CFG.rot) if (dias <= lim) { rot = mult; break; }
    } else if (cobre45) { rot = CFG.rot[CFG.rot.length - 1][1]; dias = "45+"; }
    const ult3 = d.diario.map((x, i) => [x, i]).sort((a, b) => (a[0][0] < b[0][0] ? 1 : a[0][0] > b[0][0] ? -1 : a[1] - b[1]))
      .slice(0, 3).map(x => x[0]);
    const porNome = new Map(d._frascos.map(x => [lower(x.nome), x.arquetipo]));
    const mesmos = ult3.filter(([, n]) => porNome.get(lower(n.trim())) === f.arquetipo).length;
    if (mesmos >= 2) { rot *= CFG.adaptacao; adapt = true; }
  }
  // resíduo da manhã
  let residuo = 1.0, res_txt = null;
  if (slot.nome === "Noite" && d._manha) {
    const m = d._manha;
    const pres = presenca(slot.ini - d.aplico, m.longev, m.curva);
    if (pres >= CFG.presenca_viva) {
      if (m.peso >= 4 && f.peso >= 4) { residuo = CFG.residuo_denso; res_txt = `sobre resíduo denso de ${m.nome} ↓`; }
      else if (m.arquetipo === f.arquetipo) res_txt = `mesmo arquétipo do ${m.nome} da manhã (contínuo)`;
    }
  }
  // intenção
  let intent = 1.0;
  const ex = d.extra;
  if (ex.includes("escuro")) intent = (f.peso >= 4 || ESCUROS.has(f.arquetipo)) ? CFG.intent_boost : CFG.intent_pen;
  if (ex.includes("fresco")) intent = (f.peso <= 2 || f.td === "C") ? CFG.intent_boost : CFG.intent_pen;
  Object.assign(r, { clima, ctx, base, tier_mult: tm, rot, dias, adapt, intent, chuva_eff, residuo, res_txt,
    score: 100 * tm * base * rot * intent * residuo });
  return r;
}

export function sprays(r, d, vento) {
  const f = r.f, nome = f.nome;
  if (nome === "Désobéissant") return [6, "6–7 fixo"];
  const fx = r.hottest_rua !== null ? r.hottest_rua : r.coldest_viva;
  const ac_dom = r.h_viva > 0 && r.h_ac_viva / r.h_viva >= 0.5;
  const casa_dom = r.h_viva > 0 && r.h_casa_viva / r.h_viva >= 0.7;
  const s0 = f.sprays_base; let s = s0; let nota = [];
  const beast = f.peso >= 5 || f.proj >= 5;
  if (fx === 0 && s > 3) { s = 3; nota.push("MQ máx 3"); }
  else if (fx === 1 && s > 4) { s = 4; nota.push("Q máx 4"); }
  else if ((fx === 4 || fx === 5) && !ac_dom && !casa_dom && !beast) { s += 1; nota.push("frio +1"); }
  let cap = f.edt ? 5 : 4;
  if (nome === "Tygar Extrait" || nome === "Vibrato") cap = 3;
  if ((nome === "Ombre Nomade" || nome === "Outlands") && fx === 3) { s = 2; nota = ["Fresco: 2, sem exceção"]; }
  if (nome === "Vibrato" && (r.any_fechado || ac_dom)) { s = 2; nota = ["escritório fechado: 2"]; }
  if (r.any_fechado && f.proj >= 4 && nome !== "Vibrato") { s = Math.max(1, s - 1); nota.push("fechado −1"); }
  if (casa_dom && CFG.casa_menos1 && s > 1 && nome !== "Ombre Nomade" && nome !== "Outlands") { s -= 1; nota.push("em casa −1"); }
  if (vento && !ac_dom && !casa_dom && !["Ombre Nomade", "Outlands", "Vibrato", "Tygar Extrait"].includes(nome)) { s += 1; nota.push("vento +1"); }
  s = Math.max(1, Math.min(s, cap));
  if (s === s0) nota = [];
  return [s, nota.join(", ")];
}

export function vivoAte(r, slot) {
  let e = 0.0;
  while (e < 30 && presenca(e, r.f.longev, r.f.curva) >= CFG.presenca_viva) e += 0.25;
  return slot.ini + e;
}

export function porque(r, d, ocasSlot) {
  const f = r.f, t = [];
  t.push(`térmico ${fmtF(r.termico, 2)}`);
  if (r.td_mod > 0.15) t.push("Td ↑");
  else if (r.td_mod < -0.15) t.push("Td ↓");
  if (Math.abs(r.chuva_eff) >= 0.6) t.push("chuva " + (r.chuva_eff > 0 ? "↑" : "↓"));
  const aps = OCASIOES.filter(o => o in f.apt && ocasSlot.has(o)).map(o => `${o} ${f.apt[o]}`);
  if (aps.length) t.push(aps.join("/"));
  if (r.fech > 0.05) t.push("fechado ↓");
  if (r.dias === "45+") t.push("sem uso em 45+d 🕸️");
  else if (r.dias !== null) t.push(`usado há ${r.dias}d` + (r.dias >= 45 ? " 🕸️" : ""));
  if (r.adapt) t.push("mesmo arquétipo 3 registros ↓");
  if (r.res_txt) t.push(r.res_txt);
  if (r.intent !== 1.0) t.push("intenção " + (r.intent > 1 ? "↑" : "↓"));
  return t.join(" · ");
}

export function ondeAplicar(d, passos, slot) {
  const ex = d.extra, roupa = d.roupa.toLowerCase();
  const sum = pred => passos.reduce((s, p) => s + (pred(p) ? CFG.passo_h : 0), 0);
  const rua_q = sum(p => p.amb !== "ac" && p.T >= 27);
  const ac_h = sum(p => p.amb === "ac");
  const casa_h = sum(p => p.amb === "casa");
  const tot = Math.max(slot.fim - slot.ini, 0.5);
  const linhas = [];
  if (slot.nome === "Noite") {
    linhas.push("pós-banho: pele limpa e ainda morna absorve mais — pescoço/peito, sem esfregar; esperar a pele secar antes de vestir");
    if (casa_h / tot >= 0.7) linhas.push("noite em casa: o perfume é para você e para quem está perto — projeção pesa menos que o drydown");
    return linhas.join(" · ");
  }
  if (ex.includes("sol") || ex.includes("corrida") || rua_q >= 2)
    linhas.push("calor/sol na rua: 1–2 sprays na camisa (tecido segura sem suar), o resto pescoço e peito; pulsos fora do sol");
  else if (roupa.includes("manga longa") || roupa.includes("paletó") || roupa.includes("paleto"))
    linhas.push("manga longa: pescoço + pulsos por dentro da manga — o tecido prolonga o rastro");
  else linhas.push("pescoço/peito e pulsos");
  if (ac_h / tot >= 0.5) linhas.push("dia majoritariamente em AC: você percebe menos o próprio perfume (mucosa seca) — não compensar com spray");
  return linhas.join(" · ");
}

// ───────────────────────── execução (estrutura equivalente a rodar()) ─────────────────────────
export function rodar(txt, frascos, opts = {}) {
  const d = typeof txt === "string" ? parseEntrada(txt, opts.hoje) : txt;
  d._frascos = frascos;
  if (d.manha) {
    const alvo = lower(d.manha);
    const hit = frascos.find(f => lower(f.nome) === alvo) || frascos.find(f => lower(f.nome).startsWith(alvo));
    if (hit) d._manha = hit;
    else d.avisos.push(`Manhã: '${d.manha}' não encontrado na base — regra de resíduo desligada`);
  } else if (d.slots.length === 2) {
    d.avisos.push("Sem 'Manhã:' → slot Noite sem regra de resíduo (diga o que passou de manhã para ativar)");
  }
  const [passosAll, segs] = linhaDoTempo(d);
  const vento = d.extra.includes("vento");
  const mTest = d.extra.match(/testar\s+([^/|,;]+)/);
  const alvoTest = mTest ? mTest[1].trim().toLowerCase() : null;

  const out = {
    data: d.data, dia_semana: DIAS[weekday(d.data)], avisos: [...d.avisos], entrada: d,
    segs: segs.map(s => ({ ini: s.ini, fim: s.fim, ocas: s.ocas, amb: s.amb, fechado: s.fechado })),
    faixas_rua: [...new Set(passosAll.filter(p => p.amb !== "ac").map(p => p.faixa))].sort((a, b) => a - b),
    passos: passosAll, slots: [],
  };
  if (d._manha) {
    const m = d._manha, noite = d.slots[d.slots.length - 1].ini;
    out.manha = { nome: m.nome, tier: m.tier, arquetipo: m.arquetipo, pres: presenca(noite - d.aplico, m.longev, m.curva) };
  }
  for (const slot of d.slots) {
    const passos = passosAll.filter(p => slot.ini - 1e-9 <= p.h && p.h < slot.fim - 1e-9);
    const ocasSlot = new Set(passos.map(p => p.ocas));
    const res = frascos.map(f => avaliar(f, passos, d, slot)).filter(Boolean);
    const porScore = (a, b) => b.score - a.score;
    const grade = res.filter(r => r.f.camada !== "custo" && !r.fora).sort(porScore);
    const custo = res.filter(r => r.f.camada === "custo" && !r.fora).sort(porScore);
    const fora = res.filter(r => r.fora && r.f.camada !== "custo" && (r.f.tier === "S" || r.f.tier === "A"));
    const item = r => {
      const [s, nota] = sprays(r, d, vento);
      const va = vivoAte(r, slot);
      return { nome: r.f.nome, casa: r.f.casa, tier: r.f.tier, arquetipo: r.f.arquetipo, score: r.score, sprays: s, nota,
        vivo_ate: va, vivo_fim: va >= slot.fim, porque: porque(r, d, ocasSlot), r };
    };
    const so = {
      nome: slot.nome, ini: slot.ini, fim: slot.fim, onde: ondeAplicar(d, passos, slot),
      top: grade.slice(0, CFG.top_n).map(item),
      ranking: grade.map(r => ({ nome: r.f.nome, score: r.score })),
      fora: Object.fromEntries(res.filter(r => r.fora).map(r => [r.f.nome, r.fora])),
      fora_sa: fora.sort((a, b) => ({ S: 0, A: 1 }[a.f.tier] - { S: 0, A: 1 }[b.f.tier]) || (a.f.nome < b.f.nome ? -1 : a.f.nome > b.f.nome ? 1 : 0))
        .slice(0, 8).map(r => ({ nome: r.f.nome, tier: r.f.tier, motivo: r.fora })),
      passos,
    };
    if (d.extra.includes("corrida") || d.extra.includes("academia")) so.custo = custo.slice(0, CFG.custo_n).map(item);
    if (alvoTest) {
      const hit = res.find(r => lower(r.f.nome).startsWith(alvoTest));
      if (hit && !hit.fora) { const i = grade.indexOf(hit); so.testar = { ...item(hit), pos: i >= 0 ? i + 1 : null }; }
      else if (hit) so.testar = { nome: hit.f.nome, fora: hit.fora };
      else so.testar = { nao_encontrado: mTest[1].trim() };
    }
    out.slots.push(so);
  }
  return out;
}
