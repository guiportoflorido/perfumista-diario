// diversao.js — roleta do dia, céu animado dos slots e a simulação de spray ao registrar.
// Tudo respeita "reduzir movimento" do iPhone: sem animação longa quando o sistema pede.
import { esc, tierHTML } from "./util.js";
import { arqIcone, corArq } from "./icones.js";

const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

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
