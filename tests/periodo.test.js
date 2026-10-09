// Períodos do Histórico: atalhos e intervalo livre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodo } from "../app/telas.js";

test("atalhos de período", () => {
  assert.deepEqual(periodo("tudo", "2026-10-09"), { de: null, ate: "2026-10-09" });
  assert.deepEqual(periodo("7", "2026-10-09"), { de: "2026-10-03", ate: "2026-10-09" });
  assert.deepEqual(periodo("30", "2026-10-09"), { de: "2026-09-10", ate: "2026-10-09" });
  assert.deepEqual(periodo("mes", "2026-10-09"), { de: "2026-10-01", ate: "2026-10-09" });
  assert.deepEqual(periodo("mesant", "2026-10-09"), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(periodo("mesant", "2026-01-15"), { de: "2025-12-01", ate: "2025-12-31" });
  assert.deepEqual(periodo("livre", "2026-10-09", "2026-10-05", ""), { de: "2026-10-05", ate: "2026-10-09" });
});
