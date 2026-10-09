// api.js — chamadas ao Apps Script. POST com JSON em text/plain (sem preflight de CORS); token no corpo, nunca na URL.
import { ajustes } from "./store.js";

export function configurado() { const a = ajustes(); return Boolean(a.backend && a.token); }

export async function chamar(acao, extra = {}, { timeoutMs = 20000 } = {}) {
  const a = ajustes();
  if (!a.backend || !a.token) throw Object.assign(new Error("Planilha não configurada em Ajustes"), { codigo: "sem_config" });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(a.backend, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: a.token, acao, ...extra }), signal: ctl.signal, redirect: "follow", cache: "no-store" });
    if (!r.ok) throw Object.assign(new Error(`Apps Script respondeu ${r.status}`), { codigo: "rede" });
    const txt = await r.text();
    let j;
    try { j = JSON.parse(txt); }
    catch {
      // o Apps Script devolve uma página HTML (não JSON) quando falta autorização ou a implantação está errada
      const limpo = txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      const auth = /autoriz|authoriz|permiss|login|sign in|fazer login/i.test(txt);
      throw Object.assign(new Error(auth ? "O Apps Script pede autorização: no editor, rode “configurar”, autorize e implante uma nova versão."
        : `Resposta inesperada do Apps Script: ${limpo || "(vazia)"}`), { codigo: "recusado" });
    }
    if (!j.ok) throw Object.assign(new Error(j.erro || "erro no Apps Script"), { codigo: "recusado" });
    return j;
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error("Sem resposta da planilha (tempo esgotado)"), { codigo: "rede" });
    if (!e.codigo) throw Object.assign(new Error("Sem conexão com a planilha"), { codigo: "rede" });
    throw e;
  } finally { clearTimeout(t); }
}

export function gerarToken() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}
