// main.js — orquestra as telas. Fase 2: Hoje (clima + top 10 dos dois slots) e Ajustes.
import { rodar, FAIXAS, fmtH } from "../engine/index.js";
import { ajustes, salvarAjustes, AJUSTES_PADRAO, estadoDia, salvarDia, diarioLocal, salvarDiarioLocal, hojeISO } from "./store.js";
import { buscarPrevisao, buscarMetar, derivarClima } from "./clima.js";
import { montarEntrada, OCAS_DIA, OCAS_NOITE, AMBIENTES, EXTRAS } from "./entrada.js";

const S = { aba: "hoje", frascos: [], fichas: {}, versao: {}, prev: null, prevOffline: false, prevErro: null,
  metar: null, metarMotivo: null, clima: null, resultado: null, erroMotor: null, entrada: "", carregandoClima: true };
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ROT_OC = { Lazer: "Lazer", "T.Inf": "Trab. Informal", "T.For": "Trab. Formal", "N.Inf": "Noite Informal", "N.For": "Noite Formal", "Cozy D": "Cozy Dia", "Cozy N": "Cozy Noite" };
const AMB = { rua: "rua", ac: "AC", casa: "casa" };
let toastT;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500);
}
const faixaHTML = idx => `<span class="pinta f${idx}" aria-hidden="true"></span>${FAIXAS[idx]}`;
const nf = x => (x == null || x === "" ? "—" : Number(x).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const tierHTML = t => `<span class="tier ${esc(t)}" title="Tier ${esc(t)}">${esc(t)}</span>`;

// ───────────────────────── carga ─────────────────────────
async function carregarDados() {
  const [fr, fi] = await Promise.all([fetch("data/frascos.json").then(r => r.json()), fetch("data/fichas.json").then(r => r.json())]);
  S.frascos = fr.frascos; S.versao = fr.versao; S.fichas = fi.fichas;
  $("#versao").textContent = fr.versao.playbook.replace("playbook_", "").replace(".md", "");
}

async function atualizarClima() {
  const aj = ajustes();
  S.carregandoClima = true; render();
  const [p, m] = await Promise.all([buscarPrevisao(aj.lat, aj.lon), buscarMetar(aj.backend, aj.token)]);
  S.prev = p.prev; S.prevOffline = p.offline; S.prevErro = p.erro || null;
  S.metar = m.metar; S.metarMotivo = m.motivo || null;
  S.carregandoClima = false; S.dataClima = estadoDia().data;
  recalcular();
}

function diarioRecente(data) {
  return diarioLocal().filter(r => r.data <= data).sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 120);
}

function recalcular() {
  const aj = ajustes(), dia = estadoDia(), data = dia.data;
  S.clima = derivarClima({ prev: S.prev, metar: S.metar, override: dia.override, data, aplico: aj.aplico,
    noite: dia.soUm ? null : aj.noite, tiro: aj.tiro, metarHoras: aj.metar_horas, metarTol: aj.metar_tol });
  const manhaReg = diarioLocal().find(r => r.data === data && r.slot === "M");
  S.entrada = dia.textoManual ?? montarEntrada({ data, clima: S.clima, aj, dia, manha: manhaReg?.perfume, diario: diarioRecente(data) });
  try { S.resultado = rodar(S.entrada, S.frascos); S.erroMotor = null; }
  catch (e) { S.resultado = null; S.erroMotor = e.message; }
  render();
}

// ───────────────────────── telas ─────────────────────────
function render() {
  document.querySelectorAll("#abas button").forEach(b => {
    if (b.dataset.aba === S.aba) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  const tela = $("#tela");
  tela.innerHTML = ({ hoje: telaHoje, ajustes: telaAjustes }[S.aba] || telaEmBreve)();
}

function telaHoje() {
  const dia = estadoDia(), c = S.clima;
  const dt = new Date(dia.data + "T12:00:00");
  const t0 = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const titulo = t0.charAt(0).toUpperCase() + t0.slice(1);
  if (S.carregandoClima && !c) return `<h2>${esc(titulo)}</h2><p class="nota">Buscando a previsão para ${esc(ajustes().local)}…</p>`;
  return `
  <h2>${esc(titulo)}</h2>
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
        ${campo("Tnoite", "Temp. 20–22h °C", dia.override.Tnoite)}${campo("Td", "Td °C (ou nd)", dia.override.Td, "text")}
        <label>Chuva<select data-ov="chuva"><option value="">previsão</option>${["seco", "pancadas", "contínua"].map((x, i) => `<option value="${i}" ${String(dia.override.chuva) === String(i) ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      </div>
      <div class="linha-flex" style="margin-top:10px"><button class="btn sec peq" data-acao="limpar-ov">Voltar à previsão</button><button class="btn sec peq" data-acao="clima">Atualizar previsão</button></div>
    </details>
  </section>`;
}
const campo = (k, rot, v, tipo = "text") => `<label>${rot}<input data-ov="${k}" type="${tipo}" inputmode="decimal" value="${esc(v ?? "")}" autocomplete="off"></label>`;

function chips(nome, opcoes, atual) {
  return `<div class="chips rolagem" role="group">${opcoes.map(([v, r]) => `<button class="chip" data-chip="${nome}" data-v="${v}" aria-pressed="${atual === v}">${r}</button>`).join("")}</div>`;
}

function blocoContexto(dia) {
  return `<section class="grupo" aria-label="Extras do dia">
    <div class="grupo"><span class="rot">Extras do dia</span><div class="chips rolagem" role="group">${EXTRAS.map(([v, r]) => `<button class="chip" data-extra="${v}" aria-pressed="${dia.extras.includes(v)}">${r}</button>`).join("")}
      <button class="chip" data-acao="soUm" aria-pressed="${dia.soUm}">Só um perfume hoje</button></div></div>
  </section>`;
}

function blocoSlot(s) {
  const dia = estadoDia();
  const usados = diarioLocal().filter(r => r.data === dia.data);
  const slotCod = s.nome === "Dia" ? "M" : "N";
  const usado = usados.find(r => r.slot === slotCod);
  const card = (t, i, custo = false) => {
    const ja = usado && usado.perfume === t.nome;
    return `<article class="card ${i === 0 && !custo ? "top1" : ""}">
      <span class="pos">${i + 1}</span>
      <div style="min-width:0"><button class="nome" data-ficha="${esc(t.nome)}">${esc(t.nome)}</button>${tierHTML(t.tier)}<div class="casa">${esc(t.casa)} · ${esc(t.arquetipo)}</div></div>
      <span class="score" title="Score">${t.score.toFixed(0)}</span>
      <div class="meta"><span><b>${t.sprays}</b> spray${t.sprays > 1 ? "s" : ""}${t.nota ? ` <span class="nota">(${esc(t.nota)})</span>` : ""}</span><span>vivo até <b>${t.vivo_fim ? "o fim" : "~" + fmtH(t.vivo_ate)}</b></span></div>
      <div class="pq">${esc(t.porque)}</div>
      <div class="acoes"><span class="esp"></span><button class="btn peq ${ja ? "feito" : "sec"}" data-usei="${esc(t.nome)}" data-slot="${slotCod}" data-sprays="${t.sprays}" ${usado ? "disabled" : ""}>${ja ? "✓ Registrado" : "Usei este"}</button></div>
    </article>`;
  };
  const segs = (S.resultado.segs || []).filter(g => g.fim > s.ini && g.ini < s.fim).map(g => `${fmtH(Math.max(g.ini, s.ini))}–${fmtH(Math.min(g.fim, s.fim))} ${ROT_OC[g.ocas]} (${AMB[g.amb]}${g.fechado ? ", fechado" : ""})`);
  return `<section class="grupo" aria-label="Slot ${s.nome}">
    <div class="slot-cab"><h2>${s.nome === "Dia" ? "☀︎ Slot Dia" : "☾ Slot Noite"}</h2><span class="t">${fmtH(s.ini)}→${fmtH(s.fim)}</span></div>
    ${s.nome === "Dia" ? chips("ocDia", OCAS_DIA, dia.ocDia) + chips("ambDia", AMBIENTES, dia.ambDia) : chips("ocNoite", OCAS_NOITE, dia.ocNoite) + chips("ambNoite", AMBIENTES, dia.ambNoite)}
    <p class="nota">${esc(segs.join(" · "))}</p>
    ${usado ? `<p class="nota">Registrado hoje: <b>${esc(usado.perfume)}</b>${usado.enviado ? "" : " · guardado neste aparelho"}. <button class="btn sec peq" data-desfazer="${slotCod}">Desfazer</button></p>` : ""}
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
    <datalist id="lista-frascos">${S.frascos.filter(f => f.camada === "grade" && f.tier !== "D").map(f => `<option value="${esc(f.nome)}">`).join("")}</datalist>
    <label class="campo">Entrada do modelo ${dia.textoManual != null ? `<span class="selo manual">editada à mão</span>` : ""}
      <textarea id="entrada" rows="12" spellcheck="false">${esc(S.entrada)}</textarea></label>
    <p class="nota">Mesmo formato do modelo_diario: segmentos em “Dia: 8-18 ti ac fechado; 18-19:30 rua; 19:30-23 cn casa”.</p>
    <div class="linha-flex"><button class="btn peq" data-acao="usar-texto">Rodar este texto</button>${dia.textoManual != null ? `<button class="btn sec peq" data-acao="soltar-texto">Voltar ao automático</button>` : ""}</div>
  </details>`;
}

function telaAjustes() {
  const a = ajustes();
  const c = (k, rot, tipo = "text", extra = "") => `<label>${rot}<input id="aj-${k}" type="${tipo}" value="${esc(a[k])}" ${extra} autocomplete="off"></label>`;
  return `<h2>Ajustes</h2>
  <form class="bloco" id="formAjustes">
    <h3>Local do clima</h3>
    <div class="campos">${c("local", "Nome")}${c("lat", "Latitude", "text", 'inputmode="decimal"')}${c("lon", "Longitude", "text", 'inputmode="decimal"')}</div>
    <h3>Rotina</h3>
    <div class="campos">${c("aplico", "Aplicação manhã")}${c("noite", "Aplicação noite")}${c("tiro", "Fim do dia")}${c("ac", "AC padrão °C", "text", 'inputmode="decimal"')}</div>
    <h3>Td observado (METAR Congonhas)</h3>
    <div class="campos">${c("metar_horas", "Validade (horas)", "text", 'inputmode="decimal"')}${c("metar_tol", "Tolerância vs previsão °C", "text", 'inputmode="decimal"')}</div>
    <h3>Planilha (Apps Script)</h3>
    <div class="campos">${c("backend", "URL do Web App")}<label>Token<input id="aj-token" type="password" value="${esc(a.token)}" autocomplete="off"></label></div>
    <p class="nota">O token fica só neste aparelho. Sem a URL, o app funciona com a previsão do Open-Meteo e guarda os registros aqui.</p>
    <div class="linha-flex"><button class="btn" type="submit">Salvar</button><button class="btn sec" type="button" data-acao="restaurar">Restaurar padrão</button></div>
  </form>
  <div class="bloco"><h3>Dados</h3><dl class="kv">
    <dt>Frascos</dt><dd>${S.frascos.length} (grade ${S.frascos.filter(f => f.camada === "grade" && f.tier !== "D").length})</dd>
    ${Object.entries(S.versao).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
  </dl></div>`;
}

function telaEmBreve() {
  const nomes = { registrar: "Registrar", colecao: "Coleção", playbook: "Playbook", historico: "Histórico" };
  return `<h2>${nomes[S.aba]}</h2><div class="bloco"><p class="nota">Esta tela ainda está em construção. Por enquanto, use “Usei este” na tela Hoje para registrar.</p></div>`;
}

// ───────────────────────── ficha (folha de detalhe) ─────────────────────────
function abrirFicha(nome) {
  const f = S.frascos.find(x => x.nome === nome), fi = S.fichas[nome];
  if (!f || !fi) return;
  const ultimos = diarioLocal().filter(r => r.perfume === nome).sort((a, b) => (a.data < b.data ? 1 : -1));
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
      <dt>Janelas</dt><dd>${esc(fi.janelas)}${f.janelas_estimadas ? `<span class="selo aviso">estimado</span>` : ""}</dd>
      <dt>Performance</dt><dd>~${f.longev} h · projeção ${f.proj}/5 · curva ${{ S: "saída manda", L: "linear", F: "fundo manda" }[f.curva]}${f.perf_estimada ? `<span class="selo aviso">estimado por regra</span>` : `<span class="selo">da leitura da ficha</span>`}</dd>
      <dt>Vizinhos</dt><dd>${esc(fi.vizinhos)}</dd>
      <dt>Leitura</dt><dd>${esc(fi.leitura)}</dd>
      <dt>Último uso</dt><dd>${ultimos.length ? `${esc(ultimos[0].data)} (${ultimos.length} registro${ultimos.length > 1 ? "s" : ""} neste aparelho)` : "sem registro neste aparelho"}</dd>
    </dl>
  </div></div>`;
  $("#folha .folha button[data-fechar]").focus();
}
function fecharFicha() { $("#folha").innerHTML = ""; }

// ───────────────────────── eventos ─────────────────────────
function mudarDia(fn) { const d = estadoDia(); fn(d); salvarDia(d); recalcular(); }

document.addEventListener("click", e => {
  const b = e.target.closest("button, [data-fechar]");
  if (!b) return;
  if (b.closest("#abas")) { S.aba = b.dataset.aba; render(); window.scrollTo(0, 0); return; }
  if (b.hasAttribute("data-fechar") && (e.target === b || b.tagName === "BUTTON")) { fecharFicha(); return; }
  if (b.dataset.ficha) { abrirFicha(b.dataset.ficha); return; }
  if (b.dataset.chip) { const k = b.dataset.chip, v = b.dataset.v; mudarDia(d => { d[k] = v; }); return; }
  if (b.dataset.extra) { const v = b.dataset.extra; mudarDia(d => { d.extras = d.extras.includes(v) ? d.extras.filter(x => x !== v) : [...d.extras, v]; }); return; }
  if (b.dataset.usei) { registrarUso(b.dataset.usei, b.dataset.slot, Number(b.dataset.sprays)); return; }
  if (b.dataset.desfazer) {
    const d = estadoDia().data, slot = b.dataset.desfazer;
    salvarDiarioLocal(diarioLocal().filter(r => !(r.data === d && r.slot === slot && !r.enviado)));
    toast("Registro desfeito."); recalcular(); return;
  }
  const acao = b.dataset.acao;
  if (acao === "soUm") mudarDia(d => { d.soUm = !d.soUm; });
  else if (acao === "limpar-ov") mudarDia(d => { d.override = {}; });
  else if (acao === "clima") atualizarClima();
  else if (acao === "usar-texto") mudarDia(d => { d.textoManual = $("#entrada").value; });
  else if (acao === "soltar-texto") mudarDia(d => { d.textoManual = null; });
  else if (acao === "restaurar") { salvarAjustes({}); toast("Ajustes restaurados."); render(); atualizarClima(); }
});

document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.ov) { const k = el.dataset.ov, v = el.value.trim().replace(",", "."); mudarDia(d => { if (v === "") delete d.override[k]; else d.override[k] = v.toLowerCase() === "nd" ? "nd" : v; }); return; }
  if (el.id === "testar") mudarDia(d => { d.testar = el.value.trim(); });
  if (el.id === "roupa") mudarDia(d => { d.roupa = el.value.trim(); });
});

document.addEventListener("submit", e => {
  if (e.target.id !== "formAjustes") return;
  e.preventDefault();
  const a = {};
  for (const k of Object.keys(AJUSTES_PADRAO)) {
    const el = $("#aj-" + k); if (!el) continue;
    const v = el.value.trim();
    a[k] = typeof AJUSTES_PADRAO[k] === "number" ? Number(v.replace(",", ".")) : v;
  }
  salvarAjustes(a); toast("Ajustes salvos."); atualizarClima();
});

document.addEventListener("keydown", e => { if (e.key === "Escape") fecharFicha(); });

function registrarUso(nome, slot, sprays) {
  const d = estadoDia().data, c = S.clima;
  const so = S.resultado.slots.find(s => (s.nome === "Dia" ? "M" : "N") === slot);
  const horas = new Map(); for (const p of so.passos) horas.set(p.ocas, (horas.get(p.ocas) || 0) + 1);
  const ocas = [...horas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const f = slot === "M" ? c.faixaDia : c.faixaNoite;
  const lista = diarioLocal();
  if (lista.some(r => r.data === d && r.slot === slot)) { toast("Já há registro neste slot hoje."); return; }
  lista.push({ data: d, slot, perfume: nome, ocasiao: ocas, temp: f ? String(f.T).replace(".", ",") : "",
    td: (c.Td.tipo === "observado" || c.Td.tipo === "manual") && c.Td.v != null ? String(c.Td.v).replace(".", ",") : "", sprays: String(sprays), notaDia: "", obs: "", enviado: false });
  salvarDiarioLocal(lista);
  toast(`Registrado: ${nome} · ${slot === "M" ? "Dia" : "Noite"}.`);
  recalcular();
}

// ───────────────────────── início ─────────────────────────
(async () => {
  try { await carregarDados(); }
  catch (e) { $("#tela").innerHTML = `<p class="erro-txt">Não consegui carregar os dados da coleção (${esc(e.message)}).</p>`; return; }
  render();
  await atualizarClima();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && estadoDia().data !== S.dataClima) atualizarClima(); });
})();
