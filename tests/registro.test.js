// Exportar diário para o Claude: cabeçalho fixo, ordem cronológica, vírgula decimal, sem duplicatas, recorte de período.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportarDiario, CAB_EXPORTAR } from "../app/registro.js";

const hist = [
  { data: "2026-10-09", slot: "N", perfume: "Odéon", ocasiao: "Cozy N", temp: "18.5", td: 12, sprays: "3", notaDia: "4", obs: "", sugerido: "3", vivo: "fraco" },
  { data: "2026-10-09", slot: "M", perfume: "Météore", ocasiao: "T.Inf", temp: 27, td: "", sprays: 4, notaDia: "", obs: "chuva | vento\nfim", sugerido: "", vivo: "" },
  { data: "2026-10-01", slot: "M2", perfume: "Sky", ocasiao: "", temp: "", td: "", sprays: "", notaDia: "", obs: "", sugerido: "" },
  { data: "2026-10-09", slot: "M", perfume: "Météore", ocasiao: "T.Inf", temp: 27, sprays: 4, pendente: true },   // cópia local já na planilha
  { data: "2026-10-05", slot: "N", perfume: "Liwa", estado: "descartado" },
];

test("cabeçalho, ordem cronológica, vírgula decimal, vazio fica vazio, sem duplicatas", () => {
  const l = exportarDiario(hist).split("\n");
  assert.equal(l[0], "Data | Slot | Perfume | Ocasião | Temp | Td | Sprays | NotaDia | Obs | Sugerido | Vivo");
  assert.equal(l[0], CAB_EXPORTAR);
  assert.equal(l.length, 4);
  assert.equal(l[1], "2026-10-01 | M2 | Sky |  |  |  |  |  |  |  | ");
  assert.equal(l[2], "2026-10-09 | M | Météore | T.Inf | 27 |  | 4 |  | chuva / vento fim |  | ");
  assert.equal(l[3], "2026-10-09 | N | Odéon | Cozy N | 18,5 | 12 | 3 | 4 |  | 3 | fraco");
  for (const x of l) assert.equal(x.split(" | ").length, 11);
});

test("filtro de período (inclusivo)", () => {
  assert.equal(exportarDiario(hist, { desde: "2026-10-02" }).split("\n").length, 3);
  assert.equal(exportarDiario(hist, { desde: "2026-10-01", ate: "2026-10-01" }).split("\n").length, 2);
  assert.equal(exportarDiario(hist, { desde: "2026-11-01" }), CAB_EXPORTAR);
});
