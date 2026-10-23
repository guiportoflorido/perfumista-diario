// wrapped.js — “Wrapped” do mês: stories em tela cheia com o resumo do mês (resumoMes, em estatisticas.js) e
// “Salvar imagem” (canvas 1080×1920 desenhado à mão, sem bibliotecas). Reduzir movimento: sem transições.
import { esc } from "./util.js";
import { arqIcone, corArq } from "./icones.js";

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const Mai = s => s.charAt(0).toUpperCase() + s.slice(1);
const nf = (x, d = 1) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: d });
const dataBR = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const DURACAO = 5000;

/** Stories do mês (6 a 8): cada um {rotulo, numero, frase, arq}; o último traz a grade dos dias. Campo nulo = story pulado. */
export function storiesDoMes(r, ano, mes, fotoDe = () => "") {
  if (!r?.total) return [];
  const m = MESES[mes - 1], st = [];
  st.push({ rotulo: `Seu ${m} em perfume`, numero: String(r.total), frase: `${r.total === 1 ? "uso" : "usos"} de Dia e Noite · ${r.distintos} de ${r.totalGrade} frascos da grade`, arq: r.arquetipo?.nome });
  if (r.frascoDoMes) st.push({ rotulo: "Frasco do mês", numero: r.frascoDoMes.nome, foto: fotoDe(r.frascoDoMes.nome, 120), frase: `${r.frascoDoMes.n} uso${r.frascoDoMes.n === 1 ? "" : "s"}${r.frascoDoMes.nota != null ? ` · NotaDia ${nf(r.frascoDoMes.nota)}` : ""}`, arq: r.frascoDoMes.arquetipo, grande: true });
  if (r.arquetipo) st.push({ rotulo: "Arquétipo dominante", numero: `${Math.round(r.arquetipo.pct * 100)}%`, frase: `dos usos foram ${r.arquetipo.nome}`, arq: r.arquetipo.nome, icone: true });
  if (r.maisQuente && r.maisFrio && r.maisQuente.data !== r.maisFrio.data)
    st.push({ rotulo: "Extremos", numero: `${nf(r.maisQuente.T, 0)}° · ${nf(r.maisFrio.T, 0)}°`, frase: `${dataBR(r.maisQuente.data)} com ${r.maisQuente.perfume} · ${dataBR(r.maisFrio.data)} com ${r.maisFrio.perfume}`, arq: r.arquetipo?.nome });
  if (r.resgates) st.push({ rotulo: "Resgates", numero: String(r.resgates.length), frase: `parado${r.resgates.length > 1 ? "s" : ""} há 45+ dias e de volta: ${r.resgates.slice(0, 4).join(", ")}${r.resgates.length > 4 ? "…" : ""}`, arq: r.arquetipo?.nome });
  if (r.sequencia) st.push({ rotulo: "Variedade", numero: `${r.sequencia} dias`, frase: "seguidos sem repetir o arquétipo do dia anterior", arq: r.arquetipo?.nome });
  if (r.notaMedia != null) st.push({ rotulo: "NotaDia média", numero: nf(r.notaMedia), frase: "de 5 — quanto o perfume combinou com o slot", arq: r.frascoDoMes?.arquetipo });
  if (r.subidao) st.push({ rotulo: "Subidão no Duelo", numero: `+${Math.round(r.subidao.ganho)}`, frase: `${r.subidao.nome}: Elo ${Math.round(r.subidao.de)} → ${Math.round(r.subidao.para)}`, arq: r.frascoDoMes?.arquetipo });
  const corpo = st.slice(0, 7);
  const dias = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => r.dias.get(`${ano}-${String(mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`) || null);
  corpo.push({ rotulo: `${Mai(m)} ${ano}`, numero: r.material ? `${Mai(m)} foi ${r.material}` : `${Mai(m)} em ${r.total} usos`, frase: "um ícone por dia, na cor do arquétipo", arq: r.arquetipo?.nome, dias, final: true });
  return corpo;
}

const fundo = arq => { const c = corArq(arq); return c === "currentColor" ? "#6b6f86" : c; };

function storyHTML(s) {
  return `<div class="wr-story" style="--cor:${fundo(s.arq)}">
    <p class="wr-rot">${esc(s.rotulo)}</p>
    ${s.icone ? `<span class="wr-ic">${arqIcone(s.arq, 96)}</span>` : ""}
    ${s.foto ? `<span class="wr-foto">${s.foto}</span>` : ""}
    <p class="wr-num ${s.grande || s.final ? "wr-txt" : ""}">${esc(s.numero)}</p>
    <p class="wr-frase">${esc(s.frase)}</p>
    ${s.dias ? `<div class="wr-grade">${Array.from({ length: 35 }, (_, i) => { const a = s.dias[i]; return i >= s.dias.length ? `<span></span>` : a ? `<span class="d">${arqIcone(a, 22)}</span>` : `<span class="d vazio"></span>`; }).join("")}</div>` : ""}
  </div>`;
}

/** Abre os stories em tela cheia. Toque à direita avança, à esquerda volta, segurar pausa; 5 s por story; X fecha. */
export function abrirWrapped(raiz, stories, titulo) {
  if (!stories.length) return;
  let i = 0, t0 = 0, pausado = false, gasto = 0, raf = 0;
  raiz.innerHTML = `<div class="wr" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="wr-barras">${stories.map(() => `<span><i></i></span>`).join("")}</div>
    <button class="wr-x" aria-label="Fechar">✕</button>
    <div class="wr-palco"></div>
    <button class="wr-salvar btn sec peq">Salvar imagem</button></div>`;
  const ov = raiz.querySelector(".wr"), palco = ov.querySelector(".wr-palco"), barras = [...ov.querySelectorAll(".wr-barras i")];
  const mostrar = n => {
    i = Math.max(0, Math.min(n, stories.length - 1)); gasto = 0; t0 = performance.now();
    palco.innerHTML = storyHTML(stories[i]);
    if (!semMovimento()) palco.firstElementChild.classList.add("entra");
    barras.forEach((b, k) => { b.style.width = k < i ? "100%" : "0%"; });
  };
  const fechar = () => { cancelAnimationFrame(raf); raiz.innerHTML = ""; };
  const tick = t => {
    if (!raiz.contains(ov)) return;
    if (!pausado) {
      const p = Math.min(1, (gasto + t - t0) / DURACAO);
      barras[i].style.width = `${p * 100}%`;
      if (p >= 1) { if (i < stories.length - 1) mostrar(i + 1); else { barras[i].style.width = "100%"; pausado = true; } }
    }
    raf = requestAnimationFrame(tick);
  };
  let desde = 0, segurou = false, timerSegura = 0;
  palco.addEventListener("pointerdown", () => {
    desde = performance.now(); segurou = false;
    timerSegura = setTimeout(() => { segurou = true; if (!pausado) { gasto += performance.now() - t0; pausado = true; } }, 250);
  });
  palco.addEventListener("pointerup", e => {
    clearTimeout(timerSegura);
    if (segurou) { pausado = false; t0 = performance.now(); return; }
    if (performance.now() - desde > 600) return;
    const r = palco.getBoundingClientRect();
    pausado = false;
    mostrar(e.clientX - r.left > r.width / 2 ? i + 1 : i - 1);
  });
  ov.querySelector(".wr-x").onclick = fechar;
  ov.querySelector(".wr-salvar").onclick = () => salvarImagem(stories[i], titulo);
  ov.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); if (e.key === "ArrowRight") mostrar(i + 1); if (e.key === "ArrowLeft") mostrar(i - 1); });
  mostrar(0);
  ov.querySelector(".wr-x").focus();
  raf = requestAnimationFrame(tick);
}

// ───────────── “Salvar imagem”: o story atual num PNG 1080×1920 ─────────────
function quebrar(ctx, txt, larg) {
  const linhas = []; let l = "";
  for (const p of String(txt).split(" ")) { const t = l ? `${l} ${p}` : p; if (ctx.measureText(t).width > larg && l) { linhas.push(l); l = p; } else l = t; }
  if (l) linhas.push(l);
  return linhas;
}
export function desenharStory(cv, s, titulo) {
  const W = 1080, H = 1920, ctx = cv.getContext("2d");
  cv.width = W; cv.height = H;
  ctx.fillStyle = fundo(s.arq); ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,0,0,.15)"); g.addColorStop(1, "rgba(0,0,0,.6)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const fonte = (peso, px) => `${peso} ${px}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = .85; ctx.font = fonte(600, 54); ctx.fillText(s.rotulo, 96, 300); ctx.globalAlpha = 1;
  const grandeTxt = s.grande || s.final;
  ctx.font = fonte(800, grandeTxt ? 120 : 260);
  let y = grandeTxt ? 620 : 760;
  for (const l of quebrar(ctx, s.numero, W - 192)) { ctx.fillText(l, 96, y); y += grandeTxt ? 140 : 280; }
  ctx.font = fonte(500, 52); ctx.globalAlpha = .92;
  for (const l of quebrar(ctx, s.frase, W - 192)) { y += 20; ctx.fillText(l, 96, y + 40); y += 50; }
  ctx.globalAlpha = 1;
  if (s.dias) {   // grade 7×5: um círculo por dia, na cor do arquétipo (cinza sem registro)
    const lado = 112, x0 = (W - 7 * lado) / 2, y0 = Math.max(y + 120, 1180);
    s.dias.forEach((a, k) => {
      const cx = x0 + (k % 7) * lado + lado / 2, cy = y0 + Math.floor(k / 7) * lado + lado / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fillStyle = a ? fundo(a) : "rgba(255,255,255,.18)"; ctx.fill();
      if (a) { ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.stroke(); }
    });
  }
  ctx.font = fonte(600, 40); ctx.globalAlpha = .8; ctx.fillText(`Perfumista Diário · ${titulo}`, 96, H - 120); ctx.globalAlpha = 1;
}

async function salvarImagem(s, titulo) {
  const cv = document.createElement("canvas");
  desenharStory(cv, s, titulo);
  const blob = await new Promise(r => cv.toBlob(r, "image/png"));
  const nome = `wrapped-${titulo.toLowerCase().replace(/\s+/g, "-")}.png`;
  const arq = new File([blob], nome, { type: "image/png" });
  if (navigator.canShare?.({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: titulo }); return; }
    catch (e) { if (e?.name === "AbortError") return; /* outro erro: cai no download */ }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
