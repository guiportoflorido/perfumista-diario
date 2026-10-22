// diversao.js — roleta do dia, céu animado dos slots e a simulação de spray ao registrar.
// Tudo respeita "reduzir movimento" do iPhone: sem animação longa quando o sistema pede.
import { esc, tierHTML } from "./util.js";
import { arqIcone, corArq } from "./icones.js";

const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ───────────────────────── nome do dia ─────────────────────────
// Cada dia ganha um nome (“Terça de Âmbar sob Garoa”). Determinístico: a semente é a data, nunca Math.random.
let MATERIAIS = {};
/** Materiais por arquétipo, do data/arquetipos.json (campo `materiais`). */
export function definirMateriais(arquetipos) { MATERIAIS = Object.fromEntries((arquetipos || []).map(a => [a.nome, a.materiais || []])); }

/** Hash djb2 da string (semente estável para escolher variantes). */
export function hashTxt(s) { let h = 5381; for (const c of String(s)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h; }
const escolher = (lista, semente) => lista[semente % lista.length];

const DIAS_NOME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];   // getDay(): 0 = domingo
const ADJETIVOS = [["Esfumada", "Esfumado"], ["Dourada", "Dourado"], ["Serena", "Sereno"], ["Velada", "Velado"], ["Acesa", "Aceso"], ["Lenta", "Lento"]];
// complementos de clima: o primeiro grupo que casar com o dia vence; dentro dele, a semente desempata
const CLIMAS = [
  [c => c.chuva === 2, ["sob Chuva Firme", "em Céu Fechado", "sob Temporal"]],
  [c => c.chuva === 1, ["sob Garoa", "entre Pancadas"]],
  [c => c.T != null && c.T >= 30, c => [`a ${Math.round(c.T)} °C`, "ao Sol Forte"]],
  [c => c.faixaIdx != null && c.faixaIdx <= 1, ["ao Sol Forte", "em Calor Manso"]],
  [c => c.faixaIdx != null && c.faixaIdx >= 4, ["com Frente Fria", "na Brisa Fria"]],
  [c => c.td != null && c.td >= 20, ["em Ar Pesado", "no Mormaço"]],
  [c => c.td != null && c.td < 12, ["em Ar Seco", "sem Nuvens"]],
  [c => c.chuva === 0, ["sem Nuvens", "em Ar Leve", "em Tarde Mansa"]],
  [c => c.faixaIdx != null || c.T != null, ["em Ar Leve", "em Tarde Mansa"]],
];
function complementoClima(c, semente) {
  for (const [casa, lista] of CLIMAS) if (casa(c)) return escolher(typeof lista === "function" ? lista(c) : lista, semente);
  return "";
}

/** Material que o nome do dia usa para essa data e esse arquétipo (o mesmo de nomeDoDia); null sem materiais. */
export function materialDoDia(data, arquetipo) {
  const mats = MATERIAIS[arquetipo] || [];
  return mats.length ? escolher(mats, hashTxt(data + "|mat")) : null;
}

/** Nome do dia: <dia da semana> <de | Adjetivo de> <Material> <clima>. top1: {arquetipo} (ou o nome do arquétipo); sem
 *  top 1 fica só dia + clima; sem clima (chuva, faixa, T e Td nulos), só dia + material. */
export function nomeDoDia({ data, faixaIdx = null, chuva = null, td = null, T = null, top1 = null }) {
  const sem = hashTxt(data), wd = new Date(data + "T12:00:00").getDay(), dia = DIAS_NOME[wd];
  const arq = typeof top1 === "string" ? top1 : top1?.arquetipo;
  const mats = MATERIAIS[arq] || [];
  const clima = complementoClima({ faixaIdx, chuva, td, T }, hashTxt(data + "|clima"));
  if (!mats.length) return [dia, clima].filter(Boolean).join(" ");
  const mat = escolher(mats, hashTxt(data + "|mat"));
  const forma = sem % 3;
  const meio = forma === 0 ? `de ${mat}` : forma === 1 ? mat : `${escolher(ADJETIVOS, hashTxt(data + "|adj"))[wd === 0 || wd === 6 ? 1 : 0]} de ${mat}`;
  return [dia, meio, clima].filter(Boolean).join(" ");
}

// ───────────────────────── céu do slot ─────────────────────────
/** Camada decorativa atrás do cartão de clima. tipo: "dia" | "noite"; chuva: 0 seco · 1 pancadas · 2 contínua. */
export function ceuHTML(tipo, chuva = 0, faixaIdx = 2) {
  const quente = faixaIdx <= 1, frio = faixaIdx >= 4;
  const astro = tipo === "dia"
    ? `<span class="sol ${chuva === 2 ? "encoberto" : ""} ${quente ? "forte" : ""}"><span class="raios"></span></span>`
    : `<span class="lua"></span>${chuva < 2 ? Array.from({ length: 9 }, (_, i) => `<span class="estrela" style="--x:${(i * 37) % 92 + 4}%;--y:${(i * 53) % 70 + 6}%;--d:${(i % 5) * 0.6}s"></span>`).join("") : ""}`;
  const nuvens = chuva >= 1 ? `<span class="nuvem n1"></span>${chuva === 2 ? `<span class="nuvem n2"></span>` : ""}` : (tipo === "dia" && !quente ? `<span class="nuvem n1 leve"></span>` : "");
  const agua = chuva >= 1 ? `<span class="chuva ${chuva === 2 ? "forte" : ""}"></span>` : "";
  const brisa = frio && tipo === "dia" ? `<span class="brisa"></span>` : "";
  return `<span class="ceu ceu-${tipo}" aria-hidden="true">${astro}${nuvens}${agua}${brisa}</span>`;
}

// ───────────────────────── roleta do dia ─────────────────────────
/** Sorteio entre os 3 primeiros, com peso pelo score (quem está na frente tem um pouco mais de chance). */
export function sortear(top, aleatorio = Math.random) {
  const cands = top.slice(0, 3);
  const tot = cands.reduce((s, t) => s + Math.max(t.score, 1), 0);
  let r = aleatorio() * tot;
  for (const t of cands) { r -= Math.max(t.score, 1); if (r <= 0) return t; }
  return cands[cands.length - 1];
}

/** Abre a roleta num overlay. onUsar(t) é chamado se ele tocar em "Usei este". */
export function abrirRoleta(raiz, slotNome, top, onUsar) {
  const cands = top.slice(0, 3);
  if (!cands.length) return;
  const escolhido = sortear(cands);
  const voltas = semMovimento() ? 0 : 7;
  const fita = [];
  for (let v = 0; v < voltas; v++) fita.push(...cands);
  const alvo = fita.length + cands.indexOf(escolhido);
  fita.push(...cands, ...cands);
  const H = 64;
  raiz.innerHTML = `<div class="veu roleta-veu" data-fechar>
    <div class="roleta" role="dialog" aria-modal="true" aria-label="Roleta do slot ${esc(slotNome)}">
      <p class="roleta-tit">🎰 Roleta do slot ${esc(slotNome)}</p>
      <div class="rolo"><div class="rolo-janela"></div><div class="fita" style="transform:translateY(${H}px)">
        ${fita.map(t => `<div class="item" style="height:${H}px">${arqIcone(t.arquetipo, 26)}<span>${esc(t.nome)}</span></div>`).join("")}
      </div></div>
      <div class="roleta-res" hidden></div>
    </div></div>`;
  const fitaEl = raiz.querySelector(".fita"), res = raiz.querySelector(".roleta-res");
  const final = -(alvo * H) + H;   // item alvo na linha do meio
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fitaEl.style.transition = voltas ? "transform 2.6s cubic-bezier(.12,.75,.16,1)" : "none";
    fitaEl.style.transform = `translateY(${final}px)`;
  }));
  const mostrar = () => {
    raiz.querySelector(".rolo")?.classList.add("parou");
    res.hidden = false;
    res.innerHTML = `<div class="roleta-card" style="--cor:${corArq(escolhido.arquetipo)}">
        <span class="ic">${arqIcone(escolhido.arquetipo, 34)}</span>
        <span><b>${esc(escolhido.nome)}</b>${tierHTML(escolhido.tier)}<br><span class="nota">${esc(escolhido.casa)} · ${escolhido.sprays} spray${escolhido.sprays > 1 ? "s" : ""} · #${top.indexOf(escolhido) + 1} do modelo</span></span>
      </div>
      <div class="linha-flex" style="justify-content:center">
        <button class="btn" data-roleta="usar">Usei este</button>
        <button class="btn sec" data-roleta="girar">Girar de novo</button>
        <button class="btn sec" data-fechar>Fechar</button>
      </div>`;
    res.querySelector('[data-roleta="usar"]').onclick = () => { raiz.innerHTML = ""; onUsar(escolhido); };
    res.querySelector('[data-roleta="girar"]').onclick = () => abrirRoleta(raiz, slotNome, top, onUsar);
    try { navigator.vibrate?.(30); } catch { /* sem vibração */ }
  };
  if (voltas) fitaEl.addEventListener("transitionend", mostrar, { once: true }); else mostrar();
}

// ───────────────────────── chacoalhar para sortear ─────────────────────────
/** iOS só entrega o movimento com permissão pedida dentro de um toque (e pede de novo a cada carga da página). */
export const movimentoPedePermissao = () => typeof globalThis.DeviceMotionEvent?.requestPermission === "function";
/** Pede a permissão de movimento (chamar no handler de um toque). true se pode ouvir o acelerômetro. */
export async function pedirMovimento() {
  if (!globalThis.DeviceMotionEvent) return false;
  if (!movimentoPedePermissao()) return true;
  try { return (await DeviceMotionEvent.requestPermission()) === "granted"; } catch { return false; }
}

/** Ouve o acelerômetro: 2 picos acima de `limiar` m/s² (aceleração com gravidade) em até `janela` ms = chacoalhada;
 *  depois espera `pausa` ms antes de aceitar outra. Devolve a função que desliga o ouvinte. */
export function ativarChacoalho(onChacoalho, { limiar = 18, janela = 400, pausa = 2000 } = {}) {
  let picos = [], ultimo = -Infinity;
  const h = e => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const t = performance.now();
    if (Math.hypot(a.x || 0, a.y || 0, a.z || 0) < limiar || t - ultimo < pausa) return;
    picos = picos.filter(x => t - x <= janela); picos.push(t);
    if (picos.length >= 2) { ultimo = t; picos = []; onChacoalho(); }
  };
  addEventListener("devicemotion", h);
  return () => removeEventListener("devicemotion", h);
}

// ───────────────────────── raspadinha do esquecido ─────────────────────────
/** Card coberto do esquecido da semana. `conteudo` é o HTML já pronto do frasco; revelado → aberto, sem cobertura.
 *  Com “reduzir movimento”, um botão Revelar no lugar da tela de raspar. */
export function raspadinhaHTML({ conteudo, revelado }) {
  const capa = revelado ? "" : semMovimento()
    ? `<div class="raspa-capa"><button class="btn" data-raspa-revelar>Revelar</button></div>`
    : `<canvas class="raspa-tela" aria-label="Raspe para revelar"></canvas>`;
  return `<div class="raspa ${revelado ? "revelado" : ""}" data-raspa>
    <p class="raspa-tit">🎟️ Esquecido da semana${revelado ? "" : " — raspe para revelar"}</p>
    <div class="raspa-corpo"><div class="raspa-conteudo" ${revelado ? "" : 'aria-hidden="true"'}>${conteudo}</div>${capa}</div></div>`;
}

/** Liga a raspagem: pincel de ~28 px apaga a cobertura (destination-out); a cada 10 traços amostra o alfa numa grade
 *  16×16 e, com ≥ 60 % raspado, a cobertura some com fade e chama onRevelar(). */
export function ligarRaspadinha(el, onRevelar) {
  if (!el || el.dataset.ligada) return;
  el.dataset.ligada = "1";
  let feito = false;
  const revelar = () => {
    if (feito) return; feito = true;
    el.querySelector(".raspa-conteudo")?.removeAttribute("aria-hidden");
    const capa = el.querySelector(".raspa-tela, .raspa-capa");
    el.querySelector(".raspa-tit").textContent = "🎟️ Esquecido da semana";
    el.classList.add("revelado");
    if (capa) { capa.classList.add("some"); setTimeout(() => capa.remove(), semMovimento() ? 0 : 450); }
    try { navigator.vibrate?.(25); } catch { /* sem vibração */ }
    onRevelar();
  };
  const btn = el.querySelector("[data-raspa-revelar]");
  if (btn) { btn.onclick = revelar; return; }
  const cv = el.querySelector(".raspa-tela");
  if (!cv) return;
  const corpo = el.querySelector(".raspa-corpo"), W = corpo.clientWidth, H = corpo.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2), ctx = cv.getContext("2d");
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  // prata com textura: gradiente + ruído desenhado uma vez
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#c9ccd1"); g.addColorStop(.5, "#eef0f2"); g.addColorStop(1, "#aeb3ba");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 18; i++) {
    ctx.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "90,95,105"},${(Math.random() * .18).toFixed(2)})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
  ctx.fillStyle = "rgba(60,64,72,.55)"; ctx.font = "600 15px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("raspe aqui ✦", W / 2, H / 2 + 5);
  ctx.globalCompositeOperation = "destination-out"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 28;
  let ant = null, tracos = 0;
  const ponto = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const raspado = () => {
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let vazio = 0;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const x = Math.floor((i + .5) * cv.width / 16), y = Math.floor((j + .5) * cv.height / 16);
      if (img[(y * cv.width + x) * 4 + 3] < 40) vazio++;
    }
    return vazio / 256;
  };
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); ant = ponto(e); ctx.beginPath(); ctx.arc(ant.x, ant.y, 14, 0, Math.PI * 2); ctx.fill(); });
  cv.addEventListener("pointermove", e => {
    if (!ant || feito) return;
    const p = ponto(e);
    ctx.beginPath(); ctx.moveTo(ant.x, ant.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ant = p;
    if (++tracos % 10 === 0 && raspado() >= .6) revelar();
  });
  const solta = () => { ant = null; if (!feito && raspado() >= .6) revelar(); };
  cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta);
}

// ───────────────────────── spray ao registrar ─────────────────────────
/** Overlay com um frasco que borrifa `sprays` vezes. Resolve quando termina (ou quando ele toca para pular). */
export function animarSpray({ sprays, nome, arquetipo }) {
  const n = Math.max(1, Math.min(Number(sprays) || 1, 10));
  if (semMovimento()) return Promise.resolve();
  const cor = corArq(arquetipo) === "currentColor" ? "#9aa4ff" : corArq(arquetipo);
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.className = "spray-ov";
    ov.innerHTML = `<canvas></canvas>
      <div class="frasco" style="--cor:${cor}"><span class="tampa"></span><span class="bico"></span><span class="corpo"><span class="liquido"></span><span class="rotulo">${arqIcone(arquetipo, 22)}</span></span></div>
      <p class="spray-txt"><b>${esc(nome)}</b><br><span class="conta">0</span> / ${n} spray${n > 1 ? "s" : ""}</p>
      <p class="spray-pular">toque para pular</p>`;
    document.body.append(ov);
    const cv = ov.querySelector("canvas"), ctx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.scale(dpr, dpr);
    const bico = () => { const b = ov.querySelector(".bico").getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; };
    const rgb = (() => { const h = cor.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); })();
    const parts = [];
    let feitos = 0, fim = false, ultimo = performance.now();
    const puff = () => {
      const o = bico();
      ov.querySelector(".frasco").classList.remove("aperta"); void ov.offsetWidth; ov.querySelector(".frasco").classList.add("aperta");
      for (let i = 0; i < 90; i++) {
        const ang = (-160 + (Math.random() - 0.5) * 40) * Math.PI / 180, v = 2.5 + Math.random() * 5.5;
        parts.push({ x: o.x, y: o.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - Math.random() * 1.2, r: 1 + Math.random() * 2.5, a: 0.55 + Math.random() * 0.35, cresce: 0.05 + Math.random() * 0.12 });
      }
      feitos++; ov.querySelector(".conta").textContent = feitos;
      try { navigator.vibrate?.(18); } catch { /* sem vibração */ }
    };
    const passo = t => {
      const dt = Math.min((t - ultimo) / 16.7, 3); ultimo = t;
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.965; p.vy = p.vy * 0.965 - 0.02 * dt; p.r += p.cresce * dt * 2; p.a -= 0.0085 * dt;
        if (p.a <= 0) { parts.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.a})`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!fim || parts.length) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
    const timers = [];
    for (let i = 0; i < n; i++) timers.push(setTimeout(puff, 350 + i * 480));
    const encerrar = () => {
      if (fim) return; fim = true; timers.forEach(clearTimeout);
      ov.classList.add("saindo"); setTimeout(() => { ov.remove(); resolve(); }, 450);
    };
    timers.push(setTimeout(encerrar, 350 + n * 480 + 1100));
    ov.addEventListener("click", encerrar);
  });
}
