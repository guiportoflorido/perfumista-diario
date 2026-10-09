// clima.js — previsão (Open-Meteo), Td observado (METAR SBSP via Apps Script) e override manual.
// Regra: cada número carrega a fonte; nada ausente é preenchido em silêncio.
import { ler, gravar } from "./store.js";
import { faixaIdx, bandaTd } from "../engine/index.js";

const TZ = "America/Sao_Paulo";

export async function buscarPrevisao(lat, lon) {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: lat, longitude: lon, timezone: TZ, forecast_days: "2",
    hourly: "temperature_2m,dew_point_2m,precipitation,precipitation_probability",
  });
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Open-Meteo respondeu ${r.status}`);
    const j = await r.json();
    const h = j.hourly;
    const prev = { obtido: new Date().toISOString(), lat, lon, horas: h.time.map((t, i) => ({
      t, data: t.slice(0, 10), h: Number(t.slice(11, 13)), T: h.temperature_2m[i], Td: h.dew_point_2m[i],
      prec: h.precipitation[i], prob: h.precipitation_probability?.[i] ?? null })) };
    gravar("previsao", prev);
    return { prev, offline: false };
  } catch (e) {
    const cache = ler("previsao", null);
    if (cache && cache.lat === lat && cache.lon === lon) return { prev: cache, offline: true, erro: e.message };
    return { prev: null, offline: true, erro: e.message };
  }
}

// METAR via backend (Apps Script). Sem backend configurado → null, e o Td vem da previsão.
export async function buscarMetar(backend, token) {
  if (!backend) return { metar: null, motivo: "Apps Script não configurado" };
  try {
    const u = new URL(backend);
    u.searchParams.set("acao", "metar"); u.searchParams.set("token", token || "");
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || "falha no METAR");
    return { metar: j.metar };  // {T, Td, obs (ISO UTC), raw}
  } catch (e) { return { metar: null, motivo: e.message }; }
}

const r1 = x => Math.round(x * 10) / 10;
const horaNum = s => { const [h, m] = String(s).replace("h", ":").split(":"); return Number(h) + (Number(m) || 0) / 60; };

/** Junta previsão + METAR + override num quadro com fonte por número. */
export function derivarClima({ prev, metar, override = {}, data, aplico, noite, tiro, metarHoras = 3, metarTol = 3, agora = new Date() }) {
  const q = { avisos: [] };
  const a = horaNum(aplico), n = noite == null ? null : horaNum(noite);
  let t = horaNum(tiro); if (t <= a) t += 24;
  const fimDia = n ?? t;
  const horasHoje = prev ? prev.horas.filter(x => x.data === data) : [];
  const horasJanela = prev ? prev.horas.filter(x => {
    const rel = x.data === data ? x.h : x.data > data ? x.h + 24 : -99; return rel >= Math.floor(a) && rel < t;
  }) : [];
  const porHora = hh => horasHoje.find(x => x.h === hh);
  const fonteP = "Open-Meteo";

  // temperatura: mínima da madrugada/manhã, máxima da tarde, hora do pico, temperatura às 23h (âncora da curva do modelo)
  if (horasHoje.length) {
    const madr = horasHoje.filter(x => x.h >= 3 && x.h <= 9), tarde = horasHoje.filter(x => x.h >= 9 && x.h <= 20);
    const mn = madr.reduce((m, x) => (x.T < m.T ? x : m), madr[0]);
    const mx = tarde.reduce((m, x) => (x.T > m.T ? x : m), tarde[0]);
    q.Tmin = { v: r1(mn.T), fonte: fonteP }; q.Tmax = { v: r1(mx.T), fonte: fonteP };
    q.pico = { v: mx.h, fonte: fonteP };
    const h23 = porHora(23); q.noite23 = h23 ? { v: r1(h23.T), fonte: fonteP } : null;
  }
  for (const k of ["Tmin", "Tmax", "pico", "noite23"]) if (override[k] !== undefined && override[k] !== "") q[k] = { v: Number(override[k]), fonte: "manual" };
  if (!q.Tmin || !q.Tmax) q.avisos.push("Sem previsão de temperatura: digite mínima e máxima em “Ajustar clima”.");

  // faixa de cada slot (para exibir): Dia = máxima das horas restantes a partir da aplicação; Noite = média 20–22h
  if (horasJanela.length) {
    const dia = horasJanela.filter(x => { const rel = x.data === data ? x.h : x.h + 24; return rel >= Math.floor(a) && rel < fimDia; });
    if (dia.length) { const T = Math.max(...dia.map(x => x.T)); q.faixaDia = { idx: faixaIdx(T), T: r1(T), fonte: fonteP }; }
    if (n != null) {
      const noiteH = [20, 21, 22].map(porHora).filter(Boolean);
      if (noiteH.length) { const T = noiteH.reduce((s, x) => s + x.T, 0) / noiteH.length; q.faixaNoite = { idx: faixaIdx(T), T: r1(T), fonte: fonteP }; }
    }
  }
  if (override.Tmax !== undefined && override.Tmax !== "") q.faixaDia = { idx: faixaIdx(Number(override.Tmax)), T: Number(override.Tmax), fonte: "manual (máxima)" };
  if (override.Tnoite !== undefined && override.Tnoite !== "") q.faixaNoite = { idx: faixaIdx(Number(override.Tnoite)), T: Number(override.Tnoite), fonte: "manual" };

  // Td: METAR fresco e coerente → observado; senão previsto (média da janela do dia); override vence
  let td = null;
  if (metar && metar.Td != null) {
    const obs = new Date(metar.obs), idadeH = (agora - obs) / 36e5;
    const hLocal = Number(obs.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
    const ref = porHora(hLocal);
    const dif = ref ? Math.abs(ref.T - metar.T) : null;
    const hora = obs.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    if (idadeH > metarHoras) q.avisos.push(`METAR das ${hora} tem ${idadeH.toFixed(1)} h (limite ${metarHoras} h): descartado.`);
    else if (dif !== null && dif > metarTol) q.avisos.push(`METAR das ${hora} marca ${metar.T} °C e a previsão ${r1(ref.T)} °C (diferença > ${metarTol} °C): descartado.`);
    else td = { v: metar.Td, fonte: `METAR SBSP ${hora}`, tipo: "observado" };
  }
  if (!td && horasJanela.length) {
    const m = horasJanela.reduce((s, x) => s + x.Td, 0) / horasJanela.length;
    td = { v: r1(m), fonte: "Open-Meteo (média do dia)", tipo: "previsto" };
  }
  if (override.Td !== undefined && override.Td !== "") td = override.Td === "nd" ? { v: null, fonte: "manual", tipo: "nd" } : { v: Number(override.Td), fonte: "manual", tipo: "manual" };
  q.Td = td || { v: null, fonte: "indisponível", tipo: "nd" };
  q.Td.banda = bandaTd(q.Td.v);

  // chuva (regra do app sobre a previsão horária da janela do dia): ≥6 h com ≥0,3 mm ou ≥10 mm → contínua;
  // alguma hora com ≥0,3 mm ou probabilidade ≥60% → pancadas; senão seco
  if (horasJanela.length) {
    const molhadas = horasJanela.filter(x => x.prec >= 0.3).length;
    const total = horasJanela.reduce((s, x) => s + (x.prec || 0), 0);
    const probMax = Math.max(...horasJanela.map(x => x.prob ?? 0));
    const v = (molhadas >= 6 || total >= 10) ? 2 : (molhadas >= 1 || probMax >= 60) ? 1 : 0;
    q.chuva = { v, fonte: "Open-Meteo (regra do app)", detalhe: `${String(r1(total)).replace(".", ",")} mm, ${molhadas} h com ≥0,3 mm, prob. máx. ${probMax}%` };
  }
  if (override.chuva !== undefined && override.chuva !== "") q.chuva = { v: Number(override.chuva), fonte: "manual" };
  if (!q.chuva) q.chuva = { v: 0, fonte: "sem dado — assumido seco", detalhe: "" };
  return q;
}
