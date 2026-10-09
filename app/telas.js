// telas.js — Coleção, Playbook e Histórico (fase 4). Recebem o contexto pronto do main.js e devolvem HTML.
import { FAIXAS } from "../engine/index.js";
import { esc, ROT_OC, OCAS_TODAS, pinta, faixaHTML, nf, tierHTML, slotNome, md } from "./util.js";
import { daGrade, contagens, agrupar, esquecidos, usoVsJanelas, calibracao } from "./estatisticas.js";

const TIERS = ["S", "A", "B", "C"];
const EIXOS = { P: "P · seco-mineral", S: "S · ambarado-doce", F: "F · fora do eixo" };
const opt = (v, rot, atual) => `<option value="${esc(v)}" ${String(atual) === String(v) ? "selected" : ""}>${esc(rot)}</option>`;
const chip = (grupo, v, rot, on) => `<button class="chip" data-filtro="${grupo}" data-v="${esc(v)}" aria-pressed="${on}">${esc(rot)}</button>`;
const quando = d => (d === null ? "sem registro" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} d`);

// ───────────────────────── Coleção ─────────────────────────
export function telaColecao({ frascos, hist, hoje, janelas, filtro }) {
  const c = contagens(hist, frascos, hoje);
  const grade = frascos.filter(daGrade);
  const arqs = [...new Set(grade.map(f => f.arquetipo))].sort((a, b) => a.localeCompare(b));
  const q = (filtro.q || "").toLowerCase();
  const lista = grade.filter(f => {
    if (filtro.tier && f.tier !== filtro.tier) return false;
    if (filtro.eixo && f.eixo !== filtro.eixo) return false;
    if (filtro.arq && f.arquetipo !== filtro.arq) return false;
    if (filtro.faixa !== "" && filtro.faixa != null || filtro.oc) {
      const js = janelas.get(f.nome) || [];
      if (!js.some(j => (filtro.faixa === "" || filtro.faixa == null || j.faixaIdx === Number(filtro.faixa)) && (!filtro.oc || j.ocasiao === filtro.oc))) return false;
    }
    if (q && !`${f.nome} ${f.casa} ${f.arquetipo}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.nome.localeCompare(b.nome));
  const papelNaCelula = f => {
    if (filtro.faixa === "" || filtro.faixa == null || !filtro.oc) return "";
    const j = (janelas.get(f.nome) || []).find(x => x.faixaIdx === Number(filtro.faixa) && x.ocasiao === filtro.oc);
    return j ? ` · <b>${j.papel}</b>` : "";
  };
  return `<p class="nota">Grade: ${grade.length} frascos · ${TIERS.map(t => `${t} ${grade.filter(f => f.tier === t).length}`).join(" · ")}. Camada custo fica fora.</p>
  <div class="bloco">
    <input type="search" id="col-q" placeholder="Buscar frasco, casa ou arquétipo" value="${esc(filtro.q || "")}" aria-label="Buscar">
    <div class="chips rolagem">${chip("tier", "", "Todos", !filtro.tier)}${TIERS.map(t => chip("tier", t, `Tier ${t}`, filtro.tier === t)).join("")}</div>
    <div class="chips rolagem">${chip("eixo", "", "Todo eixo", !filtro.eixo)}${Object.entries(EIXOS).map(([k, r]) => chip("eixo", k, r, filtro.eixo === k)).join("")}</div>
    <div class="campos">
      <label>Arquétipo<select id="col-arq">${opt("", "Todos", filtro.arq)}${arqs.map(a => opt(a, a, filtro.arq)).join("")}</select></label>
      <label>Faixa<select id="col-faixa">${opt("", "Todas", filtro.faixa ?? "")}${FAIXAS.map((x, i) => opt(i, x, filtro.faixa ?? "")).join("")}</select></label>
      <label>Ocasião<select id="col-oc">${opt("", "Todas", filtro.oc)}${OCAS_TODAS.map(o => opt(o, ROT_OC[o], filtro.oc)).join("")}</select></label>
    </div>
    <p class="nota">${lista.length} frasco${lista.length === 1 ? "" : "s"}${filtro.faixa !== "" && filtro.faixa != null || filtro.oc ? " com janela no playbook nesse recorte" : ""}.</p>
  </div>
  <div class="lista">${lista.length ? lista.map(f => {
    const k = c.por.get(f.nome);
    return `<article class="card"><span class="pos">${tierHTML(f.tier)}</span>
      <div style="min-width:0"><button class="nome" data-ficha="${esc(f.nome)}">${esc(f.nome)}</button><div class="casa">${esc(f.casa)} · ${esc(f.arquetipo)} · eixo ${esc(f.eixo)}${papelNaCelula(f)}</div></div>
      <span class="score" title="Janelas no playbook">${f.janelas}</span>
      <div class="meta"><span>${k.n} uso${k.n === 1 ? "" : "s"}${k.n ? ` (☀︎${k.M} ☾${k.N})` : ""}</span><span>último: <b>${quando(k.dias)}</b></span>${f.janelas_estimadas ? `<span class="selo aviso">janelas estimadas</span>` : ""}</div>
    </article>`;
  }).join("") : `<p class="vazio">Nenhum frasco nesse recorte.</p>`}</div>
  <p class="nota">Número à direita = janelas no playbook.</p>`;
}

// ───────────────────────── Playbook ─────────────────────────
export function telaPlaybook({ playbook, faixaSel, ajSpray }) {
  if (!playbook) return `<h2>Playbook</h2><p class="nota">Carregando…</p>`;
  const fi = Number(faixaSel ?? 2), faixa = playbook.faixas[fi], g = playbook.grade[faixa];
  const nomeBtn = n => `<button class="nome-inline" data-ficha="${esc(n)}">${esc(n)}</button>`;
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
export function telaHistorico({ frascos, hist, hoje, fila, ajSpray, limiteEsq = 45 }) {
  const c = contagens(hist, frascos, hoje);
  if (!hist.length) return `<h2>Histórico</h2><div class="bloco"><p class="vazio">Sem registros ainda. Conecte a planilha em Ajustes ou registre um uso.</p></div>`;
  const barras = (pares, max) => `<div class="barras">${pares.map(([k, v]) => `<div class="barra"><span class="t">${k}</span><span class="trilho"><span style="width:${max ? (v / max) * 100 : 0}%"></span></span><span class="n">${v}</span></div>`).join("")}</div>`;
  const usados = [...c.por.values()].filter(x => x.n).sort((a, b) => b.n - a.n || (a.ultimo < b.ultimo ? 1 : -1));
  const porArq = agrupar(c.por, f => f.arquetipo).filter(([, v]) => v);
  const porTier = TIERS.map(t => [`Tier ${t}`, [...c.por.values()].filter(x => x.f.tier === t).reduce((s, x) => s + x.n, 0)]);
  const slots = [["☀︎ Dia", hist.filter(r => r.slot === "M" && r.data <= hoje).length], ["☾ Noite", hist.filter(r => r.slot === "N" && r.data <= hoje).length]];
  const esq = esquecidos(c.por, limiteEsq);
  const uv = usoVsJanelas(c.por).filter(x => x.usos || x.janelas);
  const acima = uv.filter(x => x.desvio >= 1).sort((a, b) => b.desvio - a.desvio).slice(0, 8);
  const cal = calibracao(fila);
  return `<h2>Histórico</h2>
  <div class="kpis">
    <div class="kpi"><span class="v">${c.total}</span><span class="l">usos de frascos da grade</span></div>
    <div class="kpi"><span class="v">${c.cobertura}</span><span class="l">dias desde o 1º registro (${esc(c.primeiro || "—")})</span></div>
    <div class="kpi"><span class="v">${usados.length}/${c.por.size}</span><span class="l">frascos usados ao menos 1×</span></div>
  </div>
  ${c.cobertura < 90 ? `<p class="nota">Diário com menos de 90 dias: não serve ainda para conclusões de desbaste sobre os B.</p>` : ""}
  <div class="bloco"><h3>Mais usados</h3>${usados.length ? barras(usados.slice(0, 15).map(x => [`<button class="nome-inline" data-ficha="${esc(x.f.nome)}">${esc(x.f.nome)}</button>`, x.n]), usados[0].n) : `<p class="nota">Nenhum.</p>`}</div>
  <div class="duas">
    <div class="bloco"><h3>Por slot</h3>${barras(slots, Math.max(...slots.map(s => s[1])))}</div>
    <div class="bloco"><h3>Por tier</h3>${barras(porTier, Math.max(...porTier.map(s => s[1]), 1))}</div>
  </div>
  <div class="bloco"><h3>Por arquétipo</h3>${porArq.length ? barras(porArq.map(([k, v]) => [esc(k), v]), porArq[0][1]) : `<p class="nota">Nenhum.</p>`}</div>
  <div class="bloco"><h3>Esquecidos · sem uso há ${limiteEsq}+ dias ou sem registro · ${esq.length}</h3>
    <p class="nota">“Sem registro” é ausência no diário, não prova de que você não usou. O diário cobre ${c.cobertura} dias.</p>
    ${(() => { const item = x => `<article class="card compacto"><span class="pos">${tierHTML(x.f.tier)}</span><div style="min-width:0"><button class="nome" data-ficha="${esc(x.f.nome)}">${esc(x.f.nome)}</button><div class="casa">${esc(x.f.arquetipo)} · ${x.f.janelas} janelas</div></div><span class="nota">${quando(x.dias)}</span></article>`;
      return `<div class="lista">${esq.slice(0, 8).map(item).join("")}</div>${esq.length > 8 ? `<details><summary>Ver os outros ${esq.length - 8}</summary><div class="lista" style="margin-top:8px">${esq.slice(8).map(item).join("")}</div></details>` : ""}`; })()}
  </div>
  <div class="bloco"><h3>Uso × janelas do playbook</h3>
    <p class="nota">Esperado = seus ${c.total} usos repartidos pelas janelas de cada frasco. Mostra quem você usa mais do que o playbook prevê.</p>
    ${acima.length ? `<div class="tabela"><table><thead><tr><th>Frasco</th><th>Janelas</th><th>Usos</th><th>Esperado</th></tr></thead><tbody>${acima.map(x => `<tr><td>${esc(x.nome)} ${tierHTML(x.tier)}</td><td>${x.janelas}</td><td>${x.usos}</td><td>${nf(x.esperado)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="nota">Poucos usos para comparar.</p>`}
  </div>
  <div class="bloco"><h3>Sprays · real × sugerido pelo modelo</h3>
    ${cal.n ? `<p>Desvio médio geral: <b>${cal.geral > 0 ? "+" : ""}${nf(cal.geral)}</b> spray${Math.abs(cal.geral) === 1 ? "" : "s"} em ${cal.n} registro${cal.n === 1 ? "" : "s"}.</p>
      <div class="tabela"><table><thead><tr><th>Frasco</th><th>Registros</th><th>Desvio médio</th></tr></thead><tbody>${cal.por.map(p => `<tr><td>${esc(p.nome)}</td><td>${p.n}</td><td>${p.media > 0 ? "+" : ""}${nf(p.media)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="nota">Ainda sem pares para comparar. Ao usar “Usei este” e informar os sprays reais, o app guarda o sugerido ao lado.</p>`}
    <p class="nota">Só conta registros feitos pelo app neste aparelho (a planilha não guarda o sugerido).</p>
    <h3 style="margin-top:6px">Ajuste opcional</h3>
    <label class="linha-flex"><input type="checkbox" id="spr-ativo" ${ajSpray.ativo ? "checked" : ""} style="width:auto"> Somar sprays ao número do modelo</label>
    <div class="campos">
      <label>Geral (+N)<input id="spr-geral" inputmode="numeric" value="${esc(ajSpray.geral ?? 0)}"></label>
      <label class="largo">Por frasco (um por linha: Nome = N)<textarea id="spr-por" rows="3" placeholder="Odéon = 1">${esc(Object.entries(ajSpray.por || {}).map(([k, v]) => `${k} = ${v}`).join("\n"))}</textarea></label>
    </div>
    <p class="nota">Desligado por padrão. O número do modelo continua visível; o ajuste nunca passa do teto do frasco (EDP/extrait 4, EDT 5, beasts com teto próprio) e não mexe no Désobéissant (6–7).</p>
    <div class="linha-flex"><button class="btn peq" data-acao="salvar-spr">Salvar ajuste</button>${cal.n ? `<button class="btn sec peq" data-acao="spr-sugerir">Usar o desvio medido</button>` : ""}</div>
  </div>
  <div class="bloco"><h3>Registros recentes</h3><div class="lista">${hist.filter(r => r.data <= hoje).slice(-20).reverse().map(r => `<article class="card compacto"><span class="pos">${esc(r.slot)}</span><div style="min-width:0"><b>${esc(r.perfume)}</b><div class="casa">${esc(r.data)} · ${slotNome(r.slot)}${r.sprays ? ` · ${esc(r.sprays)} sprays` : ""}${r.pendente ? " · na fila" : ""}</div></div><span></span></article>`).join("")}</div></div>`;
}
