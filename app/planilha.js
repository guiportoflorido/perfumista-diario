// planilha.js — regras puras sobre os dados da planilha (sem rede): tier da aba Tiers vence o JSON da grade,
// frascos sem "Frasco Gui" saem da recomendação, diário da planilha + fila local viram o histórico do modelo.

const idx = (cab, nome) => cab.indexOf(nome);

/** Linhas da aba Tiers → lista de {casa, perfume, nomeDiario, posse, tier}. */
export function lerTiers(rows) {
  if (!rows || rows.length < 2) return [];
  const c = rows[0];
  const iC = idx(c, "Casa"), iP = idx(c, "Perfume"), iN = idx(c, "Nome no diário"), iPo = idx(c, "Posse"), iT = idx(c, "Tier");
  return rows.slice(1).filter(r => r[iP]).map(r => ({ casa: r[iC] || "", perfume: r[iP], nomeDiario: r[iN] || "", posse: r[iPo] || "", tier: (r[iT] || "").trim().toUpperCase() }));
}

/** Linhas da aba Diário → [{data, slot, perfume, ocasiao, temp, td, sprays, notaDia, obs, linha}] (só datas válidas). */
export function lerDiario(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({ data: String(r[0] || "").trim(), slot: String(r[1] || "").trim(), perfume: String(r[2] || "").trim(),
    ocasiao: r[3] || "", temp: r[4] || "", td: r[5] || "", sprays: r[6] || "", notaDia: r[7] || "", obs: r[8] || "", linha: i + 2 }))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data) && x.perfume);
}

/** Aplica a aba Tiers sobre os frascos do JSON. Devolve frascos ajustados e os avisos. */
export function aplicarTiers(frascos, tiers) {
  const avisos = { divergentes: [], sem_posse: [], sem_linha: [] };
  if (!tiers.length) return { frascos, avisos, aplicado: false };
  const porNome = new Map();
  for (const t of tiers) { if (t.nomeDiario) porNome.set(t.nomeDiario, t); }
  for (const t of tiers) { if (!porNome.has(t.perfume)) porNome.set(t.perfume, t); }
  const out = [];
  for (const f of frascos) {
    const t = porNome.get(f.nome);
    if (!t) { avisos.sem_linha.push(f.nome); out.push(f); continue; }
    if (t.posse !== "Frasco Gui") { avisos.sem_posse.push({ nome: f.nome, posse: t.posse }); continue; }
    if (t.tier && t.tier !== f.tier) {
      if (f.camada === "grade") avisos.divergentes.push({ nome: f.nome, json: f.tier, planilha: t.tier });
      out.push({ ...f, tier: t.tier });
    } else out.push(f);
  }
  return { frascos: out, avisos, aplicado: true };
}

/** Histórico para o modelo e para a tela: planilha + fila local ainda não confirmada (sem duplicar). */
export function diarioUnificado(diarioPlanilha, local) {
  const chave = r => `${r.data}|${r.slot}|${r.perfume}`;
  const vistos = new Set(diarioPlanilha.map(chave));
  // enviados que a cópia da planilha ainda não traz continuam valendo; conflito e descartado não entram
  const pend = local.filter(r => r.estado !== "descartado" && r.estado !== "conflito" && !vistos.has(chave(r)))
    .map(r => ({ ...r, pendente: r.estado !== "enviado" }));
  return [...diarioPlanilha, ...pend].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.slot === "N") - (b.slot === "N")));
}

/** Nomes aceitos no registro: "Nome no diário" e "Perfume" da aba Tiers (decants e amostras inclusive). */
export function nomesRegistraveis(tiers, frascos) {
  const s = new Set();
  for (const t of tiers) { if (t.nomeDiario) s.add(t.nomeDiario); }
  for (const f of frascos) s.add(f.nome);
  for (const t of tiers) { if (!t.nomeDiario) s.add(t.perfume); }
  return [...s];
}
