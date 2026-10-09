// main.js — orquestra as telas: Hoje, Registrar e Ajustes (Coleção, Playbook e Histórico entram na fase 4).
import { rodar, FAIXAS, fmtH } from "../engine/index.js";
import { ajustes, salvarAjustes, AJUSTES_PADRAO, estadoDia, salvarDia, hojeISO } from "./store.js";
import { buscarPrevisao, buscarMetar, derivarClima } from "./clima.js";
import { montarEntrada, OCAS_DIA, OCAS_NOITE, AMBIENTES, EXTRAS } from "./entrada.js";
import { configurado, chamar, gerarToken } from "./api.js";
import { fila, adicionar, descartar, enviar, planilhaCache, baixarPlanilha } from "./registro.js";
import { lerTiers, lerDiario, aplicarTiers, diarioUnificado, nomesRegistraveis } from "./planilha.js";
import { janelasPorFrasco, ajustarSprays } from "./estatisticas.js";
import { telaColecao, telaPlaybook, telaHistorico } from "./telas.js";
import { ler, gravar } from "./store.js";

export const APP_VERSAO = "4.3";  // sobe a cada publicação: confere no topo da tela se o celular pegou a versão nova
const S = { aba: "hoje", frascos: [], frascosAtivos: [], avisosTiers: null, fichas: {}, versao: {}, prev: null, prevOffline: false,
  prevErro: null, metar: null, metarMotivo: null, clima: null, resultado: null, erroMotor: null, entrada: "", carregandoClima: true,
  sync: { estado: "ocioso", msg: "" }, tokenNovo: null, playbook: null, janelas: new Map(),
  filtro: ler("filtro", {}), pbFaixa: null };
const ajSpray = () => ler("sprays_ajuste", { ativo: false, geral: 0, por: {} });
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ROT_OC = { Lazer: "Lazer", "T.Inf": "Trab. Informal", "T.For": "Trab. Formal", "N.Inf": "Noite Informal", "N.For": "Noite Formal", "Cozy D": "Cozy Dia", "Cozy N": "Cozy Noite" };
const OCAS_TODAS = Object.keys(ROT_OC);
const AMB = { rua: "rua", ac: "AC", casa: "casa" };
let toastT;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3800);
}
const faixaHTML = idx => `<span class="pinta f${idx}" aria-hidden="true"></span>${FAIXAS[idx]}`;
const nf = x => (x == null || x === "" ? "—" : Number(x).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const virg = x => String(x).replace(".", ",");
const tierHTML = t => `<span class="tier ${esc(t)}" title="Tier ${esc(t)}">${esc(t)}</span>`;
const slotNome = s => (s === "M" ? "Dia" : s === "N" ? "Noite" : "?");

// ───────────────────────── dados ─────────────────────────
async function carregarDados() {
  const [fr, fi, pb] = await Promise.all(["frascos", "fichas", "playbook"].map(n => fetch(`data/${n}.json`).then(r => r.json())));
  S.frascos = fr.frascos; S.versao = fr.versao; S.fichas = fi.fichas; S.playbook = pb; S.janelas = janelasPorFrasco(pb);
  $("#versao").textContent = `${fr.versao.playbook.replace("playbook_", "").replace(".md", "")} · app ${APP_VERSAO}`;
  aplicarPlanilha();
}

function planilha() {
  const p = planilhaCache();
  return { tiers: lerTiers(p?.tiers), diario: lerDiario(p?.diario), lido: p?.lido || null };
}
function aplicarPlanilha() {
  const r = aplicarTiers(S.frascos, planilha().tiers);
  S.frascosAtivos = r.frascos; S.avisosTiers = r.aplicado ? r.avisos : null;
}
const historico = () => diarioUnificado(planilha().diario, fila());

async function sincronizar({ silencioso = false } = {}) {
  if (!configurado()) { S.sync = { estado: "sem_config", msg: "" }; return; }
  S.sync = { estado: "sincronizando", msg: "Sincronizando com a planilha…" }; if (!silencioso) render();
  const env = await enviar();
  let msg = "";
  try { await baixarPlanilha(); aplicarPlanilha(); S.sync = { estado: "ok", msg: "" }; }
  catch (e) { S.sync = { estado: "erro", msg: e.message }; }
  if (env.enviadas) msg = `${env.enviadas} registro${env.enviadas > 1 ? "s" : ""} gravado${env.enviadas > 1 ? "s" : ""} na planilha.`;
  if (env.conflitos) msg += ` ${env.conflitos} com slot já ocupado: veja em Registrar.`;
  if (env.erro && !env.rede) msg += ` Planilha recusou: ${env.erro}`;
  if (msg) toast(msg.trim());
  recalcular();
}

async function atualizarClima() {
  const aj = ajustes();
  S.carregandoClima = true; render();
  const [p, m] = await Promise.all([buscarPrevisao(aj.lat, aj.lon), buscarMetar()]);
  S.prev = p.prev; S.prevOffline = p.offline; S.prevErro = p.erro || null;
  S.metar = m.metar; S.metarMotivo = m.motivo || null;
  S.carregandoClima = false; S.dataClima = estadoDia().data;
  recalcular();
}

function recalcular() {
  const aj = ajustes(), dia = estadoDia(), data = dia.data;
  S.clima = derivarClima({ prev: S.prev, metar: S.metar, override: dia.override, data, aplico: aj.aplico,
    noite: dia.soUm ? null : aj.noite, tiro: aj.tiro, metarHoras: aj.metar_horas, metarTol: aj.metar_tol });
  const h = historico().filter(r => r.data <= data);
  const manha = h.filter(r => r.data === data && r.slot === "M").at(-1);   // depois de uma troca, vale a última
  const diario = h.slice(-150).reverse();
  S.entrada = dia.textoManual ?? montarEntrada({ data, clima: S.clima, aj, dia, manha: manha?.perfume, diario });
  try { S.resultado = rodar(S.entrada, S.frascosAtivos); S.erroMotor = null; }
  catch (e) { S.resultado = null; S.erroMotor = e.message; }
  render();
}

// ───────────────────────── telas ─────────────────────────
function render() {
  document.querySelectorAll("#abas button").forEach(b => {
    if (b.dataset.aba === S.aba) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  const foco = document.activeElement?.id;
  const ctx = { frascos: S.frascosAtivos, hist: historico(), hoje: hojeISO(), janelas: S.janelas, filtro: S.filtro, playbook: S.playbook,
    faixaSel: S.pbFaixa ?? S.clima?.faixaDia?.idx ?? 2, fila: fila(), ajSpray: ajSpray() };
  $("#tela").innerHTML = ({ hoje: telaHoje, registrar: telaRegistrar, ajustes: telaAjustes,
    colecao: () => telaColecao(ctx), playbook: () => telaPlaybook(ctx), historico: () => telaHistorico(ctx) }[S.aba])();
  if (foco && document.getElementById(foco) && S.aba !== "hoje") {
    const el = document.getElementById(foco); el.focus();
    if (el.type === "search") { const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* sem seleção */ } }
  }
}

function blocoSync() {
  const pend = fila().filter(r => r.estado === "pendente" || r.estado === "erro").length;
  const conf = fila().filter(r => r.estado === "conflito").length;
  if (S.sync.estado === "sem_config") return pend ? `<p class="nota"><span class="selo aviso">só no aparelho</span> ${pend} registro${pend > 1 ? "s" : ""} aguardando a planilha ser configurada em Ajustes.</p>` : "";
  const p = planilha();
  const partes = [];
  if (S.sync.estado === "sincronizando") partes.push("Sincronizando…");
  else if (S.sync.estado === "erro") partes.push(`<span class="erro-txt">Planilha indisponível: ${esc(S.sync.msg)}</span>${p.lido ? ` · usando a cópia de ${new Date(p.lido).toLocaleString("pt-BR")}` : ""}`);
  else if (p.lido) partes.push(`Planilha lida às ${new Date(p.lido).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  if (pend) partes.push(`<span class="selo aviso">${pend} na fila</span>`);
  if (conf) partes.push(`<span class="selo aviso">${conf} conflito${conf > 1 ? "s" : ""}</span>`);
  return partes.length ? `<p class="nota">${partes.join(" · ")} <button class="btn sec peq" data-acao="sync">Sincronizar</button></p>` : "";
}

function blocoAvisosTiers() {
  const a = S.avisosTiers;
  if (!a) return "";
  const itens = [];
  if (a.divergentes.length) itens.push(`<li><b>Grade desatualizada — rodar o gerador.</b> Tier na planilha diferente do JSON (o app usa o da planilha): ${a.divergentes.map(d => `${esc(d.nome)} ${d.json}→${d.planilha}`).join(", ")}.</li>`);
  if (a.sem_posse.length) itens.push(`<li>Fora da recomendação por posse na aba Tiers: ${a.sem_posse.map(d => `${esc(d.nome)} (${esc(d.posse)})`).join(", ")}.</li>`);
  if (a.sem_linha.length) itens.push(`<li>Sem linha na aba Tiers (usando o tier do JSON): ${a.sem_linha.map(esc).join(", ")}.</li>`);
  return itens.length ? `<div class="bloco"><h3>Aba Tiers × grade</h3><ul class="avisos">${itens.join("")}</ul></div>` : "";
}

function telaHoje() {
  const dia = estadoDia(), c = S.clima;
  const t0 = new Date(dia.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const titulo = t0.charAt(0).toUpperCase() + t0.slice(1);
  if (S.carregandoClima && !c) return `<h2>${esc(titulo)}</h2><p class="nota">Buscando a previsão para ${esc(ajustes().local)}…</p>`;
  return `
  <h2>${esc(titulo)}</h2>
  ${blocoSync()}
  ${blocoAvisosTiers()}
  ${blocoClima(c, dia)}
  ${blocoContexto(dia)}
  ${S.erroMotor ? `<div class="bloco"><p class="erro-txt">Não consegui rodar a recomendação: ${esc(S.erroMotor)}</p></div>` : ""}
  ${S.resultado ? S.resultado.slots.map(blocoSlot).join("") : ""}
  ${S.resultado && S.resultado.avisos.length ? `<div class="bloco"><h3>Premissas do modelo</h3><ul class="avisos">${S.resultado.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
  ${blocoAvancado(dia)}`;
}

function blocoClima(c, dia) {
  if (!c) return "";
  const fx = (f, rot) => `<div class="faixa-slot"><span class="rot">${rot}</span>${f ? `<span class="fx">${faixaHTML(f.idx)}</span><span class="t">${nf(f.T)} °C · ${esc(f.fonte)}</span>` : `<span class="t">sem dado</span>`}</div>`;
  const sel = f => (f.fonte.startsWith("manual") ? `<span class="selo manual">manual</span>` : f.tipo === "previsto" ? `<span class="selo">previsto</span>` : f.tipo === "observado" ? `<span class="selo">observado</span>` : "");
  const td = c.Td;
  return `<section class="bloco" aria-label="Clima">
    <div class="clima-faixas">${fx(c.faixaDia, "☀︎ Slot Dia")}${dia.soUm ? "" : fx(c.faixaNoite, "☾ Slot Noite")}</div>
    <dl class="fontes">
      <dt>Temperatura</dt><dd>${c.Tmin ? `${nf(c.Tmin.v)}→${nf(c.Tmax.v)} °C, pico ${c.pico?.v ?? "—"}h${c.noite23 ? `, 23h ${nf(c.noite23.v)} °C` : ""} <span class="nota">· ${esc(c.Tmax.fonte)}</span>${c.Tmax.fonte === "manual" ? `<span class="selo manual">manual</span>` : ""}` : `<span class="erro-txt">sem dado</span>`}</dd>
      <dt>Ponto de orvalho</dt><dd>${td.v == null ? "indisponível — sem modificador de Td" : `${nf(td.v)} °C · ar ${td.banda}`} ${td.fonte === "manual" ? "" : `<span class="nota">· ${esc(td.fonte)}</span>`}${sel(td)}</dd>
      <dt>Chuva</dt><dd>${["seco", "pancadas", "contínua"][c.chuva.v]} <span class="nota">· ${esc(c.chuva.fonte)}${c.chuva.detalhe ? ` (${esc(c.chuva.detalhe)})` : ""}</span>${c.chuva.fonte === "manual" ? `<span class="selo manual">manual</span>` : ""}</dd>
    </dl>
    ${S.prevOffline ? `<p class="nota"><span class="selo aviso">offline</span> ${S.prev ? `Previsão guardada de ${new Date(S.prev.obtido).toLocaleString("pt-BR")}.` : ""} ${esc(S.prevErro || "")}</p>` : ""}
    ${!S.metar && S.metarMotivo ? `<p class="nota">Td observado (Congonhas): ${esc(S.metarMotivo)}.</p>` : ""}
    ${c.avisos.length ? `<ul class="avisos">${c.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
    <details id="ajClima" ${Object.keys(dia.override).length ? "open" : ""}><summary>Ajustar clima (o que você digitar vence a previsão)</summary>
      <div class="campos" style="margin-top:10px">
        ${campo("Tmin", "Mínima °C", dia.override.Tmin)}${campo("Tmax", "Máxima °C", dia.override.Tmax)}
        ${campo("pico", "Hora do pico", dia.override.pico)}${campo("noite23", "Temp. às 23h °C", dia.override.noite23)}
        ${campo("Tnoite", "Temp. 20–22h °C", dia.override.Tnoite)}${campo("Td", "Td °C (ou nd)", dia.override.Td)}
        <label>Chuva<select data-ov="chuva"><option value="">previsão</option>${["seco", "pancadas", "contínua"].map((x, i) => `<option value="${i}" ${String(dia.override.chuva) === String(i) ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      </div>
      <div class="linha-flex" style="margin-top:10px"><button class="btn sec peq" data-acao="limpar-ov">Voltar à previsão</button><button class="btn sec peq" data-acao="clima">Atualizar previsão</button></div>
    </details>
  </section>`;
}
const campo = (k, rot, v) => `<label>${rot}<input data-ov="${k}" type="text" inputmode="decimal" value="${esc(v ?? "")}" autocomplete="off"></label>`;

function chips(nome, opcoes, atual) {
  return `<div class="chips rolagem" role="group">${opcoes.map(([v, r]) => `<button class="chip" data-chip="${nome}" data-v="${v}" aria-pressed="${atual === v}">${r}</button>`).join("")}</div>`;
}

function blocoContexto(dia) {
  return `<section class="grupo" aria-label="Extras do dia">
    <div class="grupo"><span class="rot">Extras do dia</span><div class="chips rolagem" role="group">${EXTRAS.map(([v, r]) => `<button class="chip" data-extra="${v}" aria-pressed="${dia.extras.includes(v)}">${r}</button>`).join("")}
      <button class="chip" data-acao="soUm" aria-pressed="${dia.soUm}">Só um perfume hoje</button></div></div>
  </section>`;
}

function ocasiaoDominante(so) {
  const horas = new Map(); for (const p of so.passos) horas.set(p.ocas, (horas.get(p.ocas) || 0) + 1);
  return [...horas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function spraysHTML(t) {
  const adj = ajustarSprays(t.r.f, t.sprays, ajSpray());
  const nota = t.nota ? ` <span class="nota">(${esc(t.nota)})</span>` : "";
  if (adj === t.sprays) return `<span><b>${t.sprays}</b> spray${t.sprays > 1 ? "s" : ""}${nota}</span>`;
  return `<span><b>${adj}</b> sprays <span class="selo manual">seu ajuste</span> <span class="nota">modelo ${t.sprays}${t.nota ? `, ${esc(t.nota)}` : ""}</span></span>`;
}

function blocoSlot(s) {
  const dia = estadoDia();
  const slotCod = s.nome === "Dia" ? "M" : "N";
  const usado = historico().filter(r => r.data === dia.data && r.slot === slotCod).at(-1);
  const card = (t, i, custo = false) => {
    const ja = usado && usado.perfume === t.nome;
    return `<article class="card ${i === 0 && !custo ? "top1" : ""}">
      <span class="pos">${i + 1}</span>
      <div style="min-width:0"><button class="nome" data-ficha="${esc(t.nome)}">${esc(t.nome)}</button>${tierHTML(t.tier)}<div class="casa">${esc(t.casa)} · ${esc(t.arquetipo)}</div></div>
      <span class="score" title="Score">${t.score.toFixed(0)}</span>
      <div class="meta">${spraysHTML(t)}<span>vivo até <b>${t.vivo_fim ? "o fim" : "~" + fmtH(t.vivo_ate)}</b></span></div>
      <div class="pq">${esc(t.porque)}</div>
      <div class="acoes"><span class="esp"></span><button class="btn peq ${ja ? "feito" : "sec"}" data-usei="${esc(t.nome)}" data-slot="${slotCod}" data-sprays="${t.sprays}" data-ajustado="${ajustarSprays(t.r.f, t.sprays, ajSpray())}" ${usado ? "disabled" : ""}>${ja ? "✓ Registrado" : "Usei este"}</button></div>
    </article>`;
  };
  const segs = (S.resultado.segs || []).filter(g => g.fim > s.ini && g.ini < s.fim).map(g => `${fmtH(Math.max(g.ini, s.ini))}–${fmtH(Math.min(g.fim, s.fim))} ${ROT_OC[g.ocas]} (${AMB[g.amb]}${g.fechado ? ", fechado" : ""})`);
  const estadoUso = u => (u.pendente ? (u.estado === "conflito" ? " · conflito na planilha" : " · na fila para a planilha") : " · na planilha");
  return `<section class="grupo" aria-label="Slot ${s.nome}">
    <div class="slot-cab"><h2>${s.nome === "Dia" ? "☀︎ Slot Dia" : "☾ Slot Noite"}</h2><span class="t">${fmtH(s.ini)}→${fmtH(s.fim)}</span></div>
    ${s.nome === "Dia" ? chips("ocDia", OCAS_DIA, dia.ocDia) + chips("ambDia", AMBIENTES, dia.ambDia) : chips("ocNoite", OCAS_NOITE, dia.ocNoite) + chips("ambNoite", AMBIENTES, dia.ambNoite)}
    <p class="nota">${esc(segs.join(" · "))}</p>
    ${usado ? `<p class="nota">Registrado hoje: <b>${esc(usado.perfume)}</b>${estadoUso(usado)}.${usado.pendente && usado.estado !== "enviado" ? ` <button class="btn sec peq" data-descartar="${esc(usado.id)}">Desfazer</button>` : ""}</p>` : ""}
    <p class="onde">🧴 ${esc(s.onde)}</p>
    ${s.testar ? `<p class="onde">★ ${s.testar.nao_encontrado ? `“${esc(s.testar.nao_encontrado)}” não está na base.` : s.testar.fora ? `Testar ${esc(s.testar.nome)}: reprovado neste slot — ${esc(s.testar.fora)}.` : `Testar <b>${esc(s.testar.nome)}</b>: passa nos filtros · ${s.testar.sprays} sprays · score ${s.testar.score.toFixed(0)}${s.testar.pos ? ` (#${s.testar.pos})` : ""} · ${esc(s.testar.porque)}`}</p>` : ""}
    <div class="lista">${s.top.length ? s.top.map((t, i) => card(t, i)).join("") : `<p class="vazio">Nenhum frasco passa nos filtros deste slot.</p>`}</div>
    ${s.custo ? `<div class="bloco"><h3>Camada custo · corrida/academia</h3>${s.custo.length ? `<div class="lista">${s.custo.map((t, i) => card(t, i, true)).join("")}</div>` : `<p class="nota">Nenhum frasco da camada passa nos filtros.</p>`}</div>` : ""}
    ${s.fora_sa.length ? `<details class="fora"><summary>S/A fora neste slot (${s.fora_sa.length})</summary><ul>${s.fora_sa.map(f => `<li><b>${esc(f.nome)}</b> (${f.tier}): ${esc(f.motivo)}</li>`).join("")}</ul></details>` : ""}
  </section>`;
}

function blocoAvancado(dia) {
  return `<details class="bloco" id="avancado"><summary>Modo avançado</summary>
    <div class="campos">
      <label class="largo">Testar um frasco<input id="testar" value="${esc(dia.testar)}" list="lista-frascos" placeholder="Nome do frasco" autocomplete="off"></label>
      <label class="largo">Roupa<input id="roupa" value="${esc(dia.roupa)}" placeholder="ex.: camisa manga longa, paletó" autocomplete="off"></label>
    </div>
    <datalist id="lista-frascos">${S.frascosAtivos.filter(f => f.camada === "grade" && f.tier !== "D").map(f => `<option value="${esc(f.nome)}">`).join("")}</datalist>
    <label class="campo">Entrada do modelo ${dia.textoManual != null ? `<span class="selo manual">editada à mão</span>` : ""}
      <textarea id="entrada" rows="12" spellcheck="false">${esc(S.entrada)}</textarea></label>
    <p class="nota">Mesmo formato do modelo_diario: segmentos em “Dia: 8-18 ti ac fechado; 18-19:30 rua; 19:30-23 cn casa”.</p>
    <div class="linha-flex"><button class="btn peq" data-acao="usar-texto">Rodar este texto</button>${dia.textoManual != null ? `<button class="btn sec peq" data-acao="soltar-texto">Voltar ao automático</button>` : ""}</div>
  </details>`;
}

// ───────────────────────── registrar ─────────────────────────
function formRegistro(p = {}) {
  const hoje = hojeISO(), hr = new Date().getHours();
  const slot = p.slot || (hr < 19 ? "M" : "N");
  const nomes = nomesRegistraveis(planilha().tiers, S.frascosAtivos);
  return `<form class="bloco" id="formRegistro" autocomplete="off">
    <div class="campos">
      <label>Data<input type="date" id="rg-data" value="${esc(p.data || hoje)}" max="${hoje}" required></label>
      <label>Slot<select id="rg-slot"><option value="M" ${slot === "M" ? "selected" : ""}>☀︎ Dia (M)</option><option value="N" ${slot === "N" ? "selected" : ""}>☾ Noite (N)</option></select></label>
      <label class="largo">Perfume<input id="rg-perfume" list="rg-nomes" value="${esc(p.perfume || "")}" placeholder="Nome no diário" required></label>
      <label>Ocasião<select id="rg-ocasiao"><option value="">—</option>${OCAS_TODAS.map(o => `<option value="${o}" ${p.ocasiao === o ? "selected" : ""}>${ROT_OC[o]}</option>`).join("")}</select></label>
      <label>Sprays reais<input id="rg-sprays" inputmode="numeric" value="${esc(p.sprays ?? "")}" placeholder="${p.sugerido ? `sugerido ${p.sugerido}` : ""}"></label>
      <label>NotaDia (fit do slot)<input id="rg-nota" inputmode="decimal" value=""></label>
      <label class="largo">Obs<input id="rg-obs" value=""></label>
    </div>
    <datalist id="rg-nomes">${nomes.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <input type="hidden" id="rg-sugerido" value="${esc(p.sugerido ?? "")}">
    <p class="nota">Temp e Td entram sozinhos só para hoje (Td só se observado em Congonhas). Registro retroativo fica com clima vazio.</p>
    <div class="linha-flex"><button class="btn" type="submit">Registrar</button>${p.folha ? `<button class="btn sec" type="button" data-fechar>Cancelar</button>` : ""}</div>
  </form>`;
}

function telaRegistrar() {
  const fl = fila();
  const abertos = fl.filter(r => ["pendente", "erro", "conflito"].includes(r.estado)).sort((a, b) => (a.data < b.data ? 1 : -1));
  const h = historico().slice(-14).reverse();
  return `<h2>Registrar uso</h2>
  ${blocoSync()}
  ${formRegistro()}
  ${abertos.length ? `<div class="bloco"><h3>Na fila · ${abertos.length}</h3><div class="lista">${abertos.map(r => `
    <div class="card"><span class="pos">${r.slot}</span><div style="min-width:0"><b>${esc(r.perfume)}</b><div class="casa">${esc(r.data)} · ${slotNome(r.slot)}${r.sprays ? ` · ${esc(r.sprays)} sprays` : ""}</div></div><span></span>
      <div class="pq">${r.estado === "conflito" ? `Na planilha já existe <b>${esc(r.existente)}</b> neste slot. Foi uma 2ª aplicação ou uma troca?` : r.estado === "erro" ? `<span class="erro-txt">${esc(r.erro)}</span>` : configurado() ? "Aguardando envio." : "Configure a planilha em Ajustes para enviar."}</div>
      <div class="acoes"><span class="esp"></span>${r.estado === "conflito" ? `<button class="btn peq" data-troca="${esc(r.id)}" data-tipo="segunda">2ª aplicação</button><button class="btn peq" data-troca="${esc(r.id)}" data-tipo="troca">Troca</button>` : ""}<button class="btn sec peq" data-descartar="${esc(r.id)}">Descartar</button></div>
    </div>`).join("")}</div></div>` : ""}
  <div class="bloco"><h3>Últimos registros</h3>${h.length ? `<div class="lista">${h.map(r => `
    <div class="card"><span class="pos">${esc(r.slot)}</span><div style="min-width:0"><b>${esc(r.perfume)}</b><div class="casa">${esc(r.data)}${r.ocasiao ? ` · ${esc(ROT_OC[r.ocasiao] || r.ocasiao)}` : ""}${r.sprays ? ` · ${esc(r.sprays)} sprays` : ""}${r.pendente ? " · na fila" : ""}</div></div><span></span></div>`).join("")}</div>` : `<p class="vazio">Nenhum registro ainda.</p>`}</div>`;
}

function abrirRegistro(p) {
  $("#folha").innerHTML = `<div class="veu" data-fechar><div class="folha" role="dialog" aria-modal="true" aria-label="Registrar uso">
    <div class="linha-flex"><h2>Usei ${esc(p.perfume)}</h2></div>${formRegistro({ ...p, folha: true })}</div></div>`;
  $("#rg-sprays").focus();
}

function sugeridoHoje(slot, perfume) {
  const so = S.resultado?.slots.find(x => (x.nome === "Dia" ? "M" : "N") === slot);
  const t = so && [...so.top, ...(so.custo || [])].find(x => x.nome === perfume);
  return t ? String(t.sprays) : "";
}

async function salvarRegistro() {
  const data = $("#rg-data").value, slot = $("#rg-slot").value, perfume = $("#rg-perfume").value.trim();
  if (!data || !perfume) { toast("Preencha data e perfume."); return; }
  const nomes = nomesRegistraveis(planilha().tiers, S.frascosAtivos);
  if (planilha().tiers.length && !nomes.includes(perfume)) { toast(`“${perfume}” não está na aba Tiers. Use o nome exato da lista.`); return; }
  if (historico().some(r => r.data === data && r.slot === slot && r.perfume === perfume)) { toast("Esse registro já existe."); return; }
  const hoje = data === hojeISO(), c = S.clima;
  const f = !c ? null : slot === "M" ? c.faixaDia : c.faixaNoite;
  const reg = { data, slot, perfume, ocasiao: $("#rg-ocasiao").value, sprays: $("#rg-sprays").value.trim(),
    notaDia: virg($("#rg-nota").value.trim()), obs: $("#rg-obs").value.trim(), sugerido: $("#rg-sugerido").value || (hoje ? sugeridoHoje(slot, perfume) : ""),
    temp: hoje && f ? virg(f.T) : "", td: hoje && c && (c.Td.tipo === "observado" || c.Td.tipo === "manual") && c.Td.v != null ? virg(c.Td.v) : "" };
  adicionar(reg);
  fecharFolha();
  toast(`Registrado: ${perfume} · ${data} · ${slotNome(slot)}${configurado() ? "" : " (só no aparelho)"}.`);
  recalcular();
  if (configurado()) await sincronizar({ silencioso: true });
}

// ───────────────────────── ajustes ─────────────────────────
function telaAjustes() {
  const a = ajustes();
  const c = (k, rot, extra = "") => `<label>${rot}<input id="aj-${k}" type="text" value="${esc(a[k])}" ${extra} autocomplete="off"></label>`;
  return `<h2>Ajustes</h2>
  <form class="bloco" id="formAjustes">
    <h3>Local do clima</h3>
    <div class="campos">${c("local", "Nome")}${c("lat", "Latitude", 'inputmode="decimal"')}${c("lon", "Longitude", 'inputmode="decimal"')}</div>
    <h3>Rotina</h3>
    <div class="campos">${c("aplico", "Aplicação manhã")}${c("noite", "Aplicação noite")}${c("tiro", "Fim do dia")}${c("ac", "AC padrão °C", 'inputmode="decimal"')}</div>
    <h3>Td observado (METAR Congonhas)</h3>
    <div class="campos">${c("metar_horas", "Validade (horas)", 'inputmode="decimal"')}${c("metar_tol", "Tolerância vs previsão °C", 'inputmode="decimal"')}</div>
    <h3>Planilha (Apps Script)</h3>
    <div class="campos"><label class="largo">URL do App da Web<input id="aj-backend" type="url" value="${esc(a.backend)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
      <label class="largo">Token<input id="aj-token" type="password" value="${esc(a.token)}" autocomplete="off"></label></div>
    ${S.tokenNovo ? `<div class="onde"><b>Token novo:</b> <code style="overflow-wrap:anywhere">${esc(S.tokenNovo)}</code><br>Copie e cole em Propriedades do script → TOKEN. Ele já foi colocado no campo acima; toque em Salvar.
      <div class="linha-flex" style="margin-top:6px"><button class="btn sec peq" type="button" data-acao="copiar-token">Copiar</button></div></div>` : ""}
    <p class="nota">O token fica só neste aparelho e vai no corpo da chamada, nunca na URL.</p>
    <div class="linha-flex"><button class="btn" type="submit">Salvar</button><button class="btn sec" type="button" data-acao="gerar-token">Gerar token</button><button class="btn sec" type="button" data-acao="testar">Testar conexão</button></div>
    <p class="nota" id="testeMsg"></p>
  </form>
  <details class="bloco"><summary>Como instalar o Apps Script na planilha</summary>
    <ol class="nota" style="padding-left:18px;margin:0">
      <li>No computador, abra a planilha “Diário de Uso — Perfumes” → <b>Extensões → Apps Script</b>.</li>
      <li>Apague o conteúdo de <code>Code.gs</code>, cole o código de <a href="https://raw.githubusercontent.com/guiportoflorido/perfumista-diario/main/backend/Code.gs" target="_blank" rel="noopener">backend/Code.gs</a> e salve (⌘S).</li>
      <li><b>Implantar → Nova implantação</b> → engrenagem → <b>App da Web</b> · Executar como <b>Eu</b> · Quem pode acessar <b>Qualquer pessoa</b> → Implantar e autorizar com sua conta.</li>
      <li>No topo do editor, escolha a função <b>configurar</b> e clique em <b>Executar</b>. O registro de execução mostra a <b>URL</b> e o <b>Token</b>.</li>
      <li>Copie cada um no Mac e cole aqui no iPhone (mesmo Apple ID: a área de transferência é compartilhada). Salvar → <b>Testar conexão</b>.</li>
    </ol>
  </details>
  <div class="bloco"><h3>Dados</h3><dl class="kv">
    <dt>Frascos</dt><dd>${S.frascos.length} (grade ${S.frascos.filter(f => f.camada === "grade" && f.tier !== "D").length}) · ativos agora ${S.frascosAtivos.length}</dd>
    ${Object.entries(S.versao).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
    <dt>Planilha</dt><dd>${planilha().lido ? `lida em ${new Date(planilha().lido).toLocaleString("pt-BR")} · ${planilha().tiers.length} linhas em Tiers · ${planilha().diario.length} no Diário` : "ainda não lida"}
      ${S.sync.estado === "erro" ? `<br><span class="erro-txt">Última tentativa falhou: ${esc(S.sync.msg)}</span>` : ""}</dd>
  </dl>
  <div class="linha-flex"><button class="btn sec peq" data-acao="ler-planilha">Ler planilha agora</button></div>
  <p class="nota" id="lerMsg"></p></div>`;
}

// ───────────────────────── ficha ─────────────────────────
function abrirFicha(nome) {
  const f = S.frascosAtivos.find(x => x.nome === nome) || S.frascos.find(x => x.nome === nome), fi = S.fichas[nome];
  if (!f || !fi) return;
  const usos = historico().filter(r => r.perfume === nome);
  const ult = usos[usos.length - 1];
  $("#folha").innerHTML = `<div class="veu" data-fechar><div class="folha" role="dialog" aria-modal="true" aria-labelledby="fichaT">
    <div class="linha-flex"><h2 id="fichaT">${esc(nome)}</h2>${tierHTML(f.tier)}<span class="esp"></span><button class="btn sec peq" data-fechar>Fechar</button></div>
    <p class="nota">${esc(f.casa)} · ${esc(fi.conc)} · ${esc(f.arquetipo)}</p>
    <dl class="kv">
      <dt>Pirâmide</dt><dd>${esc(fi.perfil)} <span class="nota">· fonte: ${esc(S.versao.fichas)}</span></dd>
      <dt>Envelope</dt><dd>${esc(fi.envelope)}</dd>
      <dt>Aptidão</dt><dd>${esc(fi.aptidao)}</dd>
      <dt>Eixo · doçura · peso</dt><dd>${esc(fi.eixo)} · ${esc(fi.doc)} · ${esc(fi.peso)}</dd>
      <dt>Td</dt><dd>${{ C: "sobe no ar carregado", S: "sobe no ar seco", N: "indiferente" }[f.td]}</dd>
      <dt>Sprays-base</dt><dd>${esc(fi.sprays_base)}</dd>
      <dt>Janelas</dt><dd>${esc(fi.janelas)}${f.janelas_estimadas ? `<span class="selo aviso">estimado</span>` : ""}${janelasHTML(nome)}</dd>
      <dt>Performance</dt><dd>~${f.longev} h · projeção ${f.proj}/5 · curva ${{ S: "saída manda", L: "linear", F: "fundo manda" }[f.curva]}${f.perf_estimada ? `<span class="selo aviso">estimado por regra</span>` : `<span class="selo">da leitura da ficha</span>`}</dd>
      <dt>Vizinhos</dt><dd>${esc(fi.vizinhos)}</dd>
      <dt>Leitura</dt><dd>${esc(fi.leitura)}</dd>
      <dt>Uso</dt><dd>${ult ? `último em ${esc(ult.data)} (${slotNome(ult.slot)}) · ${usos.length} registro${usos.length > 1 ? "s" : ""} no diário` : "sem registro no diário"}</dd>
    </dl>
  </div></div>`;
  $("#folha .folha button[data-fechar]").focus();
}
function janelasHTML(nome) {
  const js = S.janelas.get(nome) || [];
  if (!js.length) return "";
  const porFaixa = new Map(); for (const j of js) { if (!porFaixa.has(j.faixaIdx)) porFaixa.set(j.faixaIdx, []); porFaixa.get(j.faixaIdx).push(j); }
  return `<ul class="janelas">${[...porFaixa.entries()].sort((a, b) => a[0] - b[0]).map(([i, l]) => `<li>${faixaHTML(i)}: ${l.map(j => `${ROT_OC[j.ocasiao]}${j.papel !== "Também" ? ` <b>(${j.papel})</b>` : ""}`).join(", ")}</li>`).join("")}</ul>`;
}
function fecharFolha() { $("#folha").innerHTML = ""; }

// ───────────────────────── eventos ─────────────────────────
function mudarDia(fn) { const d = estadoDia(); fn(d); salvarDia(d); recalcular(); }

document.addEventListener("click", async e => {
  const b = e.target.closest("button, [data-fechar]");
  if (!b) return;
  if (b.closest("#abas")) { S.aba = b.dataset.aba; render(); window.scrollTo(0, 0); return; }
  if (b.hasAttribute("data-fechar") && (e.target === b || b.tagName === "BUTTON")) { fecharFolha(); return; }
  if (b.dataset.ficha) { abrirFicha(b.dataset.ficha); return; }
  if (b.dataset.filtro) { S.filtro = { ...S.filtro, [b.dataset.filtro]: b.dataset.v }; gravar("filtro", S.filtro); render(); return; }
  if (b.dataset.pbfaixa) { S.pbFaixa = Number(b.dataset.pbfaixa); render(); return; }
  if (b.dataset.chip) { const k = b.dataset.chip, v = b.dataset.v; mudarDia(d => { d[k] = v; }); return; }
  if (b.dataset.extra) { const v = b.dataset.extra; mudarDia(d => { d.extras = d.extras.includes(v) ? d.extras.filter(x => x !== v) : [...d.extras, v]; }); return; }
  if (b.dataset.usei) {
    const so = S.resultado.slots.find(s => (s.nome === "Dia" ? "M" : "N") === b.dataset.slot);
    abrirRegistro({ perfume: b.dataset.usei, slot: b.dataset.slot, sprays: b.dataset.ajustado, sugerido: b.dataset.sprays, ocasiao: ocasiaoDominante(so) });
    return;
  }
  if (b.dataset.descartar) { descartar(b.dataset.descartar); toast("Registro descartado."); recalcular(); return; }
  if (b.dataset.troca) {
    b.disabled = true;
    const r = await enviar({ trocaId: b.dataset.troca, tipo: b.dataset.tipo });
    toast(r.enviadas ? (b.dataset.tipo === "segunda" ? "Gravado como 2ª aplicação." : "Gravado como troca.") : `Não gravou: ${r.erro || "sem resposta"}`);
    await sincronizar({ silencioso: true }); return;
  }
  const acao = b.dataset.acao;
  if (acao === "soUm") mudarDia(d => { d.soUm = !d.soUm; });
  else if (acao === "limpar-ov") mudarDia(d => { d.override = {}; });
  else if (acao === "clima") atualizarClima();
  else if (acao === "usar-texto") mudarDia(d => { d.textoManual = $("#entrada").value; });
  else if (acao === "soltar-texto") mudarDia(d => { d.textoManual = null; });
  else if (acao === "restaurar") { salvarAjustes({}); toast("Ajustes restaurados."); render(); atualizarClima(); }
  else if (acao === "sync") sincronizar();
  else if (acao === "ler-planilha") {
    const m = $("#lerMsg"); m.textContent = "Lendo a planilha…";
    try {
      const d = await baixarPlanilha(); aplicarPlanilha(); S.sync = { estado: "ok", msg: "" };
      toast(`Planilha lida: ${lerTiers(d.tiers).length} linhas em Tiers, ${lerDiario(d.diario).length} no Diário.`); recalcular();
    } catch (err) { S.sync = { estado: "erro", msg: err.message }; m.innerHTML = `<span class="erro-txt">Falhou: ${esc(err.message)}</span>`; }
  }
  else if (acao === "salvar-spr") {
    const por = {};
    for (const l of $("#spr-por").value.split("\n")) { const m = l.match(/^(.+?)\s*=\s*([+-]?\d+)\s*$/); if (m) por[m[1].trim()] = Number(m[2]); }
    gravar("sprays_ajuste", { ativo: $("#spr-ativo").checked, geral: Number($("#spr-geral").value) || 0, por });
    toast($("#spr-ativo").checked ? "Ajuste de sprays ligado." : "Ajuste de sprays salvo (desligado)."); recalcular();
  } else if (acao === "spr-sugerir") {
    const { calibracao } = await import("./estatisticas.js");
    const cal = calibracao(fila());
    $("#spr-geral").value = String(Math.round(cal.geral));
    $("#spr-por").value = cal.por.filter(p => p.n >= 3 && Math.round(p.media) !== Math.round(cal.geral)).map(p => `${p.nome} = ${Math.round(p.media)}`).join("\n");
    toast("Preenchido com o desvio medido (frascos com 3+ registros). Revise e salve.");
  }
  else if (acao === "gerar-token") { S.tokenNovo = gerarToken(); render(); $("#aj-token").value = S.tokenNovo; $("#aj-token").type = "text"; }
  else if (acao === "copiar-token") {
    try { await navigator.clipboard.writeText(S.tokenNovo); toast("Token copiado."); }
    catch { const el = $("#aj-token"); el.type = "text"; el.select(); toast("Selecionei o token: copie manualmente."); }
  } else if (acao === "testar") {
    const m = $("#testeMsg"); m.textContent = "Testando…";
    try { const j = await chamar("ping"); toast(`Conectado à planilha “${j.planilha}”.`); sincronizar({ silencioso: true }); atualizarClima(); }
    catch (err) { m.innerHTML = `<span class="erro-txt">Falhou: ${esc(err.message)}</span>`; }
  }
});

document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.ov) { const k = el.dataset.ov, v = el.value.trim().replace(",", "."); mudarDia(d => { if (v === "") delete d.override[k]; else d.override[k] = v.toLowerCase() === "nd" ? "nd" : v; }); return; }
  if (el.id === "col-arq" || el.id === "col-faixa" || el.id === "col-oc") {
    S.filtro = { ...S.filtro, [{ "col-arq": "arq", "col-faixa": "faixa", "col-oc": "oc" }[el.id]]: el.value }; gravar("filtro", S.filtro); render(); return;
  }
  if (el.id === "testar") mudarDia(d => { d.testar = el.value.trim(); });
  if (el.id === "roupa") mudarDia(d => { d.roupa = el.value.trim(); });
});

document.addEventListener("input", e => {
  if (e.target.id === "col-q") { S.filtro = { ...S.filtro, q: e.target.value }; gravar("filtro", S.filtro); render(); }
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "formRegistro") { salvarRegistro(); return; }
  if (e.target.id !== "formAjustes") return;
  const a = {};
  for (const k of Object.keys(AJUSTES_PADRAO)) {
    const el = $("#aj-" + k); if (!el) continue;
    const v = el.value.trim();
    a[k] = typeof AJUSTES_PADRAO[k] === "number" ? Number(v.replace(",", ".")) : v;
  }
  salvarAjustes(a); S.tokenNovo = S.tokenNovo && a.token === S.tokenNovo ? S.tokenNovo : null;
  toast("Ajustes salvos."); render(); sincronizar({ silencioso: true }); atualizarClima();
});

document.addEventListener("keydown", e => { if (e.key === "Escape") fecharFolha(); });
window.addEventListener("online", () => sincronizar({ silencioso: true }));

// ───────────────────────── início ─────────────────────────
if ("serviceWorker" in navigator) {
  const jaControlado = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("sw.js").catch(() => { /* sem service worker: app funciona online */ });
  // quando um service worker novo assume, recarrega uma vez para rodar o código novo
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (jaControlado && !sessionStorage.getItem("pd.recarregou")) { sessionStorage.setItem("pd.recarregou", "1"); location.reload(); } });
}
(async () => {
  try { await carregarDados(); }
  catch (e) { $("#tela").innerHTML = `<p class="erro-txt">Não consegui carregar os dados da coleção (${esc(e.message)}).</p>`; return; }
  render();
  await Promise.all([atualizarClima(), sincronizar({ silencioso: true })]);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (estadoDia().data !== S.dataClima) atualizarClima();
    sincronizar({ silencioso: true });
  });
})();
