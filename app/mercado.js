// mercado.js — aba Mercado: base da avaliação v51 (1.205 perfumes, inclusive os da coleção) guardada na aba
// "Mercado" da planilha, com edição. Tier e posse da aba Tiers sempre vencem na exibição (fonte única de tier).
import { esc, tierHTML } from "./util.js";
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
    base: r[i("Base")] || "", nariz: r[i("Nariz")] || "", wish: /✓|sim|x/i.test(r[i("Wishlist")] || ""), atualizado: r[i("Atualizado em")] || "" }));
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
export async function editarNaPlanilha(casa, perfume, campos) {
  const j = await chamar("editarMercado", { casa, perfume, campos }, { timeoutMs: 25000 });
  // atualiza a cópia local sem baixar tudo de novo
  const c = cachePlanilha();
  if (c?.existe) {
    const cab = c.linhas[0], k = chave(casa, perfume);
    const row = c.linhas.find((r, i) => i > 0 && chave(r[cab.indexOf("Casa")], r[cab.indexOf("Perfume")]) === k);
    if (row) { for (const [n, v] of Object.entries(campos)) if (cab.includes(n)) row[cab.indexOf(n)] = String(v); gravar("mercadoPlanilha", c); }
  }
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
    if (f.wish && !p.wish) return false;
    if (q && !norm(`${p.nome} ${p.casa} ${p.nariz} ${p.resumo} ${p.topo} ${p.coracao} ${p.base}`).includes(q)) return false;
    return true;
  }).sort(comparador(f.ord, f.dir));
}

// colunas da tabela (formato do TABELAO): chave do objeto, rótulo, ordenável
export const COLUNAS = [["posse", "Posse"], ["tier", "Tier"], ["arquetipo", "Arquétipo"],
  ["resumo", "Resumo"], ["topo", "Topo"], ["coracao", "Coração"], ["base", "Base"]];
const ordemPosse = p => ({ "Frasco Gui": 0, "Frasco Bia": 1, "Amostra": 2, "Amostra Bia": 3, "Avaliado": 4 }[p] ?? (p ? 5 : 6));
function comparador(ord = "tier", dir = "asc") {
  const s = dir === "desc" ? -1 : 1;
  const padrao = (a, b) => ordemTier(a.tier) - ordemTier(b.tier) || a.casa.localeCompare(b.casa, "pt") || a.nome.localeCompare(b.nome, "pt");
  const chaveDe = { tier: p => ordemTier(p.tier), posse: p => ordemPosse(p.posse) }[ord];
  return (a, b) => {
    let c;
    if (chaveDe) c = chaveDe(a) - chaveDe(b);
    else { const x = a[ord] || "", y = b[ord] || ""; c = (!x && y) ? 1 : (x && !y) ? -1 : x.localeCompare(y, "pt"); if (!x || !y) return c || padrao(a, b); }
    return s * c || padrao(a, b);
  };
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
  ${fonte === "planilha" ? `<p class="nota">Lido da aba <b>Mercado</b> da planilha. Toque num perfume para ver e editar.</p>`
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
      <button class="chip" data-mf="wish" data-v="${filtro.wish ? "" : "1"}" aria-pressed="${Boolean(filtro.wish)}">★ Wishlist (${wish})</button></div>
    <div class="campos">
      <label>Posse<select id="mf-posse">${POSSES_FILTRO.map(([v, r]) => op(v, r, filtro.posse)).join("")}</select></label>
      <label>Arquétipo<select id="mf-arq">${op("", "Todos", filtro.arq)}${arquetipos.map(a => op(a.nome, a.nome, filtro.arq)).join("")}</select></label>
    </div>
    <p class="nota">${res.length} perfume${res.length === 1 ? "" : "s"}.</p>
  </div>
  ${res.length ? tabela(res.slice(0, limite), filtro) : `<div class="bloco"><p class="vazio">Nada com esses filtros.</p></div>`}
  ${res.length > limite ? `<button class="btn sec" data-acao="mf-mais">Mostrar mais (${res.length - limite})</button>` : ""}
  <details class="bloco"><summary>Mercado × coleção por arquétipo</summary>
    <div class="mxc">${porArq.sort((x, y) => y.merc - x.merc).map(x => `<button class="mxc-l" data-mf-arq="${esc(x.a.nome)}">
      <span class="t"><span class="pinta" style="background:${x.a.cor}"></span>${esc(x.a.nome)}</span>
      <span class="trilho"><span style="width:${(x.merc / maxM) * 100}%;background:${x.a.cor};opacity:.35"></span><span style="width:${(x.meus / maxM) * 100}%;background:${x.a.cor}"></span></span>
      <span class="n">${x.meus}/${x.merc}</span></button>`).join("")}</div>
    <p class="nota">Barra clara = perfumes da base; barra cheia = seus frascos. Toque para filtrar.</p>
  </details>`;
}

const posseRot = p => (p === "Frasco Gui" ? "na coleção" : p);

function tabela(linhas, f) {
  const ord = f.ord || "tier", dir = f.dir || "asc";
  const th = ([k, r]) => `<th class="c-${k}" scope="col"><button data-mf-ord="${k}" aria-sort="${ord === k ? (dir === "asc" ? "ascending" : "descending") : "none"}">${r}${ord === k ? (dir === "asc" ? " ↑" : " ↓") : ""}</button></th>`;
  const td = (k, v, extra = "") => `<td class="c-${k}${extra}">${v}</td>`;
  const tx = (k, v) => `<td class="c-${k}"><div class="clamp">${esc(v || "")}</div></td>`;
  const btnOrd = (k, r) => `<button data-mf-ord="${k}" aria-sort="${ord === k ? (dir === "asc" ? "ascending" : "descending") : "none"}">${r}${ord === k ? (dir === "asc" ? " ↑" : " ↓") : ""}</button>`;
  return `<div class="tabelao" role="region" aria-label="Tabela do mercado" tabindex="0"><table>
    <thead><tr><th class="c-n" scope="col">#</th><th class="c-casa" scope="col">${btnOrd("casa", "Casa")}</th><th class="c-nome" scope="col">${btnOrd("nome", "Perfume")}</th>${COLUNAS.map(th).join("")}</tr></thead>
    <tbody>${linhas.map((p, i) => `<tr data-merc="${esc(p.casa + "||" + p.nome)}" tabindex="0" class="${p.posse === "Frasco Gui" ? "minha" : ""}">
      ${td("n", i + 1)}
      ${td("casa", esc(p.casa))}
      ${td("nome", `${esc(p.nome)}${p.wish ? ` <span class="estrela" title="Wishlist">★</span>` : ""}`)}
      ${td("posse", esc(posseRot(p.posse) || "—"))}
      ${td("tier", p.tier ? tierHTML(p.tier) : `<span class="tier sem">–</span>`)}
      ${td("arquetipo", esc(p.arquetipo || "—"))}
      ${tx("resumo", p.resumo)}${tx("topo", p.topo)}${tx("coracao", p.coracao)}${tx("base", p.base)}
    </tr>`).join("")}</tbody></table></div>
  <p class="nota">Arraste para o lado para ver todas as colunas. Toque no cabeçalho para ordenar e na linha para editar.</p>`;
}

export function fichaEditavel(p, { arquetipos, editavel, salvando }) {
  const sel = (id, opcoes, at) => `<select id="${id}" ${editavel ? "" : "disabled"}>${opcoes.map(([v, r]) => `<option value="${esc(v)}" ${String(at) === String(v) ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>`;
  const txt = (id, v, linhas = 1) => linhas > 1 ? `<textarea id="${id}" rows="${linhas}" ${editavel ? "" : "readonly"}>${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}" ${editavel ? "" : "readonly"} autocomplete="off">`;
  return `<div class="linha-flex"><h2 id="fichaT">${esc(p.nome)}</h2>${p.tier ? tierHTML(p.tier) : ""}<span class="esp"></span><button class="btn sec peq" data-fechar>Fechar</button></div>
    <p class="nota">${esc(p.casa)}${p.atualizado ? ` · editado em ${esc(p.atualizado)}` : ""}</p>
    <form class="bloco" id="formMercado" data-casa="${esc(p.casa)}" data-nome="${esc(p.nome)}">
      <div class="campos">
        <label>Tier${sel("me-tier", [["", "sem tier"], ["S", "S"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]], p.tier)}</label>
        <label>Posse${sel("me-posse", POSSES_EDIT.map(x => [x, x || "—"]).concat(POSSES_EDIT.includes(p.posse) ? [] : [[p.posse, p.posse]]), p.posse)}</label>
        <label>Arquétipo${sel("me-arq", [["", "—"], ...arquetipos.map(a => [a.nome, a.nome])], p.arquetipo)}</label>
        <label>Nariz${txt("me-nariz", p.nariz)}</label>
        <label class="largo">Resumo${txt("me-resumo", p.resumo, 3)}</label>
        <label class="largo">Topo${txt("me-topo", p.topo)}</label>
        <label class="largo">Coração${txt("me-coracao", p.coracao)}</label>
        <label class="largo">Base${txt("me-base", p.base)}</label>
      </div>
      <label class="linha-flex"><input type="checkbox" id="me-wish" ${p.wish ? "checked" : ""} ${editavel ? "" : "disabled"}> Wishlist</label>
      ${editavel ? `<p class="nota">Tier e posse também vão para a aba Tiers. Mudar tier de frasco da grade deixa a grade desatualizada até rodar o gerador.</p>
        <div class="linha-flex"><button class="btn" type="submit" ${salvando ? "disabled" : ""}>${salvando ? "Salvando…" : "Salvar na planilha"}</button></div>`
        : `<p class="nota">Somente leitura: crie a aba Mercado (no topo da aba) para editar.</p>`}
    </form>`;
}

/** Campos alterados no formulário (nomes das colunas da planilha). */
export function camposAlterados(p, form) {
  const novo = { Tier: form["me-tier"], Posse: form["me-posse"], "Arquétipo": form["me-arq"], Nariz: form["me-nariz"], Resumo: form["me-resumo"],
    Topo: form["me-topo"], "Coração": form["me-coracao"], Base: form["me-base"], Wishlist: form["me-wish"] ? "✓" : "" };
  const velho = { Tier: p.tier, Posse: p.posse, "Arquétipo": p.arquetipo, Nariz: p.nariz, Resumo: p.resumo, Topo: p.topo, "Coração": p.coracao, Base: p.base, Wishlist: p.wish ? "✓" : "" };
  return Object.fromEntries(Object.entries(novo).filter(([k, v]) => String(v ?? "").trim() !== String(velho[k] ?? "").trim()).map(([k, v]) => [k, String(v ?? "").trim()]));
}
