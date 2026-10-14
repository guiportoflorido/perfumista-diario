// amostras.js — aba Amostras: entradas e saídas de amostras e decants, guardadas na aba "Amostras" da planilha.
// A avaliação (tier, arquétipo, resumo, wishlist, notas, posse) não é duplicada: vive na aba Mercado e a ligação
// é pela Casa + Perfume (mesma chave do Mercado). Status: Pendente (a testar) · Em teste · Realizado (testada) · Esgotado (saiu).
import { esc, tierHTML, ordsDe, compararMulti, cmpValor, cabOrd, painelOrd } from "./util.js";
import { arqTag, arqIcone } from "./icones.js";
import { chamar } from "./api.js";
import { ler, gravar } from "./store.js";
import { chave, POSSES_EDIT, celTier, celPosse, celArq, celWish, posseRot } from "./mercado.js";
import { fotoFicha } from "./fotos.js";

export const COLS = ["ID", "Casa", "Perfume", "Tipo", "Volume (ml)", "Origem", "Status", "Entrada", "Saída", "Motivo saída", "Impressão", "Obs", "Atualizado em", "Dono"];
export const DONOS = ["Gui", "Bia"];
export const TIPOS = ["Amostra", "Decant"];
export const STATUS = ["Pendente", "Em teste", "Realizado", "Esgotado"];
export const ROT_STATUS = { Pendente: "Pendente · a testar", "Em teste": "Em teste · testando agora", Realizado: "Realizado · testada", Esgotado: "Esgotado · saiu" };
export const MOTIVOS = ["", "Acabou", "Doada", "Trocada", "Descartada", "Perdida"];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayNum = iso => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
export const novoId = () => "am" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ───────────────────────── dados ─────────────────────────
/** Linhas da aba Amostras → objetos. */
export function deLinhas(linhas) {
  if (!linhas || linhas.length < 2) return [];
  const c = linhas[0], i = n => c.indexOf(n), v = (r, n) => (i(n) >= 0 ? String(r[i(n)] ?? "").trim() : "");
  return linhas.slice(1).filter(r => v(r, "ID") && v(r, "Perfume")).map(r => ({
    id: v(r, "ID"), casa: v(r, "Casa"), nome: v(r, "Perfume"), tipo: v(r, "Tipo") || "Amostra", ml: v(r, "Volume (ml)"),
    origem: v(r, "Origem"), status: STATUS.includes(v(r, "Status")) ? v(r, "Status") : "Pendente", entrada: v(r, "Entrada"),
    saida: v(r, "Saída"), motivo: v(r, "Motivo saída"), impressao: v(r, "Impressão"), obs: v(r, "Obs"), atualizado: v(r, "Atualizado em"),
    dono: DONOS.includes(v(r, "Dono")) ? v(r, "Dono") : "" }));
}

/** Liga cada amostra ao perfume da aba Mercado (com tier/posse da aba Tiers já aplicados). `m` = null se não achar. */
export function juntar(amostras, mercado) {
  const m = new Map((mercado || []).map(p => [chave(p.casa, p.nome), p]));
  return amostras.map(a => ({ ...a, m: m.get(chave(a.casa, a.nome)) || null }));
}

const mlNum = s => { const n = Number(String(s || "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
export function resumo(lista) {
  const n = s => lista.filter(a => a.status === s).length;
  const mao = lista.filter(a => a.status !== "Esgotado");
  return { pendente: n("Pendente"), emTeste: n("Em teste"), realizado: n("Realizado"), esgotado: n("Esgotado"), mao: mao.length,
    ml: Math.round(mao.reduce((s, a) => s + mlNum(a.ml), 0) * 10) / 10 };
}

export const diasDesde = (iso, hoje = hojeISO()) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? dayNum(hoje) - dayNum(iso) : null);

/** Perfumes com posse "Amostra" (Tiers/Mercado) sem nenhuma linha na aba Amostras: candidatos a lançar. */
export function semRegistro(amostras, mercado) {
  const tem = new Set(amostras.map(a => chave(a.casa, a.nome)));
  return (mercado || []).filter(p => p.posse === "Amostra" && !tem.has(chave(p.casa, p.nome)))
    .sort((a, b) => a.casa.localeCompare(b.casa, "pt") || a.nome.localeCompare(b.nome, "pt"));
}

const ORD_STATUS = { "Em teste": 0, Pendente: 1, Realizado: 2, Esgotado: 3 };
const ordemTier = t => (t && "SABCD".includes(t) ? "SABCD".indexOf(t) : "");
const ordemPosse = p => ({ "Frasco Gui": 0, "Frasco Bia": 1, "Amostra": 2, "Amostra Bia": 3, "Avaliado": 4 }[p] ?? (p ? 5 : ""));
/** Dias da amostra: pendente = esperando teste desde a entrada; em mãos = desde a entrada; esgotada = entrada → saída. */
export function dias(a, hoje = hojeISO()) {
  if (a.status === "Esgotado" && a.entrada && a.saida) return diasDesde(a.entrada, a.saida);
  return diasDesde(a.entrada, hoje);
}

// padrão (sem ordenação escolhida): em teste primeiro, depois pendentes (a mais antiga antes); depois a mais recente primeiro
function padrao(a, b) {
  return ORD_STATUS[a.status] - ORD_STATUS[b.status]
    || (a.status === "Pendente" ? (a.entrada || "9").localeCompare(b.entrada || "9") : (b.saida || b.entrada || "").localeCompare(a.saida || a.entrada || ""))
    || a.nome.localeCompare(b.nome, "pt");
}

export function filtrar(lista, f = {}, { usosDe = null, hoje = hojeISO() } = {}) {
  const q = norm(f.q);
  const valor = (k, a) => ({ dono: a.dono, status: ORD_STATUS[a.status], tier: ordemTier(a.m?.tier), posse: ordemPosse(a.m?.posse), wish: a.m ? (a.m.wish ? 0 : 1) : "",
    arquetipo: a.m?.arquetipo || "", ml: a.ml ? mlNum(a.ml) : "", dias: dias(a, hoje) ?? "", usos: usosDe ? usosDe(a) : "" }[k] ?? a[k] ?? "");
  const res = lista.filter(a => {
    if (f.status === "mao" ? a.status === "Esgotado" : f.status && a.status !== f.status) return false;
    if (f.tipo && a.tipo !== f.tipo) return false;
    if (f.casa && a.casa !== f.casa) return false;
    if (f.dono && a.dono !== f.dono) return false;
    if (f.arq === "sem" ? a.m?.arquetipo : f.arq && a.m?.arquetipo !== f.arq) return false;
    if (f.tier === "sem" ? a.m?.tier : f.tier && a.m?.tier !== f.tier) return false;
    if (f.posse === "sem" ? a.m?.posse : f.posse && a.m?.posse !== f.posse) return false;
    if (f.wish === "sim" ? !a.m?.wish : f.wish === "nao" && a.m?.wish) return false;
    if (q && !norm(`${a.nome} ${a.casa} ${a.origem} ${a.impressao} ${a.obs} ${a.m?.arquetipo || ""}`).includes(q)) return false;
    return true;
  });
  // sem escolha: Status ↑ (empates pelo padrão: pendente mais antiga primeiro)
  return res.sort(compararMulti(ordsDe(f, "status"), (k, a, b) => cmpValor(valor(k, a), valor(k, b)), padrao));
}

/** Coerência de status e saída: data de saída ⇒ Esgotado; Esgotado sem data ⇒ saída hoje; voltar de Esgotado limpa a saída. */
export function normalizar(c, hoje = hojeISO()) {
  const o = { ...c };
  if (o.saida && o.status !== "Esgotado") o.status = "Esgotado";
  if (o.status === "Esgotado" && !o.saida) o.saida = hoje;
  if (o.status !== "Esgotado") { o.saida = ""; o.motivo = ""; }
  return o;
}

const PARA_COL = { casa: "Casa", nome: "Perfume", tipo: "Tipo", ml: "Volume (ml)", origem: "Origem", status: "Status", entrada: "Entrada",
  saida: "Saída", motivo: "Motivo saída", impressao: "Impressão", obs: "Obs", dono: "Dono" };

/** Campos da aba Amostras que mudaram (nomes das colunas). Para amostra nova devolve todos os preenchidos. */
export function camposAmostra(velho, novo, hoje = hojeISO()) {
  const n = normalizar(novo, hoje), out = {};
  for (const [k, col] of Object.entries(PARA_COL)) {
    const v = String(n[k] ?? "").trim();
    if (v !== String(velho?.[k] ?? "").trim()) out[col] = v;
  }
  return out;
}

/** Campos da avaliação que você mexeu (`mexidos`) e que diferem do Mercado. Nada que você não tocou é regravado. */
export function camposAvaliacaoMexidos(m, f, mexidos) {
  const col = { tier: "Tier", arq: "Arquétipo", posse: "Posse", resumo: "Resumo", notas: "Notas", wish: "Wishlist" };
  const todos = camposAvaliacao(m, f), ok = new Set([...mexidos].map(k => col[k]));
  return Object.fromEntries(Object.entries(todos).filter(([k]) => ok.has(k)));
}

/** Campos da avaliação (aba Mercado) que mudaram. Tier e Posse também vão para a aba Tiers (o backend cuida). */
export function camposAvaliacao(m, f) {
  const novo = { Tier: f.tier, "Arquétipo": f.arq, Posse: f.posse, Resumo: f.resumo, Notas: f.notas, Wishlist: f.wish ? "✓" : "" };
  const velho = { Tier: m?.tier, "Arquétipo": m?.arquetipo, Posse: m?.posse, Resumo: m?.resumo, Notas: m?.notas, Wishlist: m?.wish ? "✓" : "" };
  return Object.fromEntries(Object.entries(novo).filter(([k, v]) => v !== undefined && String(v).trim() !== String(velho[k] ?? "").trim()).map(([k, v]) => [k, String(v).trim()]));
}

// ───────────────────────── planilha ─────────────────────────
export const cacheAmostras = () => ler("amostrasPlanilha", null);
export async function baixarAmostras() {
  const j = await chamar("amostras", {}, { timeoutMs: 25000 });
  gravar("amostrasPlanilha", j.amostras);
  return j.amostras;
}
export const adicionarAmostra = campos => chamar("adicionarAmostra", { campos }, { timeoutMs: 25000 });
export const editarAmostra = (id, campos) => chamar("editarAmostra", { id, campos }, { timeoutMs: 25000 });
export const removerAmostra = id => chamar("removerAmostra", { id }, { timeoutMs: 25000 });

// ───────────────────────── tela ─────────────────────────
const SEL_STATUS = { Pendente: "pend", "Em teste": "teste", Realizado: "ok", Esgotado: "esg" };
const op = (v, r, at) => `<option value="${esc(v)}" ${String(at ?? "") === String(v) ? "selected" : ""}>${esc(r)}</option>`;
const dataBR = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");

export function telaAmostras({ lista, filtro, configurado, existe, erro, sem, usosDe, hoje = hojeISO(), editavel = false, arquetipos = [] }) {
  if (!configurado) return `<div class="bloco"><p class="nota">As amostras ficam numa aba <b>Amostras</b> da planilha. Conecte a planilha em Ajustes para começar.</p></div>`;
  if (!lista) return `<div class="bloco"><p class="nota">${erro ? `<span class="erro-txt">Não consegui ler a aba Amostras: ${esc(erro)}</span>` : "Carregando as amostras…"}</p></div>`;
  const r = resumo(lista), res = filtrar(lista, filtro, { usosDe, hoje });
  const chip = (v, rot) => `<button class="chip" data-am="status" data-v="${v}" aria-pressed="${(filtro.status || "") === v}">${rot}</button>`;
  return `
  <div class="linha-flex"><p class="nota" style="flex:1">${existe ? "Lido da aba <b>Amostras</b> da planilha." : "A aba <b>Amostras</b> é criada na planilha na primeira entrada."} Avaliação (tier, arquétipo…) é a da aba Mercado.</p>
    <button class="btn peq" data-acao="nova-amostra">+ Entrada</button></div>
  ${erro ? `<p class="nota erro-txt">Planilha indisponível (${esc(erro)}): mostrando a última cópia.</p>` : ""}
  <div class="kpis k4">
    <div class="kpi"><span class="v">${r.pendente}</span><span class="l">pendentes (a testar)</span></div>
    <div class="kpi"><span class="v">${r.emTeste}</span><span class="l">em teste</span></div>
    <div class="kpi"><span class="v">${r.realizado}</span><span class="l">testadas, em mãos</span></div>
    <div class="kpi"><span class="v">${r.esgotado}</span><span class="l">esgotadas / saíram</span></div>
  </div>
  <p class="nota">${r.mao} em mãos${r.ml ? ` · ${String(r.ml).replace(".", ",")} ml no total` : ""}.</p>
  <div class="bloco">
    <input type="search" id="am-q" placeholder="Buscar perfume, casa, origem ou impressão" value="${esc(filtro.q || "")}" aria-label="Buscar amostras">
    <div class="chips rolagem">${chip("", "Todas")}${chip("mao", "Em mãos")}${STATUS.map(s => chip(s, s)).join("")}</div>
    <div class="campos">
      <label>Dono<select id="amf-dono">${op("", "Gui e Bia", filtro.dono)}${op("Gui", "G · Gui", filtro.dono)}${op("Bia", "B · Bia", filtro.dono)}</select></label>
      <label>Casa<select id="amf-casa">${op("", "Todas", filtro.casa)}${[...new Set(lista.map(a => a.casa))].sort((x, y) => x.localeCompare(y, "pt")).map(c => op(c, c, filtro.casa)).join("")}</select></label>
      <label>Arquétipo<select id="amf-arq">${op("", "Todos", filtro.arq)}${arquetipos.map(x => op(x.nome, x.nome, filtro.arq)).join("")}${op("sem", "Sem arquétipo", filtro.arq)}</select></label>
      <label>Tier<select id="amf-tier">${op("", "Todos", filtro.tier)}${["S", "A", "B", "C", "D"].map(t => op(t, `Tier ${t}`, filtro.tier)).join("")}${op("sem", "Sem tier", filtro.tier)}</select></label>
      <label>Posse (Mercado)<select id="amf-posse">${op("", "Todas", filtro.posse)}${POSSES_EDIT.filter(Boolean).map(p => op(p, posseRot(p), filtro.posse)).join("")}${op("sem", "Sem posse", filtro.posse)}</select></label>
      <label>Wishlist<select id="amf-wish">${op("", "Todos", filtro.wish)}${op("sim", "Só wishlist", filtro.wish)}${op("nao", "Fora da wishlist", filtro.wish)}</select></label>
      <label>Tipo<select id="am-tipo">${op("", "Amostra e decant", filtro.tipo)}${TIPOS.map(t => op(t, t, filtro.tipo)).join("")}</select></label>
    </div>
    <p class="nota">${res.length} de ${lista.length}.${["dono", "casa", "arq", "tier", "posse", "wish", "tipo", "q", "status"].some(k => filtro[k]) ? ` <button class="btn sec peq" data-acao="am-limpar">Limpar filtros</button>` : ""}</p>
  </div>
  ${res.length ? tabela(res, filtro, { usosDe, hoje, editavel, arquetipos })
    : `<div class="bloco"><p class="vazio">${lista.length ? "Nada com esses filtros." : "Nenhuma amostra lançada ainda. Toque em “+ Entrada”."}</p></div>`}
  ${sem.length ? `<details class="bloco"><summary>Posse “Amostra” na aba Tiers sem lançamento aqui · ${sem.length}</summary>
    <p class="nota">Toque para lançar a entrada (data e volume ficam por sua conta: não invento).</p>
    <div class="lista">${sem.map(p => `<button class="card compacto merc" data-am-nova="${esc(p.casa + "||" + p.nome)}"><span class="pos">${p.tier ? tierHTML(p.tier) : "+"}</span>
      <div style="min-width:0"><b>${esc(p.nome)}</b><div class="casa">${esc(p.casa)}${p.arquetipo ? ` · ${esc(p.arquetipo)}` : ""}</div></div><span></span></button>`).join("")}</div>
  </details>` : ""}`;
}

// colunas da tabela (formato do Mercado): chave, rótulo
export const COLUNAS = [["status", "Status"], ["dono", "Dono"], ["tier", "Tier"], ["wish", "Wishlist"], ["arquetipo", "Arquétipo"], ["posse", "Posse"],
  ["tipo", "Tipo"], ["ml", "ml"], ["origem", "Origem"], ["entrada", "Entrada"], ["dias", "Dias"], ["saida", "Saída"], ["motivo", "Motivo"],
  ["usos", "Usos"], ["impressao", "Impressão"], ["obs", "Obs"]];

function tabela(linhas, f, { usosDe, hoje, editavel, arquetipos }) {
  const ords = ordsDe(f, "status"), btn = (k, r) => cabOrd(k, r, ords, "am-ord");
  const th = ([k, r]) => `<th class="c-${k}" scope="col">${btn(k, r)}</th>`;
  const td = (k, v) => `<td class="c-${k}">${v}</td>`;
  const tx = (k, v) => `<td class="c-${k}"><div class="clamp">${esc(v || "")}</div></td>`;
  return `${painelOrd(ords, [["casa", "Casa"], ["nome", "Perfume"], ...COLUNAS], "am")}
  <div class="tabelao am-tab" role="region" aria-label="Tabela de amostras" tabindex="0"><table>
    <thead><tr><th class="c-n" scope="col">#</th><th class="c-casa" scope="col">${btn("casa", "Casa")}</th><th class="c-nome" scope="col">${btn("nome", "Perfume")}</th>${COLUNAS.map(th).join("")}</tr></thead>
    <tbody>${linhas.map((a, i) => {
      const m = a.m, id = m ? m.casa + "||" + m.nome : "", ed = editavel && m, d = dias(a, hoje), usos = usosDe ? usosDe(a) : 0;
      const sufDias = a.status === "Pendente" ? " esperando" : a.status === "Em teste" ? " desde a entrada" : a.status === "Esgotado" ? " em mãos" : "";
      return `<tr data-amostra="${esc(a.id)}" tabindex="0" class="am-${SEL_STATUS[a.status]}">
      ${td("n", i + 1)}${td("casa", esc(a.casa))}${td("nome", esc(a.nome))}
      ${td("status", `<label class="ed am-st"><span class="sr">Status de ${esc(a.nome)}</span><select data-am-status="${esc(a.id)}">${STATUS.map(s => op(s, s, a.status)).join("")}</select></label>`)}
      ${td("dono", `<label class="ed am-dono"><span class="sr">Dono de ${esc(a.nome)}</span><select data-am-dono="${esc(a.id)}">${op("", "–", a.dono)}${op("Gui", "G", a.dono)}${op("Bia", "B", a.dono)}</select></label>`)}
      ${td("tier", ed ? celTier(m, id) : m?.tier ? tierHTML(m.tier) : `<span class="tier sem">–</span>`)}
      ${td("wish", ed ? celWish(m, id) : m?.wish ? `<span class="estrela" title="Na wishlist">★</span>` : "")}
      ${td("arquetipo", ed ? celArq(m, id, arquetipos) : m ? arqTag(m.arquetipo, 14) : `<span class="selo aviso">fora do Mercado</span>`)}
      ${td("posse", ed ? celPosse(m, id) : esc(posseRot(m?.posse || "") || "—"))}
      ${td("tipo", esc(a.tipo))}${td("ml", esc(a.ml))}${tx("origem", a.origem)}
      ${td("entrada", dataBR(a.entrada))}${td("dias", d == null ? "" : `${d} d${sufDias}`)}${td("saida", dataBR(a.saida))}${td("motivo", esc(a.motivo))}
      ${td("usos", usos || "")}${tx("impressao", a.impressao)}${tx("obs", a.obs)}
    </tr>`; }).join("")}</tbody></table></div>
  <p class="nota">Arraste para o lado para ver todas as colunas. Status muda direto na tabela${editavel ? "; Tier, Wishlist, Arquétipo e Posse também (gravam na aba Mercado, e tier/posse na aba Tiers)" : ""}. Toque no nome para o resto. Toque no cabeçalho para ordenar.</p>`;
}

/** Ficha de entrada/edição: dados da amostra + avaliação (aba Mercado). */
export function fichaAmostra(a, { arquetipos, nomes, novo, podeAvaliar, confirmarRemover = false, usos = 0, hoje = hojeISO() }) {
  const m = a.m;
  const txt = (id, v, extra = "") => `<input id="${id}" value="${esc(v ?? "")}" autocomplete="off" ${extra}>`;
  const sel = (id, opcoes, at, extra = "") => `<select id="${id}" ${extra}>${opcoes.map(([v, r]) => op(v, r, at)).join("")}</select>`;
  const posse = m?.posse ?? "", possePadrao = novo && (!posse || posse === "Avaliado") ? "Amostra" : posse;
  const posses = POSSES_EDIT.map(x => [x, x || "—"]).concat(!posse || POSSES_EDIT.includes(posse) ? [] : [[posse, posse]]);
  return `<div class="linha-flex">${m?.arquetipo ? `<span class="ficha-ic">${arqIcone(m.arquetipo, 34)}</span>` : ""}<h2 id="fichaT">${novo ? "Entrada de amostra" : esc(a.nome)}</h2>${m?.tier && !novo ? tierHTML(m.tier) : ""}<span class="esp"></span><button class="btn sec peq" data-fechar>Fechar</button></div>
    ${novo ? "" : fotoFicha(m || {}, { editavel: Boolean(podeAvaliar && m), id: m ? m.casa + "||" + m.nome : "", motivo: m ? "" : "Sem linha na aba Mercado: a foto fica no perfume do Mercado." })}
    ${novo ? `<p class="nota">Vai para a aba Amostras da planilha. Mesma casa e nome da aba Mercado ligam a avaliação.</p>`
      : `<p class="nota">${esc(a.casa)}${a.atualizado ? ` · editada em ${esc(a.atualizado)}` : ""}${usos ? ` · ${usos} uso${usos > 1 ? "s" : ""} no diário` : ""}</p>`}
    <form class="bloco" id="formAmostra" data-id="${esc(a.id || "")}" data-novo="${novo ? 1 : ""}">
      <h3>Amostra</h3>
      <div class="campos">
        <label>Perfume${txt("am-nome", a.nome, 'list="am-nomes" required')}</label>
        <label>Casa${txt("am-casa", a.casa, "required")}</label>
        <label>Tipo${sel("am-tipo-f", TIPOS.map(t => [t, t]), a.tipo || "Amostra")}</label>
        <label>Dono${sel("am-dono", [["Gui", "Gui"], ["Bia", "Bia"], ...(novo || a.dono ? [] : [["", "—"]])], a.dono || (novo ? "Gui" : ""))}</label>
        <label>Volume (ml)${txt("am-ml", a.ml, 'inputmode="decimal"')}</label>
        <label class="largo">Origem (loja, pessoa, brinde)${txt("am-origem", a.origem)}</label>
        <label>Entrada${txt("am-entrada", a.entrada || (novo ? hoje : ""), `type="date" max="${hoje}"`)}</label>
        <label>Status${sel("am-status", STATUS.map(s => [s, s]), a.status || "Pendente")}</label>
        <label>Saída${txt("am-saida", a.saida, `type="date" max="${hoje}"`)}</label>
        <label>Motivo da saída${sel("am-motivo", MOTIVOS.map(x => [x, x || "—"]), a.motivo || "")}</label>
        <label class="largo">Impressão do teste<textarea id="am-impressao" rows="3">${esc(a.impressao || "")}</textarea></label>
        <label class="largo">Obs${txt("am-obs", a.obs)}</label>
      </div>
      <datalist id="am-nomes">${nomes.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <p class="nota">Pendente = a testar · Em teste = testando agora · Realizado = testada, ainda em mãos · Esgotado = acabou ou saiu. Data de saída marca Esgotado; Esgotado sem data usa hoje. Voltar para outro status limpa a saída.</p>
      <h3>Avaliação · aba Mercado</h3>
      ${!podeAvaliar ? `<p class="nota">A aba Mercado ainda não existe na planilha: crie-a na aba Mercado do app para avaliar daqui.</p>`
        : `${m ? "" : `<label class="linha-flex"><input type="checkbox" id="av-add" checked> Adicionar este perfume à aba Mercado (não está lá)</label>`}
      <div class="campos">
        <label>Tier${sel("av-tier", [["", "sem tier"], ...["S", "A", "B", "C", "D"].map(t => [t, t])], m?.tier || "")}</label>
        <label>Arquétipo${sel("av-arq", [["", "—"], ...arquetipos.map(x => [x.nome, x.nome])], m?.arquetipo || "")}</label>
        <label>Posse${sel("av-posse", posses, possePadrao, possePadrao !== posse ? 'data-mexido="1"' : "")}</label>
        <label class="largo">Resumo${`<textarea id="av-resumo" rows="2">${esc(m?.resumo || "")}</textarea>`}</label>
        <label class="largo">Notas (suas)${`<textarea id="av-notas" rows="2">${esc(m?.notas || "")}</textarea>`}</label>
      </div>
      <label class="linha-flex"><input type="checkbox" id="av-wish" ${m?.wish ? "checked" : ""}> Wishlist</label>
      <p class="nota">Só o que você mexer aqui é gravado na aba Mercado; tier e posse também vão para a aba Tiers (fonte única de tier). Tier é decisão sua: o app não sugere.</p>`}
      <div class="linha-flex"><button class="btn" type="submit">${novo ? "Lançar entrada" : "Salvar"}</button><span class="esp"></span>
        ${novo ? "" : `<button class="btn ${confirmarRemover ? "perigo" : "sec"} peq" type="button" data-acao="remover-amostra">${confirmarRemover ? "Confirmar exclusão" : "Excluir lançamento"}</button>`}</div>
      ${confirmarRemover ? `<p class="nota erro-txt">Apaga a linha da aba Amostras (para lançamento errado). Para registrar que acabou ou saiu, use Status Esgotado. A aba Mercado não muda. Toque de novo para confirmar.</p>` : ""}
    </form>`;
}
