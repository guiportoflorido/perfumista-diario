// entrada.js — monta o texto de entrada do modelo (mesmo formato do modelo_diario_v1_6.py) a partir da tela.
// Usar o texto como contrato garante que o app roda exatamente o que os testes de paridade cobrem.
export const OCAS_DIA = [["auto", "Automático"], ["lazer", "Lazer"], ["ti", "Trab. Informal"], ["tf", "Trab. Formal"], ["cd", "Cozy Dia"]];
export const OCAS_NOITE = [["auto", "Automático"], ["ni", "Noite Informal"], ["nf", "Noite Formal"], ["cn", "Cozy Noite"]];
export const AMBIENTES = [["auto", "Padrão"], ["rua", "Rua"], ["ac", "AC"], ["casa", "Casa"]];
export const EXTRAS = [["escuro", "Escuro"], ["fresco", "Fresco"], ["vento", "Vento"], ["sol", "Sol direto"], ["corrida", "Corrida"], ["academia", "Academia"]];

const n = x => String(Math.round(Number(x) * 10) / 10);

export function montarEntrada({ data, clima, aj, dia, manha, diario }) {
  const L = [`Data: ${data}`];
  if (clima.Tmin && clima.Tmax) {
    let t = `T: ${n(clima.Tmin.v)}-${n(clima.Tmax.v)}`;
    if (clima.pico) t += ` pico ${clima.pico.v}`;
    if (clima.noite23) t += ` noite ${n(clima.noite23.v)}`;
    L.push(t);
  }
  L.push(`Td: ${clima.Td.v == null ? "nd" : n(clima.Td.v)}`);
  L.push(`Chuva: ${["seco", "pancadas", "continua"][clima.chuva.v]}`);
  L.push(`Aplico: ${aj.aplico}`);
  L.push(`Noite: ${dia.soUm ? "nao" : aj.noite}`);
  L.push(`Tiro: ${aj.tiro}`);
  if (manha && !dia.soUm) L.push(`Manhã: ${manha}`);
  const segs = segmentos(aj, dia);
  if (segs) L.push(`Dia: ${segs}`);
  L.push(`AC: ${aj.ac}`);
  if (dia.roupa) L.push(`Roupa: ${dia.roupa}`);
  const ex = [...dia.extras];
  if (dia.testar) ex.push(`testar ${dia.testar}`);
  if (ex.length) L.push(`Extra: ${ex.join(", ")}`);
  for (const r of diario) L.push(`${r.data} | ${r.perfume}`);
  return L.join("\n") + "\n";
}

// "Automático" nos dois slots → sem linha Dia: (o modelo usa o padrão por dia da semana e declara no aviso)
function segmentos(aj, dia) {
  if (dia.ocDia === "auto" && dia.ambDia === "auto" && (dia.soUm || (dia.ocNoite === "auto" && dia.ambNoite === "auto"))) return null;
  const wd = (new Date(dia.data + "T12:00:00").getDay() + 6) % 7;
  const ocD = dia.ocDia !== "auto" ? dia.ocDia : (wd < 5 ? "ti" : "lazer");
  const ocN = dia.ocNoite !== "auto" ? dia.ocNoite : "cn";
  const amb = a => (a === "auto" ? "" : ` ${a}`);
  if (dia.soUm) return `${aj.aplico}-${aj.tiro} ${ocD}${amb(dia.ambDia)}`;
  return `${aj.aplico}-${aj.noite} ${ocD}${amb(dia.ambDia)}; ${aj.noite}-${aj.tiro} ${ocN}${amb(dia.ambNoite)}`;
}
