// mercado.js — aba Mercado: base da avaliação v51 (1.205 perfumes, inclusive os da coleção) guardada na aba
// "Mercado" da planilha, com edição. Tier e posse da aba Tiers sempre vencem na exibição (fonte única de tier).
import { esc, tierHTML, ordsDe, compararMulti, cmpValor, cabOrd, painelOrd } from "./util.js";
import { arqTag, arqIcone } from "./icones.js";
import { chamar } from "./api.js";
import { ler, gravar } from "./store.js";

export const COLS = ["Casa", "Perfume", "Tier", "Posse", "Arquétipo", "Resumo", "Topo", "Coração", "Base", "Nariz", "Wishlist", "Atualizado em"];
export const POSSES_EDIT = ["", "Frasco Gui", "Frasco Bia", "Amostra", "Amostra Bia", "Avaliado", "a confirmar"];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const chave = (casa, nome) => norm(casa) + "|" + norm(nome);

// ───────────────────────── dados ─────────────────────────
/** Base do app (mercado.json) com tier/posse da aba Tiers por cima. */
export function baseComTiers(perfumes, tiers) {
  const m = new Map((tiers || []).map(t => [chave(t.casa, t.perfume), t]));
  return perfumes.map(p => {
    const t = m.get(chave(p.casa, p.nome));
    return t ? { ...p, tier: t.tier || "", posse: t.posse || p.posse, daTiers: true } : p;
  });
}

/** Linhas para criar a aba Mercado (12 colunas, mesma ordem de COLS). */
export function linhasParaCriar(perfumes, tiers) {
  return baseComTiers(perfumes, tiers).map(p => [p.casa, p.nome, p.tier || "", p.posse || "", p.arquetipo || "", p.resumo || "",
    p.topo || "", p.coracao || "", p.base || "", p.nariz || "", p.wish ? "✓" : "", ""]);
}

/** Linhas da aba Mercado → objetos; tier/posse da aba Tiers vencem. */
export function deLinhas(linhas, tiers) {
  if (!linhas || linhas.length < 2) return [];
  const c = linhas[0], i = n => c.indexOf(n);
  const objs = linhas.slice(1).filter(r => r[i("Perfume")]).map(r => ({
    casa: r[i("Casa")], nome: r[i("Perfume")], tier: (r[i("Tier")] || "").trim().toUpperCase(), posse: r[i("Posse")] || "",
    arquetipo: r[i("Arquétipo")] || "", resumo: r[i("Resumo")] || "", topo: r[i("Topo")] || "", coracao: r[i("Coração")] || "",
    base: r[i("Base")] || "", nariz: r[i("Nariz")] || "", wish: /✓|sim|x/i.test(r[i("Wishlist")] || ""), atualizado: r[i("Atualizado em")] || "",
    notas: i("Notas") >= 0 ? r[i("Notas")] || "" : "" }));
  return baseComTiers(objs, tiers);
}

export const cachePlanilha = () => ler("mercadoPlanilha", null);
export async function baixarMercado() {
  const j = await chamar("mercado", {}, { timeoutMs: 30000 });
  gravar("mercadoPlanilha", j.mercado);
  return j.mercado;
}
export async function criarNaPlanilha(linhas) {
  const j = await chamar("criarMercado", { linhas }, { timeoutMs: 60000 });
  return j.linhas;
}
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Mexe na cópia local da aba Mercado (sem baixar 1.205 linhas de novo). */
function mexerCache(fn) {
  const c = cachePlanilha();
  if (!c?.existe) return;
  fn(c.linhas, c.linhas[0]);
  gravar("mercadoPlanilha", c);
}
const garantirCol = (linhas, cab, n) => { if (!cab.includes(n)) { cab.push(n); linhas.slice(1).forEach(r => { r[cab.length - 1] = ""; }); } };

export async function editarNaPlanilha(casa, perfume, campos) {
  const j = await chamar("editarMercado", { casa, perfume, campos }, { timeoutMs: 25000 });
  mexerCache((linhas, cab) => {
    if (campos.Notas !== undefined) garantirCol(linhas, cab, "Notas");
    const k = chave(casa, perfume);
    const row = linhas.find((r, i) => i > 0 && chave(r[cab.indexOf("Casa")], r[cab.indexOf("Perfume")]) === k);
    if (row) { for (const [n, v] of Object.entries(campos)) if (cab.includes(n)) row[cab.indexOf(n)] = String(v); row[cab.indexOf("Atualizado em")] = hojeISO(); }
  });
  return j;
}

export async function adicionarNaPlanilha(campos) {
  const j = await chamar("adicionarMercado", { campos }, { timeoutMs: 25000 });
  mexerCache((linhas, cab) => {
    if (campos.Notas) garantirCol(linhas, cab, "Notas");
    linhas.push(cab.map(n => (n === "Atualizado em" ? hojeISO() : String(campos[n] ?? ""))));
  });
  return j;
}

export async function removerNaPlanilha(casa, perfume) {
  const j = await chamar("removerMercado", { casa, perfume }, { timeoutMs: 25000 });
  mexerCache((linhas, cab) => {
    const k = chave(casa, perfume), i = linhas.findIndex((r, n) => n > 0 && chave(r[cab.indexOf("Casa")], r[cab.indexOf("Perfume")]) === k);
    if (i > 0) linhas.splice(i, 1);
  });
  return j;
}

// ───────────────────────── filtros ─────────────────────────
const ordemTier = t => (t && "SABCD".includes(t) ? "SABCD".indexOf(t) : 9);
const POSSES_FILTRO = [["", "Toda posse"], ["Frasco Gui", "Na coleção"], ["Frasco Bia", "Frasco Bia"], ["amostra", "Amostras"], ["nao", "Não tenho"]];

export function filtrar(lista, f) {
  const q = norm(f.q);
  return lista.filter(p => {
    if (f.tier === "sem" ? p.tier : f.tier && p.tier !== f.tier) return false;
    if (f.posse === "amostra" ? !/amostra/i.test(p.posse) : f.posse === "nao" ? /frasco/i.test(p.posse) : f.posse && p.posse !== f.posse) return false;
    if (f.arq && p.arquetipo !== f.arq) return false;
    const w = f.wish === "1" ? "sim" : f.wish;   // "1" = valor salvo pela versão anterior
    if (w === "sim" && !p.wish) return false;
    if (w === "nao" && p.wish) return false;
    if (q && !norm(`${p.nome} ${p.casa} ${p.nariz} ${p.resumo} ${p.topo} ${p.coracao} ${p.base}`).includes(q)) return false;
    return true;
  }).sort(comparador(ordsDe(f, "tier")));
}

// colunas da tabela (formato do TABELAO): chave do objeto, rótulo, ordenável
export const COLUNAS = [["posse", "Posse"], ["tier", "Tier"], ["wish", "Wishlist"], ["arquetipo", "Arquétipo"],
  ["resumo", "Resumo"], ["topo", "Topo"], ["coracao", "Coração"], ["base", "Base"]];
const ordemPosse = p => ({ "Frasco Gui": 0, "Frasco Bia": 1, "Amostra": 2, "Amostra Bia": 3, "Avaliado": 4 }[p] ?? (p ? 5 : 6));
function comparador(ords) {
  const valor = (k, p) => ({ tier: p.tier ? ordemTier(p.tier) : "", posse: p.posse ? ordemPosse(p.posse) : "", wish: p.wish ? 0 : 1 }[k] ?? p[k]);
  const padrao = (a, b) => ordemTier(a.tier) - ordemTier(b.tier) || a.casa.localeCompare(b.casa, "pt") || a.nome.localeCompare(b.nome, "pt");
  return compararMulti(ords, (k, a, b) => cmpValor(valor(k, a), valor(k, b)), padrao);
}

// ───────────────────────── tela ─────────────────────────
export function telaMercado({ lista, fonte, arquetipos, filtro, limite, podeCriar, criando }) {
  if (!lista) return `<div class="bloco"><p class="nota">Carregando a base…</p></div>`;
  const comTier = lista.filter(p => p.tier).length, meus = lista.filter(p => p.posse === "Frasco Gui").length, wish = lista.filter(p => p.wish).length;
  const res = filtrar(lista, filtro);
  const porArq = arquetipos.map(a => ({ a, merc: lista.filter(p => p.arquetipo === a.nome).length, meus: lista.filter(p => p.arquetipo === a.nome && p.posse === "Frasco Gui").length }));
  const maxM = Math.max(...porArq.map(x => x.merc), 1);
  const op = (v, r, at) => `<option value="${esc(v)}" ${String(at ?? "") === String(v) ? "selected" : ""}>${esc(r)}</option>`;
  return `
  ${fonte === "planilha" ? `<div class="linha-flex"><p class="nota" style="flex:1">Lido da aba <b>Mercado</b> da planilha. Toque num perfume para ver, editar ou remover.</p><button class="btn peq" data-acao="novo-mercado">+ Novo perfume</button></div>`
    : podeCriar ? `<div class="bloco destaque"><h3>Editar exige a aba Mercado na planilha</h3>
        <p class="nota">Crio na planilha “Diário de Uso” uma aba <b>Mercado</b> com os ${lista.length} perfumes (tier e posse da aba Tiers, resto da avaliação v51). Depois disso, o que você editar aqui fica salvo lá. É feito uma vez só.</p>
        <div class="linha-flex"><button class="btn" data-acao="criar-mercado" ${criando ? "disabled" : ""}>${criando ? "Criando…" : "Criar aba Mercado"}</button></div></div>`
    : `<p class="nota">Base do app (avaliação v51). Para editar, conecte a planilha em Ajustes.</p>`}
  <div class="kpis">
    <div class="kpi"><span class="v">${lista.length.toLocaleString("pt-BR")}</span><span class="l">perfumes na base</span></div>
    <div class="kpi"><span class="v">${comTier}</span><span class="l">com tier seu</span></div>
    <div class="kpi"><span class="v">${meus}</span><span class="l">na sua coleção</span></div>
  </div>
  <div class="bloco">
    <input type="search" id="mf-q" placeholder="Buscar perfume, casa, nariz ou nota" value="${esc(filtro.q || "")}" aria-label="Buscar no mercado">
    <div class="chips rolagem">${[["", "Todo tier"], ...["S", "A", "B", "C", "D"].map(t => [t, `Tier ${t}`]), ["sem", "Sem tier"]].map(([v, r]) => `<button class="chip" data-mf="tier" data-v="${v}" aria-pressed="${(filtro.tier || "") === v}">${r}</button>`).join("")}
      </div>
    <div class="campos">
      <label>Posse<select id="mf-posse">${POSSES_FILTRO.map(([v, r]) => op(v, r, filtro.posse)).join("")}</select></label>
      <label>Arquétipo<select id="mf-arq">${op("", "Todos", filtro.arq)}${arquetipos.map(a => op(a.nome, a.nome, filtro.arq)).join("")}</select></label>
      <label>Wishlist<select id="mf-wish">${op("", "Todos", filtro.wish === "1" ? "sim" : filtro.wish)}${op("sim", `Só wishlist (${wish})`, filtro.wish === "1" ? "sim" : filtro.wish)}${op("nao", "Fora da wishlist", filtro.wish === "1" ? "sim" : filtro.wish)}</select></label>
    </div>
    <p class="nota">${res.length} perfume${res.length === 1 ? "" : "s"}.</p>
  </div>
  ${res.length ? tabela(res.slice(0, limite), filtro, { editavel: fonte === "planilha", arquetipos }) : `<div class="bloco"><p class="vazio">Nada com esses filtros.</p></div>`}
  ${res.length > limite ? `<button class="btn sec" data-acao="mf-mais">Mostrar mais (${res.length - limite})</button>` : ""}
  <details class="bloco"><summary>Mercado × coleção por arquétipo</summary>
    <div class="mxc">${porArq.sort((x, y) => y.merc - x.merc).map(x => `<button class="mxc-l" data-mf-arq="${esc(x.a.nome)}">
      <span class="t"><span class="pinta" style="background:${x.a.cor}"></span>${esc(x.a.nome)}</span>
      <span class="trilho"><span style="width:${(x.merc / maxM) * 100}%;background:${x.a.cor};opacity:.35"></span><span style="width:${(x.meus / maxM) * 100}%;background:${x.a.cor}"></span></span>
      <span class="n">${x.meus}/${x.merc}</span></button>`).join("")}</div>
    <p class="nota">Barra clara = perfumes da base; barra cheia = seus frascos. Toque para filtrar.</p>
  </details>`;
}

export const posseRot = p => (p === "Frasco Gui" ? "na coleção" : p);

// células editáveis na própria tabela (Tier, Posse, Wishlist, Arquétipo)
const opts = (lista, at) => lista.map(([v, r]) => `<option value="${esc(v)}" ${String(at) === String(v) ? "selected" : ""}>${esc(r)}</option>`).join("");
export function celTier(p, id) {
  return `<label class="ed ed-tier t-${p.tier || "x"}"><span class="sr">Tier de ${esc(p.nome)}</span>
    <select data-ed="Tier" data-id="${esc(id)}">${opts([["", "–"], ["S", "S"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]], p.tier || "")}</select></label>`;
}
export function celPosse(p, id) {
  const lista = POSSES_EDIT.map(x => [x, x ? posseRot(x) : "—"]).concat(!p.posse || POSSES_EDIT.includes(p.posse) ? [] : [[p.posse, p.posse]]);
  return `<label class="ed ed-posse ${p.posse === "Frasco Gui" ? "minha" : ""}"><span class="sr">Posse de ${esc(p.nome)}</span>
    <select data-ed="Posse" data-id="${esc(id)}">${opts(lista, p.posse || "")}</select></label>`;
}
export function celArq(p, id, arquetipos) {
  return `<label class="ed ed-arq">${p.arquetipo ? arqIcone(p.arquetipo, 15) : ""}<span class="sr">Arquétipo de ${esc(p.nome)}</span>
    <select data-ed="Arquétipo" data-id="${esc(id)}">${opts([["", "—"], ...arquetipos.map(a => [a.nome, a.nome])], p.arquetipo || "")}</select></label>`;
}
export const celWish = (p, id) => `<button class="ed ed-wish ${p.wish ? "on" : ""}" data-ed-wish="${esc(id)}" aria-pressed="${p.wish}" aria-label="${p.wish ? "Tirar da" : "Pôr na"} wishlist: ${esc(p.nome)}">${p.wish ? "★" : "☆"}</button>`;

function tabela(linhas, f, { editavel = false, arquetipos = [] } = {}) {
  const ords = ordsDe(f, "tier");
  const th = ([k, r]) => `<th class="c-${k}" scope="col">${cabOrd(k, r, ords, "mf-ord")}</th>`;
  const td = (k, v, extra = "") => `<td class="c-${k}${extra}">${v}</td>`;
  const tx = (k, v) => `<td class="c-${k}"><div class="clamp">${esc(v || "")}</div></td>`;
  const btnOrd = (k, r) => cabOrd(k, r, ords, "mf-ord");
  return `${painelOrd(ords, [["casa", "Casa"], ["nome", "Perfume"], ...COLUNAS], "mf")}
  <div class="tabelao" role="region" aria-label="Tabela do mercado" tabindex="0"><table>
    <thead><tr><th class="c-n" scope="col">#</th><th class="c-casa" scope="col">${btnOrd("casa", "Casa")}</th><th class="c-nome" scope="col">${btnOrd("nome", "Perfume")}</th>${COLUNAS.map(th).join("")}</tr></thead>
    <tbody>${linhas.map((p, i) => { const id = p.casa + "||" + p.nome; return `<tr data-merc="${esc(id)}" tabindex="0" class="${p.posse === "Frasco Gui" ? "minha" : ""}">
      ${td("n", i + 1)}
      ${td("casa", esc(p.casa))}
      ${td("nome", esc(p.nome))}
      ${td("posse", editavel ? celPosse(p, id) : esc(posseRot(p.posse) || "—"))}
      ${td("tier", editavel ? celTier(p, id) : p.tier ? tierHTML(p.tier) : `<span class="tier sem">–</span>`)}
      ${td("wish", editavel ? celWish(p, id) : p.wish ? `<span class="estrela" title="Na wishlist">★</span>` : "")}
      ${td("arquetipo", editavel ? celArq(p, id, arquetipos) : arqTag(p.arquetipo, 14))}
      ${tx("resumo", p.resumo)}${tx("topo", p.topo)}${tx("coracao", p.coracao)}${tx("base", p.base)}
    </tr>`; }).join("")}</tbody></table></div>
  <p class="nota">Arraste para o lado para ver todas as colunas. ${editavel ? "Tier, Posse, Wishlist e Arquétipo mudam direto na tabela (grava na hora); toque no nome para o resto." : "Toque na linha para ver a ficha."} Toque no cabeçalho para ordenar.</p>`;
}

export function fichaEditavel(p, { arquetipos, editavel, novo = false, confirmarRemover = false }) {
  const sel = (id, opcoes, at) => `<select id="${id}" ${editavel ? "" : "disabled"}>${opcoes.map(([v, r]) => `<option value="${esc(v)}" ${String(at) === String(v) ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>`;
  const txt = (id, v, linhas = 1, extra = "") => linhas > 1 ? `<textarea id="${id}" rows="${linhas}" ${editavel ? "" : "readonly"}>${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}" ${editavel ? "" : "readonly"} autocomplete="off" ${extra}>`;
  return `<div class="linha-flex">${p.arquetipo ? `<span class="ficha-ic">${arqIcone(p.arquetipo, 34)}</span>` : ""}<h2 id="fichaT">${novo ? "Novo perfume" : esc(p.nome)}</h2>${p.tier && !novo ? tierHTML(p.tier) : ""}<span class="esp"></span><button class="btn sec peq" data-fechar>Fechar</button></div>
    ${novo ? `<p class="nota">Entra na aba Mercado da planilha. Tier e posse, se preenchidos, também vão para a aba Tiers.</p>` : `<p class="nota">${esc(p.casa)}${p.atualizado ? ` · editado em ${esc(p.atualizado)}` : ""}</p>`}
    <form class="bloco" id="formMercado" data-casa="${esc(p.casa || "")}" data-nome="${esc(p.nome || "")}" data-novo="${novo ? 1 : ""}">
      <div class="campos">
        <label>Casa${txt("me-casa", p.casa || "", 1, novo ? "required" : "")}</label>
        <label>Perfume${txt("me-nome", p.nome || "", 1, novo ? "required" : "")}</label>
        <label>Tier${sel("me-tier", [["", "sem tier"], ["S", "S"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]], p.tier || "")}</label>
        <label>Posse${sel("me-posse", POSSES_EDIT.map(x => [x, x || "—"]).concat(!p.posse || POSSES_EDIT.includes(p.posse) ? [] : [[p.posse, p.posse]]), p.posse || "")}</label>
        <label>Arquétipo${sel("me-arq", [["", "—"], ...arquetipos.map(a => [a.nome, a.nome])], p.arquetipo || "")}</label>
        <label>Nariz${txt("me-nariz", p.nariz || "")}</label>
        <label class="largo">Resumo${txt("me-resumo", p.resumo || "", 3)}</label>
        <label class="largo">Topo${txt("me-topo", p.topo || "")}</label>
        <label class="largo">Coração${txt("me-coracao", p.coracao || "")}</label>
        <label class="largo">Base${txt("me-base", p.base || "")}</label>
        <label class="largo">Notas (suas)${txt("me-notas", p.notas || "", 3)}</label>
      </div>
      <label class="linha-flex"><input type="checkbox" id="me-wish" ${p.wish ? "checked" : ""} ${editavel ? "" : "disabled"}> Wishlist</label>
      ${editavel ? `<p class="nota">Tier e posse também vão para a aba Tiers. Mudar casa ou nome renomeia a linha da aba Tiers (o “Nome no diário” não muda). Mudar tier de frasco da grade deixa a grade desatualizada até rodar o gerador.</p>
        <div class="linha-flex"><button class="btn" type="submit">${novo ? "Adicionar à base" : "Salvar na planilha"}</button><span class="esp"></span>
          ${novo ? "" : `<button class="btn ${confirmarRemover ? "perigo" : "sec"} peq" type="button" data-acao="remover-mercado">${confirmarRemover ? "Confirmar remoção" : "Remover da base"}</button>`}</div>
        ${confirmarRemover ? `<p class="nota erro-txt">Sai só da aba Mercado. A aba Tiers e o Diário não mudam. Toque de novo para confirmar.</p>` : ""}`
        : `<p class="nota">Somente leitura: crie a aba Mercado (no topo da aba) para editar.</p>`}
    </form>`;
}

/** Campos alterados no formulário (nomes das colunas da planilha). */
export function camposAlterados(p, form) {
  const novo = { Casa: form["me-casa"], Perfume: form["me-nome"], Notas: form["me-notas"], Tier: form["me-tier"], Posse: form["me-posse"], "Arquétipo": form["me-arq"], Nariz: form["me-nariz"], Resumo: form["me-resumo"],
    Topo: form["me-topo"], "Coração": form["me-coracao"], Base: form["me-base"], Wishlist: form["me-wish"] ? "✓" : "" };
  const velho = { Casa: p.casa, Perfume: p.nome, Notas: p.notas, Tier: p.tier, Posse: p.posse, "Arquétipo": p.arquetipo, Nariz: p.nariz, Resumo: p.resumo, Topo: p.topo, "Coração": p.coracao, Base: p.base, Wishlist: p.wish ? "✓" : "" };
  return Object.fromEntries(Object.entries(novo).filter(([k, v]) => v !== undefined && String(v).trim() !== String(velho[k] ?? "").trim()).map(([k, v]) => [k, String(v).trim()]));
}
