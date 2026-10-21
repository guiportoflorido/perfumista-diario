// telas.js — Coleção, Playbook e Histórico (fase 4). Recebem o contexto pronto do main.js e devolvem HTML.
import { FAIXAS } from "../engine/index.js";
import { esc, ROT_OC, OCAS_TODAS, pinta, faixaHTML, nf, tierHTML, slotNome, slotIcone, md, ordsDe, compararMulti, cmpValor, cabOrd, painelOrd, OPC_AMOSTRA, passaAmostra, temFiltro } from "./util.js";
import { chave } from "./mercado.js";
import { contagens, agrupar, esquecidos, usoVsJanelas, calibracao, deAnalise, notaPorFrascoFaixa } from "./estatisticas.js";
import { arqIcone, corArq, ARQ_PATHS } from "./icones.js";

const TIERS = ["S", "A", "B", "C"];
export const FILTROS_COL = ["q", "tier", "eixo", "arq", "faixa", "oc", "casa", "am", "camada"];
// camada do frasco: grade (playbook), custo (só academia/corrida) ou fora da grade (tier D)
export const camadaDe = f => (f.camada === "custo" ? "custo" : f.tier === "D" ? "fora" : "grade");
const CAMADAS = [["", "Todas"], ["grade", "Grade"], ["custo", "Camada custo"], ["fora", "Fora da grade (D)"]];
const TIERS_ORD = ["S", "A", "B", "C", "D"];
const EIXOS = { P: "P · seco-mineral", S: "S · ambarado-doce", F: "F · fora do eixo" };
const opt = (v, rot, atual) => `<option value="${esc(v)}" ${String(atual) === String(v) ? "selected" : ""}>${esc(rot)}</option>`;
const quando = d => (d === null ? "sem registro" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} d`);

// ───────────────────────── Coleção (tabela) ─────────────────────────
const COLS_COL = [["nome", "Perfume"], ["casa", "Casa"], ["tier", "Tier"], ["arquetipo", "Arquétipo"], ["eixo", "Eixo"], ["td", "Td"],
  ["peso", "Peso"], ["doc", "Doçura"], ["envelope", "Envelope"], ["janelas", "Janelas"], ["usos", "Usos"], ["ultimo", "Último uso"]];
const TD_ROT = { C: "C · carregado", S: "S · seco", N: "N · indiferente" };

function ordenarColecao(linhas, ords) {
  const v = (k, x) => ({ tier: TIERS_ORD.indexOf(x.f.tier), nome: x.f.nome, casa: x.f.casa, arquetipo: x.f.arquetipo, eixo: x.f.eixo, td: x.f.td,
    peso: x.f.peso, doc: x.f.doc, envelope: x.f.env_hot * 10 + x.f.env_cold, janelas: x.f.janelas ?? "", usos: x.k.n, ultimo: x.k.ultimo || "" }[k]);
  const padrao = (a, b) => TIERS_ORD.indexOf(a.f.tier) - TIERS_ORD.indexOf(b.f.tier) || a.f.nome.localeCompare(b.f.nome, "pt");
  return [...linhas].sort(compararMulti(ords, (k, a, b) => cmpValor(v(k, a), v(k, b)), padrao));
}

export function telaColecao({ frascos, hist, hoje, janelas, filtro, fichas, arqTag, amostras = null }) {
  const c = contagens(hist, frascos, hoje, { todos: true });
  const nCam = k => frascos.filter(f => camadaDe(f) === k).length;
  const arqs = [...new Set(frascos.map(f => f.arquetipo))].sort((a, b) => a.localeCompare(b));
  const q = (filtro.q || "").toLowerCase();
  const recorte = filtro.faixa !== "" && filtro.faixa != null || filtro.oc;
  const filtrados = frascos.filter(f => {
    if (filtro.camada && camadaDe(f) !== filtro.camada) return false;
    if (filtro.tier && f.tier !== filtro.tier) return false;
    if (filtro.eixo && f.eixo !== filtro.eixo) return false;
    if (filtro.arq && f.arquetipo !== filtro.arq) return false;
    if (filtro.casa && f.casa !== filtro.casa) return false;
    if (filtro.am && !passaAmostra(filtro.am, amostras?.get(chave(f.casa, f.nome)))) return false;
    if (recorte) {
      const js = janelas.get(f.nome) || [];
      if (!js.some(j => (filtro.faixa === "" || filtro.faixa == null || j.faixaIdx === Number(filtro.faixa)) && (!filtro.oc || j.ocasiao === filtro.oc))) return false;
    }
    if (q && !`${f.nome} ${f.casa} ${f.arquetipo}`.toLowerCase().includes(q)) return false;
    return true;
  }).map(f => ({ f, k: c.por.get(f.nome) }));
  const ords = ordsDe(filtro, "tier");
  const linhas = ordenarColecao(filtrados, ords);
  const th = ([k, r]) => `<th class="cc-${k}" scope="col">${cabOrd(k, r, ords, "col-ord")}</th>`;
  return `<div class="bloco">
    <input type="search" id="col-q" placeholder="Buscar frasco, casa ou arquétipo" value="${esc(filtro.q || "")}" aria-label="Buscar">
    <div class="campos">
      <label>Camada<select id="col-camada">${CAMADAS.map(([v, r]) => opt(v, r, filtro.camada)).join("")}</select></label>
      <label>Casa<select id="col-casa">${opt("", "Todas", filtro.casa)}${[...new Set(frascos.map(f => f.casa))].sort((a, b) => a.localeCompare(b, "pt")).map(c => opt(c, c, filtro.casa)).join("")}</select></label>
      <label>Tier<select id="col-tier">${opt("", "Todos", filtro.tier)}${TIERS_ORD.map(t => opt(t, `Tier ${t}`, filtro.tier)).join("")}</select></label>
      <label>Eixo<select id="col-eixo">${opt("", "Todos", filtro.eixo)}${Object.entries(EIXOS).map(([k, r]) => opt(k, r, filtro.eixo)).join("")}</select></label>
      <label>Arquétipo<select id="col-arq">${opt("", "Todos", filtro.arq)}${arqs.map(a => opt(a, a, filtro.arq)).join("")}</select></label>
      <label>Faixa<select id="col-faixa">${opt("", "Todas", filtro.faixa ?? "")}${FAIXAS.map((x, i) => opt(i, x, filtro.faixa ?? "")).join("")}</select></label>
      <label>Ocasião<select id="col-oc">${opt("", "Todas", filtro.oc)}${OCAS_TODAS.map(o => opt(o, ROT_OC[o], filtro.oc)).join("")}</select></label>
      ${amostras ? `<label>Amostra<select id="col-am">${OPC_AMOSTRA.map(([v, r]) => opt(v, r, filtro.am)).join("")}</select></label>` : ""}
    </div>
    <p class="nota">${linhas.length} de ${frascos.length} frascos (grade ${nCam("grade")} · custo ${nCam("custo")} · fora da grade ${nCam("fora")})${recorte ? " com janela no playbook nesse recorte" : ""} · ${TIERS_ORD.map(t => `${t} ${frascos.filter(f => f.tier === t).length}`).join(" · ")}.${temFiltro(filtro, FILTROS_COL) ? ` <button class="btn sec peq" data-acao="col-limpar">Limpar filtros</button>` : ""}</p>
  </div>
  ${linhas.length ? `${painelOrd(ords, COLS_COL, "col")}<div class="tabelao" role="region" aria-label="Tabela da coleção" tabindex="0"><table class="t-colecao">
    <thead><tr><th class="c-n" scope="col">#</th>${COLS_COL.map(th).join("")}</tr></thead>
    <tbody>${linhas.map(({ f, k }, i) => `<tr data-ficha="${esc(f.nome)}" tabindex="0">
      <td class="c-n">${i + 1}</td>
      <td class="c-nome">${esc(f.nome)}${f.janelas_estimadas ? ` <span class="selo aviso" title="janelas estimadas">est.</span>` : ""}${camadaDe(f) === "custo" ? ` <span class="selo" title="Camada custo: só academia e corrida, fora da grade">custo</span>` : camadaDe(f) === "fora" ? ` <span class="selo aviso" title="Fora da grade">fora</span>` : ""}</td>
      <td class="cc-casa">${esc(f.casa)}</td>
      <td class="c-tier">${tierHTML(f.tier)}</td>
      <td class="cc-arquetipo">${arqTag(f.arquetipo)}</td>
      <td class="cc-eixo">${esc(f.eixo)}</td>
      <td class="cc-td">${esc(TD_ROT[f.td] || f.td)}</td>
      <td class="cc-num">${f.peso}</td><td class="cc-num">${f.doc}</td>
      <td class="cc-env">${esc(fichas[f.nome]?.envelope || "")}</td>
      <td class="cc-num">${f.janelas ?? "—"}</td>
      <td class="cc-num">${k.n}${k.n ? ` <span class="nota">☀︎${k.M} ☾${k.N}</span>` : ""}</td>
      <td class="cc-ult">${quando(k.dias)}</td>
    </tr>`).join("")}</tbody></table></div>
  <p class="nota">Toque no cabeçalho para ordenar (vira o 1º critério; os anteriores viram 2º e 3º) e na linha para abrir a ficha. Peso 1–5 · Doçura 0–3 · Td = como reage à umidade.</p>`
    : `<div class="bloco"><p class="vazio">Nenhum frasco nesse recorte.</p></div>`}`;
}

// ───────────────────────── Playbook ─────────────────────────
export function telaPlaybook({ playbook, faixaSel, ajSpray, arqDe, arqIcone }) {
  if (!playbook) return `<h2>Playbook</h2><p class="nota">Carregando…</p>`;
  const fi = Number(faixaSel ?? 2), faixa = playbook.faixas[fi], g = playbook.grade[faixa];
  const nomeBtn = n => `<button class="nome-inline" data-ficha="${esc(n)}">${arqIcone(arqDe.get(n), 14)}${esc(n)}</button>`;
  return `<h2>Playbook</h2>
  <p class="nota">${esc(playbook.fonte)} · ${playbook.total_alocacoes} alocações · ${playbook.celulas} células (Cozy só de Ameno para baixo). Sprays da célula são os do playbook.</p>
  <div class="chips rolagem" role="tablist">${playbook.faixas.map((x, i) => `<button class="chip" data-pbfaixa="${i}" aria-pressed="${i === fi}">${pinta(i)} ${esc(x)}</button>`).join("")}</div>
  <div class="bloco"><h3>${faixaHTML(fi)}</h3>${g.nota ? `<p class="nota">${esc(g.nota)}</p>` : ""}</div>
  ${OCAS_TODAS.map(oc => {
    const c = g.celulas[oc];
    if (!c) return `<div class="bloco celula vazia"><h3>${ROT_OC[oc]}</h3><p class="nota">Sem célula nesta faixa.</p></div>`;
    return `<div class="bloco celula"><h3>${ROT_OC[oc]}</h3>
      ${c.seguro ? `<p><span class="papel">Seguro</span> ${nomeBtn(c.seguro)} ${tierHTML(c.seguro_tier)} · <b>${esc(c.sprays)}</b> spray${c.sprays === "1" ? "" : "s"}<br><span class="nota">${esc(c.seguro_perfil)}</span></p>` : ""}
      ${c.jogada ? `<p><span class="papel">Jogada</span> ${nomeBtn(c.jogada)} ${tierHTML(c.jogada_tier)}<br><span class="nota">${esc(c.jogada_txt)}</span></p>` : ""}
      ${c.tambem.length ? `<p class="nota"><span class="papel">Também</span> ${c.tambem.map(nomeBtn).join(", ")}</p>` : ""}
    </div>`;
  }).join("")}
  <details class="bloco"><summary>Custo por uso com dois slots</summary><div class="md">${md(playbook.secoes["Custo por uso com dois slots"])}</div></details>
  <details class="bloco"><summary>Notas de uso</summary><div class="md">${md(playbook.secoes["Notas de uso"])}</div></details>`;
}

// ───────────────────────── Histórico ─────────────────────────
// períodos do Histórico: atalhos e intervalo livre
export function periodo(preset, hoje, de, ate) {
  const d = new Date(hoje + "T12:00:00");
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const menos = n => { const x = new Date(d); x.setDate(x.getDate() - n + 1); return iso(x); };
  if (preset === "7") return { de: menos(7), ate: hoje };
  if (preset === "30") return { de: menos(30), ate: hoje };
  if (preset === "90") return { de: menos(90), ate: hoje };
  if (preset === "mes") return { de: hoje.slice(0, 8) + "01", ate: hoje };
  if (preset === "mesant") { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return { de: iso(a), ate: iso(b) }; }
  if (preset === "livre") return { de: de || null, ate: ate || hoje };
  return { de: null, ate: hoje };
}
const PRESETS = [["tudo", "Tudo"], ["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["mes", "Este mês"], ["mesant", "Mês passado"], ["livre", "Escolher datas"]];
const dataBR = iso => (iso ? iso.split("-").reverse().join("/") : "—");

/** Identifica um item do histórico unificado para os botões (data|slot|perfume|linha|id). */
export const idRegistro = r => [r.data, r.slot, r.perfume, r.linha || "", r.id || ""].join("|");

/** Registros dos últimos dias (a partir de `limite`), mais recentes primeiro, com botão Editar. */
export function registrosRecentes(hist, limite) {
  const rec = hist.filter(r => r.data >= limite).reverse();
  const item = r => `<article class="card compacto"><span class="pos" title="${esc(slotNome(r.slot))}">${slotIcone(r.slot)}</span>
    <div style="min-width:0"><b>${esc(r.perfume)}</b><div class="casa">${dataBR(r.data)}${r.slot !== "M" && r.slot !== "N" ? ` · ${esc(slotNome(r.slot))}` : ""}${r.ocasiao ? ` · ${esc(ROT_OC[r.ocasiao] || r.ocasiao)}` : ""}${r.sprays ? ` · ${esc(r.sprays)} spray${r.sprays === "1" ? "" : "s"}` : ""}${r.notaDia ? ` · nota ${esc(r.notaDia)}` : ""}${r.pendente ? " · na fila" : ""}</div></div>
    <button class="btn sec peq" data-editar-reg="${esc(idRegistro(r))}">Editar</button></article>`;
  return `<div class="bloco"><h3>Registros recentes · desde ${dataBR(limite)}</h3>
    ${rec.length ? `<div class="lista">${rec.slice(0, 10).map(item).join("")}</div>${rec.length > 10 ? `<details><summary>Ver os outros ${rec.length - 10}</summary><div class="lista" style="margin-top:8px">${rec.slice(10).map(item).join("")}</div></details>` : ""}`
      : `<p class="vazio">Nenhum registro nos últimos dias.</p>`}
    <p class="nota">Editar ou apagar vale só para os últimos 30 dias. O que já está na planilha muda também na aba Diário.</p></div>`;
}

/** Períodos do "Exportar" do Histórico (mesmos atalhos de periodo()). */
export const PRESETS_EXPORTAR = [["tudo", "Tudo"], ["90", "90 dias"], ["30", "30 dias"], ["mes", "Este mês"]];

/** Bloco "Exportar": copia o diário em texto fixo para colar no projeto do Claude. O texto é montado no clique. */
export function blocoExportar(preset = "tudo") {
  return `<div class="bloco" id="exportar"><h3>Exportar</h3>
    <p class="nota">Copia o diário (planilha + fila do aparelho) em texto fixo, uma linha por registro, para colar no projeto do Claude.</p>
    <div class="chips rolagem">${PRESETS_EXPORTAR.map(([v, r]) => `<button class="chip" data-exp="${v}" aria-pressed="${preset === v}">${r}</button>`).join("")}</div>
    <div class="linha-flex"><button class="btn peq" data-acao="copiar-diario">Copiar diário</button></div>
    <div id="expSaida"></div></div>`;
}

export function telaHistorico({ frascos, hist: histTodo, hoje, fila: filaToda, ajSpray, limiteEsq = 45, hr = {}, arqTag, limiteEdicao = "", exp = "tudo" }) {
  const preset = hr.preset || "tudo";
  const { de, ate } = periodo(preset, hoje, hr.de, hr.ate);
  const dentro = r => (!de || r.data >= de) && r.data <= ate;
  // análises: só Dia (M) e Noite (N); Esportes e 2ª aplicação aparecem só nas listas de registros
  const hist = histTodo.filter(dentro).filter(deAnalise), fila = filaToda.filter(dentro);
  const seletor = `<div class="bloco periodo">
    <div class="chips rolagem">${PRESETS.map(([v, r]) => `<button class="chip" data-hr="${v}" aria-pressed="${preset === v}">${r}</button>`).join("")}</div>
    ${preset === "livre" ? `<div class="campos"><label>De<input type="date" id="hr-de" value="${esc(hr.de || "")}" max="${hoje}"></label><label>Até<input type="date" id="hr-ate" value="${esc(hr.ate || hoje)}" max="${hoje}"></label></div>` : ""}
    <p class="nota">${de ? `${dataBR(de)} a ${dataBR(ate)}` : `Todo o diário até ${dataBR(ate)}`} · ${hist.length} registro${hist.length === 1 ? "" : "s"} de Dia/Noite</p>
  </div>`;
  const c = contagens(hist, frascos, ate);
  const recentes = limiteEdicao ? registrosRecentes(histTodo, limiteEdicao) : "";
  if (!hist.length) return `<h2>Histórico</h2>${seletor}${histTodo.length ? recentes : ""}<div class="bloco"><p class="vazio">${histTodo.length ? "Nenhum registro nesse período." : "Sem registros ainda. Conecte a planilha em Ajustes ou registre um uso."}</p></div>${histTodo.length ? blocoExportar(exp) : ""}`;
  const doPeriodo = preset !== "tudo";
  const barras = (pares, max) => `<div class="barras">${pares.map(([k, v]) => `<div class="barra"><span class="t">${k}</span><span class="trilho"><span style="width:${max ? (v / max) * 100 : 0}%"></span></span><span class="n">${v}</span></div>`).join("")}</div>`;
  const usados = [...c.por.values()].filter(x => x.n).sort((a, b) => b.n - a.n || (a.ultimo < b.ultimo ? 1 : -1));
  const porArq = agrupar(c.por, f => f.arquetipo).filter(([, v]) => v);
  const porTier = TIERS.map(t => [`Tier ${t}`, [...c.por.values()].filter(x => x.f.tier === t).reduce((s, x) => s + x.n, 0)]);
  const slots = [["☀︎ Dia", hist.filter(r => r.slot === "M").length], ["☾ Noite", hist.filter(r => r.slot === "N").length]];
  // no período: frascos sem uso dentro dele; em "Tudo": regra dos 45 dias
  const esq = doPeriodo ? [...c.por.values()].filter(x => !x.n).sort((a, b) => TIERS.indexOf(a.f.tier) - TIERS.indexOf(b.f.tier) || a.f.nome.localeCompare(b.f.nome)) : esquecidos(c.por, limiteEsq);
  const uv = usoVsJanelas(c.por).filter(x => x.usos || x.janelas);
  const acima = uv.filter(x => x.desvio >= 1).sort((a, b) => b.desvio - a.desvio).slice(0, 8);
  const cal = calibracao([...histTodo.filter(dentro), ...fila]);   // planilha (coluna Sugerido) + fila do aparelho
  // NotaDia: piores médias primeiro (é para desbaste); mínimo 2 notas; por faixa só com n ≥ 2
  const notas = [...notaPorFrascoFaixa(hist, frascos).values()].filter(x => x.n >= 2)
    .sort((a, b) => a.media - b.media || b.n - a.n || a.f.nome.localeCompare(b.f.nome, "pt"));
  const diasPeriodo = de ? Math.round((new Date(ate) - new Date(de)) / 864e5) + 1 : c.cobertura;
  return `<h2>Histórico</h2>
  ${seletor}
  <div class="kpis">
    <div class="kpi"><span class="v">${c.total}</span><span class="l">usos de frascos da grade</span></div>
    <div class="kpi"><span class="v">${diasPeriodo}</span><span class="l">${de ? "dias no período" : `dias desde o 1º registro (${dataBR(c.primeiro)})`}</span></div>
    <div class="kpi"><span class="v">${usados.length}/${c.por.size}</span><span class="l">frascos usados ao menos 1×</span></div>
  </div>
  ${!doPeriodo && c.cobertura < 90 ? `<p class="nota">Diário com menos de 90 dias: não serve ainda para conclusões de desbaste sobre os B.</p>` : ""}
  ${recentes}
  ${calendario(histTodo.filter(deAnalise), frascos, ate, de)}
  ${passaporte(c.por, hist, frascos)}
  <div class="bloco"><h3>Mais usados</h3>${usados.length ? barras(usados.slice(0, 15).map(x => [`<button class="nome-inline" data-ficha="${esc(x.f.nome)}">${esc(x.f.nome)}</button>`, x.n]), usados[0].n) : `<p class="nota">Nenhum.</p>`}</div>
  <div class="duas">
    <div class="bloco"><h3>Por slot</h3>${barras(slots, Math.max(...slots.map(s => s[1])))}</div>
    <div class="bloco"><h3>Por tier</h3>${barras(porTier, Math.max(...porTier.map(s => s[1]), 1))}</div>
  </div>
  <div class="bloco"><h3>Por arquétipo</h3>${porArq.length ? barras(porArq.map(([k, v]) => [arqTag(k), v]), porArq[0][1]) : `<p class="nota">Nenhum.</p>`}</div>
  <div class="bloco"><h3>${doPeriodo ? `Sem uso no período · ${esq.length}` : `Esquecidos · sem uso há ${limiteEsq}+ dias ou sem registro · ${esq.length}`}</h3>
    <p class="nota">“Sem registro” é ausência no diário, não prova de que você não usou.</p>
    ${(() => { const item = x => `<article class="card compacto"><span class="pos">${tierHTML(x.f.tier)}</span><div style="min-width:0"><button class="nome" data-ficha="${esc(x.f.nome)}">${esc(x.f.nome)}</button><div class="casa">${arqTag(x.f.arquetipo, 13)} · ${x.f.janelas} janelas</div></div><span class="nota">${quando(x.dias)}</span></article>`;
      return `<div class="lista">${esq.slice(0, 8).map(item).join("")}</div>${esq.length > 8 ? `<details><summary>Ver os outros ${esq.length - 8}</summary><div class="lista" style="margin-top:8px">${esq.slice(8).map(item).join("")}</div></details>` : ""}`; })()}
  </div>
  <div class="bloco"><h3>Uso × janelas do playbook</h3>
    <p class="nota">Esperado = seus ${c.total} usos repartidos pelas janelas de cada frasco. Mostra quem você usa mais do que o playbook prevê.</p>
    ${acima.length ? `<div class="tabela"><table><thead><tr><th>Frasco</th><th>Janelas</th><th>Usos</th><th>Esperado</th></tr></thead><tbody>${acima.map(x => `<tr><td>${esc(x.nome)} ${tierHTML(x.tier)}</td><td>${x.janelas}</td><td>${x.usos}</td><td>${nf(x.esperado)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="nota">Poucos usos para comparar.</p>`}
  </div>
  <div class="bloco"><h3>NotaDia · fit por frasco</h3>
    <p class="nota">Média da NotaDia (1–5, quanto o perfume combinou com o slot) no período, por frasco e por faixa de temperatura do registro. Piores médias em cima. Só frascos com 2+ notas; faixa só com 2+.</p>
    ${notas.length ? `<div class="tabela"><table><thead><tr><th>Frasco</th><th>n</th><th>Média</th><th>Por faixa</th></tr></thead><tbody>${notas.map(x => {
      const fx = [...x.faixas].filter(([, v]) => v.n >= 2).map(([i, v]) => `${pinta(i)}${esc(FAIXAS[i])} ${nf(v.media)} <span class="nota">(${v.n})</span>`).join(" · ");
      return `<tr><td><button class="nome-inline" data-ficha="${esc(x.f.nome)}">${esc(x.f.nome)}</button> ${tierHTML(x.f.tier)}</td><td>${x.n}</td><td><b>${nf(x.media)}</b></td><td>${fx || `<span class="nota">—</span>`}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<p class="nota">Ainda sem frascos com 2 ou mais notas no período. Dê a NotaDia ao registrar o uso.</p>`}
  </div>
  <div class="bloco"><h3>Sprays · real × sugerido pelo modelo</h3>
    ${cal.n ? `<p>Desvio médio geral: <b>${cal.geral > 0 ? "+" : ""}${nf(cal.geral)}</b> spray${Math.abs(cal.geral) === 1 ? "" : "s"} em ${cal.n} registro${cal.n === 1 ? "" : "s"}.</p>
      <div class="tabela"><table><thead><tr><th>Frasco</th><th>Registros</th><th>Desvio médio</th></tr></thead><tbody>${cal.por.map(p => `<tr><td>${esc(p.nome)}</td><td>${p.n}</td><td>${p.media > 0 ? "+" : ""}${nf(p.media)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="nota">Ainda sem pares para comparar. Ao usar “Usei este” e informar os sprays reais, o app guarda o sugerido ao lado.</p>`}
    <h3 style="margin-top:6px">Ajuste opcional</h3>
    <label class="linha-flex"><input type="checkbox" id="spr-ativo" ${ajSpray.ativo ? "checked" : ""} style="width:auto"> Somar sprays ao número do modelo</label>
    <div class="campos">
      <label>Geral (+N)<input id="spr-geral" inputmode="numeric" value="${esc(ajSpray.geral ?? 0)}"></label>
      <label class="largo">Por frasco (um por linha: Nome = N)<textarea id="spr-por" rows="3" placeholder="Odéon = 1">${esc(Object.entries(ajSpray.por || {}).map(([k, v]) => `${k} = ${v}`).join("\n"))}</textarea></label>
    </div>
    <p class="nota">Desligado por padrão. O número do modelo continua visível; o ajuste nunca passa do teto do frasco (EDP/extrait 4, EDT 5, beasts com teto próprio) e não mexe no Désobéissant (6–7).</p>
    <div class="linha-flex"><button class="btn peq" data-acao="salvar-spr">Salvar ajuste</button>${cal.n ? `<button class="btn sec peq" data-acao="spr-sugerir">Usar o desvio medido</button>` : ""}</div>
  </div>
  <div class="bloco"><h3>${doPeriodo ? "Registros do período" : "Últimos 30 registros"} · Dia e Noite</h3><div class="lista">${hist.slice(-30).reverse().map(r => `<article class="card compacto"><span class="pos">${slotIcone(r.slot)}</span><div style="min-width:0"><b>${esc(r.perfume)}</b><div class="casa">${esc(r.data)} · ${slotNome(r.slot)}${r.sprays ? ` · ${esc(r.sprays)} sprays` : ""}${r.pendente ? " · na fila" : ""}</div></div><span></span></article>`).join("")}</div></div>
  ${blocoExportar(exp)}`;
}

// ───────────────────────── calendário de cheiros ─────────────────────────
/** Grade estilo GitHub: colunas = semanas, linhas = seg→dom; cada dia tem metade de cima (Dia) e de baixo (Noite)
 *  na cor do arquétipo usado. Mostra as últimas 16 semanas até o fim do período. */
export function calendario(hist, frascos, ate, de) {
  const arqDe = new Map(frascos.map(f => [f.nome, f.arquetipo]));
  const porDia = new Map();
  for (const r of hist) { if (!porDia.has(r.data)) porDia.set(r.data, {}); porDia.get(r.data)[r.slot] = r.perfume; }
  const fim = new Date(ate + "T12:00:00");
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const semanas = 16, ini = new Date(fim); ini.setDate(ini.getDate() - ((fim.getDay() + 6) % 7) - (semanas - 1) * 7);
  const cel = (nome) => (nome ? `background:${arqDe.has(nome) ? corArq(arqDe.get(nome)) : "var(--leve)"}` : "");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  let cols = "", rotMes = "", mesAnt = -1;
  for (let w = 0; w < semanas; w++) {
    let dias = "";
    for (let d = 0; d < 7; d++) {
      const dt = new Date(ini); dt.setDate(ini.getDate() + w * 7 + d);
      const k = iso(dt), u = porDia.get(k) || {}, futuro = dt > fim, fora = de && k < de;
      const info = `<b>${dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</b> · ☀︎ ${esc(u.M || "—")} · ☾ ${esc(u.N || "—")}`;
      dias += futuro ? `<span class="dia vazio"></span>` : `<button class="dia ${fora ? "fora" : ""} ${u.M || u.N ? "usado" : ""}" data-dia="${k}" data-info="${esc(info)}" aria-label="${esc(k)}"><span style="${cel(u.M)}"></span><span style="${cel(u.N)}"></span></button>`;
    }
    const mesW = new Date(ini); mesW.setDate(ini.getDate() + w * 7);
    rotMes += `<span>${mesW.getMonth() !== mesAnt ? meses[mesW.getMonth()] : ""}</span>`; mesAnt = mesW.getMonth();
    cols += `<div class="sem">${dias}</div>`;
  }
  return `<div class="bloco"><h3>Calendário de cheiros</h3>
    <div class="cal-wrap"><div class="cal-meses">${rotMes}</div><div class="cal">${cols}</div></div>
    <p class="nota" id="calInfo">Cada quadrado é um dia: metade de cima = Dia, de baixo = Noite, na cor do arquétipo. Toque num dia.</p></div>`;
}

// ───────────────────────── passaporte de arquétipos ─────────────────────────
export function passaporte(por, hist, frascos) {
  const usos = new Map();
  for (const c of por.values()) if (c.n) usos.set(c.f.arquetipo, (usos.get(c.f.arquetipo) || 0) + c.n);
  const nomes = Object.keys(ARQ_PATHS);
  const feitos = nomes.filter(n => usos.get(n));
  return `<div class="bloco"><div class="linha-flex"><h3>Passaporte de arquétipos</h3><span class="esp"></span><span class="selo manual">${feitos.length}/16 carimbados</span></div>
    <div class="passaporte">${nomes.map((n, i) => {
      const u = usos.get(n) || 0;
      return `<div class="carimbo ${u ? "ok" : ""}" style="--cor:${corArq(n)};--rot:${((i * 37) % 13) - 6}deg">
        ${arqIcone(n, 26)}<span class="cn">${esc(n)}</span>${u ? `<span class="cu">${u}×</span>` : ""}</div>`;
    }).join("")}</div>
    ${feitos.length < 16 ? `<p class="nota">Faltam: ${nomes.filter(n => !usos.get(n)).map(esc).join(", ")}.</p>` : `<p class="nota">Passaporte completo no período. 🎉</p>`}</div>`;
}
