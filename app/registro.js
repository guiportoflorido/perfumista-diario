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

/** Envia os pendentes (e os com erro). Com `trocaId`, regrava aquele registro como troca (forcar). */
export async function enviar({ trocaId = null } = {}) {
  if (!configurado()) return { enviadas: 0, semConfig: true };
  let alvo = fila().filter(r => (trocaId ? r.id === trocaId : r.estado === "pendente" || r.estado === "erro"));
  if (!alvo.length) return { enviadas: 0 };
  if (trocaId) alvo = alvo.map(r => ({ ...r, obs: r.obs ? `${r.obs}; troca` : "troca" }));
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
