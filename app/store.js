// store.js — armazenamento local do aparelho (ajustes, override de clima, diário local, cache de previsão).
// Tudo envolto em try/catch: o app funciona mesmo sem armazenamento (aba privada).
const P = "pd.";

export function ler(chave, padrao) {
  try { const v = localStorage.getItem(P + chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
export function gravar(chave, valor) {
  try { localStorage.setItem(P + chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
}

export const AJUSTES_PADRAO = Object.freeze({
  lat: -23.601, lon: -46.665, local: "Moema, São Paulo",
  aplico: "7:15", noite: "19:30", tiro: "23", ac: 23,
  backend: "", token: "",
  metar_horas: 3, metar_tol: 3,
});

export function ajustes() { return { ...AJUSTES_PADRAO, ...ler("ajustes", {}) }; }
export function salvarAjustes(a) { gravar("ajustes", a); }

export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// estado do dia (chips, override, extras) — zera quando muda a data
export function estadoDia() {
  const e = ler("dia", null);
  const hoje = hojeISO();
  if (e && e.data === hoje) return e;
  return { data: hoje, ocDia: "auto", ambDia: "auto", ocNoite: "auto", ambNoite: "auto", soUm: false,
    extras: [], testar: "", roupa: "", override: {}, textoManual: null };
}
export function salvarDia(e) { gravar("dia", e); }

// diário local: linhas no formato da aba Diário, com flag de envio
export function diarioLocal() { return ler("diario", []); }
export function salvarDiarioLocal(l) { gravar("diario", l); }
