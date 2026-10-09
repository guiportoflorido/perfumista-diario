# -*- coding: utf-8 -*-
"""
golden.py — roda o modelo de referência (spec/modelo_diario_v*.py, sem alterá-lo) sobre cada entrada de
tests/golden/inputs/*.txt e grava a saída estruturada em tests/golden/expected/*.json.

A estrutura espelha rodar() linha a linha, mas devolve números brutos em vez de texto. Como conferência, o
top 10 de cada slot é comparado com a tabela que o próprio rodar() imprime: se divergir, o script falha.

Uso:  python3 tools/golden.py
"""
import glob, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "spec"))
import modelo_diario_v1_6 as M  # noqa: E402

CFG = M.CFG


def estruturado(txt):
    d = M.parse_entrada(txt)
    frascos = M.carregar(); d["_frascos"] = frascos
    if d["manha"]:
        alvo = d["manha"].lower()
        hit = next((f for f in frascos if f["nome"].lower() == alvo), None) or \
            next((f for f in frascos if f["nome"].lower().startswith(alvo)), None)
        if hit: d["_manha"] = hit
        else: d["avisos"].append(f"Manhã: '{d['manha']}' não encontrado na base — regra de resíduo desligada")
    elif len(d["slots"]) == 2:
        d["avisos"].append("Sem 'Manhã:' → slot Noite sem regra de resíduo (diga o que passou de manhã para ativar)")
    passos_all, segs = M.linha_do_tempo(d)
    vento = "vento" in d["extra"]
    m_test = re.search(r"testar\s+([^/|,;]+)", d["extra"])
    alvo_test = m_test.group(1).strip().lower() if m_test else None

    out = {"data": d["data"].isoformat(), "avisos": list(d["avisos"]),
           "segs": [{k: s[k] for k in ("ini", "fim", "ocas", "amb", "fechado")} for s in segs],
           "faixas_rua": sorted({p["faixa"] for p in passos_all if p["amb"] != "ac"}),
           "n_passos": len(passos_all), "T_passos": [round(p["T"], 9) for p in passos_all], "slots": []}
    if d.get("_manha"):
        m = d["_manha"]; noite = d["slots"][-1]["ini"]
        out["manha"] = {"nome": m["nome"], "pres": M.presenca(noite - d["aplico"], m["longev"], m["curva"])}
    for slot in d["slots"]:
        passos = [p for p in passos_all if slot["ini"] - 1e-9 <= p["h"] < slot["fim"] - 1e-9]
        ocas_slot = {p["ocas"] for p in passos}
        res = [x for x in (M.avaliar(f, passos, d, slot) for f in frascos) if x]
        grade = sorted([r for r in res if not r["f"]["custo"] and not r["fora"]], key=lambda r: -r["score"])
        custo = sorted([r for r in res if r["f"]["custo"] and not r["fora"]], key=lambda r: -r["score"])
        fora = [r for r in res if r["fora"] and not r["f"]["custo"] and r["f"]["tier"] in ("S", "A")]
        fim_slot = slot["fim"]

        def item(r):
            s, nota = M.sprays(r, d, vento)
            va = M.vivo_ate(r, slot)
            return {"nome": r["f"]["nome"], "tier": r["f"]["tier"], "score": r["score"], "sprays": s, "nota": nota,
                    "vivo_ate": va, "vivo_fim": va >= fim_slot, "porque": M.porque(r, d, ocas_slot)}
        so = {"nome": slot["nome"], "ini": slot["ini"], "fim": slot["fim"],
              "onde": M.onde_aplicar(d, passos, slot),
              "top": [item(r) for r in grade[:CFG["top_n"]]],
              "scores": {r["f"]["nome"]: (None if r["fora"] else r["score"]) for r in res},
              "fora": {r["f"]["nome"]: r["fora"] for r in res if r["fora"]},
              "fora_sa": [{"nome": r["f"]["nome"], "tier": r["f"]["tier"], "motivo": r["fora"]}
                          for r in sorted(fora, key=lambda r: ({'S': 0, 'A': 1}[r['f']['tier']], r['f']['nome']))[:8]]}
        if "corrida" in d["extra"] or "academia" in d["extra"]:
            so["custo"] = [item(r) for r in custo[:CFG["custo_n"]]]
        if alvo_test:
            hit = next((r for r in res if r["f"]["nome"].lower().startswith(alvo_test)), None)
            if hit and not hit["fora"]:
                so["testar"] = {**item(hit), "pos": grade.index(hit) + 1 if hit in grade else None}
            elif hit:
                so["testar"] = {"nome": hit["f"]["nome"], "fora": hit["fora"]}
            else:
                so["testar"] = {"nao_encontrado": m_test.group(1).strip()}
        out["slots"].append(so)
    return out


def conferir(txt, est):
    """O top 10 do estruturado tem de ser exatamente o que rodar() imprime."""
    texto = M.rodar(txt)
    for so in est["slots"]:
        bloco = texto.split(f"## Slot {so['nome']} ")[1].split("## Slot")[0]
        nomes = re.findall(r"^\| \d+ \| \*\*(.+?)\*\* \|", bloco, flags=re.M)
        assert nomes == [t["nome"] for t in so["top"]], (so["nome"], nomes)
        scores = [int(x) for x in re.findall(r"^\| \d+ \|.*?\| (\d+) \| [^|]*\|$", bloco, flags=re.M)]
        assert scores == [int(f"{t['score']:.0f}") for t in so["top"]], (scores,)
    return texto


def main():
    entradas = sorted(glob.glob(os.path.join(RAIZ, "tests/golden/inputs/*.txt")))
    assert entradas, "sem entradas em tests/golden/inputs"
    os.makedirs(os.path.join(RAIZ, "tests/golden/expected"), exist_ok=True)
    for p in entradas:
        txt = open(p, encoding="utf-8").read()
        est = estruturado(txt)
        texto = conferir(txt, est)
        base = os.path.splitext(os.path.basename(p))[0]
        with open(os.path.join(RAIZ, "tests/golden/expected", base + ".json"), "w", encoding="utf-8") as fh:
            json.dump(est, fh, ensure_ascii=False, indent=1)
        with open(os.path.join(RAIZ, "tests/golden/expected", base + ".md"), "w", encoding="utf-8") as fh:
            fh.write(texto + "\n")
        print(f"{base}: " + " · ".join(f"{s['nome']} #1 {s['top'][0]['nome'] if s['top'] else '—'}" for s in est["slots"]))
    print(f"OK — {len(entradas)} casos")


if __name__ == "__main__":
    main()
