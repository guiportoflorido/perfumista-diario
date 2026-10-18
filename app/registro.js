// registro.js — fila de registros do diário (offline primeiro) e cache da planilha.
// Estados de um registro local: pendente → enviado | conflito (slot já ocupado por outro perfume) | erro | descartado.
import { ler, gravar } from "./store.js";
import { chamar, configurado } from "./api.js";

export function fila() {
  // migração da fase 2 (campo booleano "enviado")
  return ler("diario", []).map(r => (r.estado ? r : { ...r, id: r.id || novoId(), estado: r.enviado ? "enviado" : "pendente" }));
}
function salvarFila(l) { gravar("diario", l); }
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function adicionar(reg) {
  const l = fila();
  const r = { id: novoId(), ocasiao: "", temp: "", td: "", sprays: "", notaDia: "", obs: "", ...reg, estado: "pendente", criado: new Date().toISOString() };
  l.push(r); salvarFila(l);
  return r;
}
export function atualizar(id, mud) { salvarFila(fila().map(r => (r.id === id ? { ...r, ...mud } : r))); }
export function descartar(id) { atualizar(id, { estado: "descartado" }); }

const paraPlanilha = r => ({ id: r.id, data: r.data, slot: r.slot, perfume: r.perfume, ocasiao: r.ocasiao, temp: r.temp, td: r.td,
  sprays: r.sprays, notaDia: r.notaDia, obs: r.obs });

/** Envia os pendentes (e os com erro). Com `trocaId`, grava aquele registro mesmo com o slot ocupado:
 *  tipo "troca" (trocou de perfume) ou "segunda" (2ª aplicação no mesmo slot, como já aparece no diário). */
export async function enviar({ trocaId = null, tipo = "troca" } = {}) {
  if (!configurado()) return { enviadas: 0, semConfig: true };
  let alvo = fila().filter(r => (trocaId ? r.id === trocaId : r.estado === "pendente" || r.estado === "erro"));
  if (!alvo.length) return { enviadas: 0 };
  const marca = r => (tipo === "segunda" ? `2ª aplicação do slot ${r.slot === "M" ? "Dia" : "Noite"}; ${r.existente} antes` : "troca");
  if (trocaId) alvo = alvo.map(r => ({ ...r, obs: r.obs ? `${r.obs}; ${marca(r)}` : marca(r) }));
  try {
    const j = await chamar("registrar", { linhas: alvo.map(paraPlanilha), forcar: Boolean(trocaId) });
    const ok = new Set(j.gravadas.map(g => g.id)), conf = new Map(j.conflitos.map(c => [c.id, c.existente]));
    salvarFila(fila().map(r => ok.has(r.id) ? { ...r, estado: "enviado", obs: trocaId === r.id ? alvo[0].obs : r.obs, erro: null }
      : conf.has(r.id) ? { ...r, estado: "conflito", existente: conf.get(r.id) } : r));
    return { enviadas: ok.size, conflitos: conf.size };
  } catch (e) {
    const ids = new Set(alvo.map(r => r.id));
    // erro de rede: continua pendente; recusa da planilha: marca erro com a mensagem
    salvarFila(fila().map(r => (ids.has(r.id) ? { ...r, estado: e.codigo === "rede" ? r.estado : "erro", erro: e.message } : r)));
    return { enviadas: 0, erro: e.message, rede: e.codigo === "rede" };
  }
}

export function planilhaCache() { return ler("planilha", null); }
export async function baixarPlanilha() {
  const j = await chamar("dados", {}, { timeoutMs: 25000 });
  gravar("planilha", j.dados);
  return j.dados;
}

// ───────────── editar / apagar registros recentes ─────────────
// Só os últimos DIAS_EDITAVEIS dias (a mesma regra vale no Apps Script). Registro ainda na fila (não enviado) muda só
// no aparelho; o que já está na planilha muda lá (aba Diário) e na cópia local, sem esperar o próximo download.
export const DIAS_EDITAVEIS = 30;
export function limiteEdicao(hoje) {
  const d = new Date(hoje + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - DIAS_EDITAVEIS);
  return d.toISOString().slice(0, 10);
}
const chaveReg = r => `${r.data}|${r.slot}|${r.perfume}`;
const CAMPOS = ["data", "slot", "perfume", "ocasiao", "temp", "td", "sprays", "notaDia", "obs"];
const soNaFila = r => Boolean(r.id && r.pendente);

/** Na cópia local da aba Diário: índice da linha do registro (usa a linha conhecida se ainda bater). */
function idxNaCopia(rows, r) {
  const bate = x => x && String(x[0]) === r.data && String(x[1]) === r.slot && String(x[2]) === r.perfume;
  if (r.linha && bate(rows[r.linha - 1])) return r.linha - 1;
  return rows.findIndex((x, i) => i > 0 && bate(x));
}

/** r = item do histórico unificado; campos = os 9 campos do Diário (data, slot, perfume, ocasiao, temp, td, sprays, notaDia, obs). */
export async function editarRegistro(r, campos) {
  if (soNaFila(r)) { atualizar(r.id, { ...campos, estado: "pendente", erro: null }); return { local: true }; }
  const j = await chamar("editarRegistro", { orig: { data: r.data, slot: r.slot, perfume: r.perfume }, linha: r.linha || 0, campos }, { timeoutMs: 25000 });
  const k = chaveReg(r), novo = Object.fromEntries(CAMPOS.map((c, i) => [c, j.registro[i]]));
  salvarFila(fila().map(x => (x.estado === "enviado" && chaveReg(x) === k ? { ...x, ...novo } : x)));
  const p = planilhaCache();
  if (p?.diario) { const i = idxNaCopia(p.diario, r); if (i > 0) { p.diario[i] = [...j.registro]; gravar("planilha", p); } }
  return { local: false };
}

export async function removerRegistro(r) {
  if (soNaFila(r)) { descartar(r.id); return { local: true }; }
  await chamar("removerRegistro", { orig: { data: r.data, slot: r.slot, perfume: r.perfume }, linha: r.linha || 0 }, { timeoutMs: 25000 });
  const k = chaveReg(r);
  salvarFila(fila().map(x => (x.estado === "enviado" && chaveReg(x) === k ? { ...x, estado: "descartado" } : x)));
  const p = planilhaCache();
  if (p?.diario) { const i = idxNaCopia(p.diario, r); if (i > 0) { p.diario.splice(i, 1); gravar("planilha", p); } }
  return { local: false };
}
