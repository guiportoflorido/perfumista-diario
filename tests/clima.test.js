// Regras de clima: METAR vale por 3 h e com ±3 °C da previsão; senão Td previsto; override vence; faixas por slot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivarClima } from "../app/clima.js";

const data = "2026-10-09";
const horas = [];
for (const [d, base] of [[data, 0], ["2026-10-10", 24]])
  for (let h = 0; h < 24; h++) {
    const T = 18 + 12 * Math.max(0, Math.sin(Math.PI * (h - 6) / 14)); // ~18 → 30 às 13h
    horas.push({ t: `${d}T${String(h).padStart(2, "0")}:00`, data: d, h, T, Td: 15, prec: h === 16 ? 1.2 : 0, prob: h === 16 ? 70 : 10 });
  }
const prev = { obtido: "x", lat: 0, lon: 0, horas };
const base = { prev, data, aplico: "7:15", noite: "19:30", tiro: "23", agora: new Date("2026-10-09T13:30:00Z") }; // 10h30 em SP
const obs = iso => ({ T: 25.4, Td: 9, obs: iso, raw: "" }); // T previsto às 10h ≈ 25,4

test("faixas: Dia pela máxima das horas restantes, Noite pela média 20–22h", () => {
  const q = derivarClima({ ...base, metar: null });
  assert.equal(q.faixaDia.idx, 1);                 // 30 °C → Quente
  assert.ok(q.faixaNoite.T < 27 && q.faixaNoite.T >= 17);
  assert.equal(q.chuva.v, 1);                      // uma hora molhada → pancadas
});

test("METAR fresco e coerente → Td observado", () => {
  const q = derivarClima({ ...base, metar: obs("2026-10-09T13:00:00Z") });
  assert.equal(q.Td.tipo, "observado"); assert.equal(q.Td.v, 9); assert.equal(q.Td.banda, "seco");
});

test("METAR com mais de 3 h → descartado, Td previsto", () => {
  const q = derivarClima({ ...base, metar: obs("2026-10-09T09:00:00Z") });
  assert.equal(q.Td.tipo, "previsto"); assert.equal(q.Td.v, 15);
  assert.ok(q.avisos.some(a => a.includes("descartado")));
});

test("METAR divergente da previsão em mais de 3 °C → descartado", () => {
  const q = derivarClima({ ...base, metar: { ...obs("2026-10-09T13:00:00Z"), T: 31 } });
  assert.equal(q.Td.tipo, "previsto");
});

test("override vence previsão e METAR; 'nd' desliga o Td", () => {
  const q = derivarClima({ ...base, metar: obs("2026-10-09T13:00:00Z"), override: { Td: "nd", Tmax: "33", chuva: "2" } });
  assert.equal(q.Td.v, null); assert.equal(q.Td.banda, "nd");
  assert.equal(q.Tmax.v, 33); assert.equal(q.Tmax.fonte, "manual"); assert.equal(q.faixaDia.idx, 0);
  assert.equal(q.chuva.v, 2);
});

test("sem previsão e sem override → aviso, nada inventado", () => {
  const q = derivarClima({ ...base, prev: null, metar: null });
  assert.equal(q.Tmin, undefined); assert.equal(q.Td.v, null);
  assert.ok(q.avisos.length > 0);
});
