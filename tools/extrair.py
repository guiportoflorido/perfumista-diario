# -*- coding: utf-8 -*-
"""
extrair.py — gera data/frascos.json, data/fichas.json e data/playbook.json a partir dos arquivos de spec/.

Nada é digitado à mão: frascos vêm de frascos_v7.carregar(); fichas e playbook são lidos das tabelas/células
dos .md. O script falha (assert) se alguma contagem não bater com o que o projeto declara.

Uso:  python3 tools/extrair.py            (lê spec/, escreve data/)
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(RAIZ, "spec")
DATA = os.path.join(RAIZ, "data")
sys.path.insert(0, SPEC)

import frascos_v7 as FV  # noqa: E402

# Janelas declaradas por ele vs estimadas pelo Claude (00_LEIA_PRIMEIRO §4)
JANELAS_ESTIMADAS = {"Favonius", "Omnia Omnibus Ubique", "Scarlet Sands"}

OCAS_PLAYBOOK = {"Lazer": "Lazer", "Trab. Informal": "T.Inf", "Trab. Formal": "T.For", "Noite Informal": "N.Inf",
                 "Noite Formal": "N.For", "Cozy Dia": "Cozy D", "Cozy Noite": "Cozy N"}


def achar(prefixo):
    """Maior versão de um arquivo em spec/ pelo prefixo (ex.: 'playbook_v')."""
    cands = [f for f in os.listdir(SPEC) if f.startswith(prefixo)]
    assert cands, f"nenhum arquivo {prefixo}* em spec/"
    def ver(f):
        return [int(x) for x in re.findall(r"\d+", f.split(prefixo, 1)[1].split("_20")[0].split(".")[0])]
    return os.path.join(SPEC, max(cands, key=ver))


# ───────────────────────── frascos ─────────────────────────
def extrair_frascos():
    fr = FV.carregar()
    out = []
    for f in fr:
        out.append({
            "nome": f["nome"], "casa": f["casa"], "camada": "custo" if f["custo"] else "grade",
            "tier": f["tier"], "arquetipo": f["arq"], "eixo": f["eixo"], "doc": f["doc"], "peso": f["peso"],
            "td": f["td"], "env_hot": f["env_hot"], "env_cold": f["env_cold"], "env_lo": f["env_lo"],
            "env_hi": f["env_hi"], "ideal": f["ideal"], "conc": f["conc"], "edt": f["edt"], "apt": f["apt"],
            "sprays_base": f["sprays_base"], "janelas": f["janelas"], "chuva": f["chuva"],
            "sem_piramide": f["sem_piramide"], "longev": f["longev"], "proj": f["proj"], "curva": f["curva"],
            "perf_estimada": f["perf_origem"] == "regra", "perf_origem": f["perf_origem"],
            "janelas_estimadas": f["nome"] in JANELAS_ESTIMADAS,
        })
    grade = [f for f in out if f["camada"] == "grade" and f["tier"] != "D"]
    assert len(out) == 79 and len(grade) == 69, (len(out), len(grade))
    assert sum(f["janelas"] or 0 for f in out) == 651
    return out


# ───────────────────────── fichas ─────────────────────────
COLS_FICHA = ["n", "nome", "casa", "conc", "arquetipo", "tier", "perfil", "eixo", "doc", "peso", "td", "envelope",
              "aptidao", "sprays_base", "janelas", "vizinhos", "leitura"]


def extrair_fichas(frascos):
    path = achar("fichas_tecnicas_v")
    txt = open(path, encoding="utf-8").read()
    fichas = {}
    for linha in txt.split("\n"):
        if not re.match(r"^\| \d+ \| \*\*", linha):
            continue
        cel = [c.strip() for c in linha.strip().strip("|").split(" | ")]
        assert len(cel) == len(COLS_FICHA), (len(cel), linha[:80])
        d = dict(zip(COLS_FICHA, cel))
        d["nome"] = d["nome"].strip("*")
        d["n"] = int(d["n"])
        fichas[d["nome"]] = d
    nomes = {f["nome"] for f in frascos}
    assert set(fichas) == nomes, (set(fichas) ^ nomes)
    # conferência cruzada com frascos_v7 (tier, arquétipo, Td, peso, doçura, sprays, janelas)
    for f in frascos:
        x = fichas[f["nome"]]
        assert x["tier"] == f["tier"] and x["arquetipo"] == f["arquetipo"] and x["td"] == f["td"], f["nome"]
        assert int(x["peso"]) == f["peso"] and int(x["doc"]) == f["doc"], f["nome"]
        assert int(x["sprays_base"]) == f["sprays_base"], f["nome"]
        assert (x["janelas"] == "—" and f["janelas"] is None) or int(x["janelas"]) == (f["janelas"] or 0), f["nome"]
    return {"fonte": os.path.basename(path), "fichas": fichas}


# ───────────────────────── playbook ─────────────────────────
def extrair_playbook(frascos):
    path = achar("playbook_v")
    txt = open(path, encoding="utf-8").read()
    ini = txt.index("## 🔴 Muito Quente")
    fim = txt.index("## Custo por uso")
    blocos = re.split(r"^## ", txt[ini:fim], flags=re.M)[1:]
    nomes = sorted((f["nome"] for f in frascos), key=len, reverse=True)
    grade = {}
    total = 0
    for i, bloco in enumerate(blocos):
        cab, *resto = bloco.split("\n")
        faixa = FV.FAIXAS[i]
        assert faixa in cab, (faixa, cab)
        nota = next((l.strip("*_ ") for l in resto if l.startswith("*") and not l.startswith("**")), "")
        celulas = {}
        for oc_txt, corpo in re.findall(r"^\*\*(" + "|".join(map(re.escape, OCAS_PLAYBOOK)) + r")\*\* — (.*)$",
                                        "\n".join(resto), flags=re.M):
            seg = re.search(r"\*\*Seguro: (.+?)\*\* \(([^)]*)\)\. (.*?) — tier ([SABCD])\.", corpo)
            jog = re.search(r"\*\*A jogada: (.+?)\*\* — (.*) \(tier ([SABCD])\)\.", corpo)
            tam = re.search(r"\*\*Também:\*\* (.+?)\.?$", corpo)
            c = {
                "seguro": seg.group(1) if seg else None, "sprays": seg.group(2) if seg else None,
                "seguro_perfil": seg.group(3) if seg else None, "seguro_tier": seg.group(4) if seg else None,
                "jogada": jog.group(1) if jog else None, "jogada_txt": jog.group(2) if jog else None,
                "jogada_tier": jog.group(3) if jog else None,
                "tambem": [t.strip() for t in tam.group(1).split(", ")] if tam else [],
                "texto": corpo,
            }
            for n in [c["seguro"], c["jogada"], *c["tambem"]]:
                if n:
                    assert n in nomes, (faixa, oc_txt, n)
            total += (1 if c["seguro"] else 0) + (1 if c["jogada"] else 0) + len(c["tambem"])
            celulas[OCAS_PLAYBOOK[oc_txt]] = c
        grade[faixa] = {"nota": nota, "celulas": celulas}
    assert total == 651, total
    n_cel = sum(len(g["celulas"]) for g in grade.values())
    assert n_cel == 38, n_cel  # 42 nominais − Cozy D/N em Muito Quente e Quente (Cozy só de Ameno para baixo)
    # contagem de janelas por frasco = coluna Janelas das fichas
    cont = {}
    for g in grade.values():
        for c in g["celulas"].values():
            for n in [c["seguro"], c["jogada"], *c["tambem"]]:
                if n:
                    cont[n] = cont.get(n, 0) + 1
    for f in frascos:
        if f["camada"] == "grade":
            assert cont.get(f["nome"], 0) == (f["janelas"] or 0), (f["nome"], cont.get(f["nome"]), f["janelas"])
    secoes = {}
    for titulo in ("Custo por uso com dois slots", "Notas de uso"):
        a = txt.index("## " + titulo)
        b = txt.find("\n## ", a + 3)
        secoes[titulo] = txt[a:b if b > 0 else None].split("\n", 1)[1].strip()
    return {"fonte": os.path.basename(path), "faixas": FV.FAIXAS, "grade": grade, "secoes": secoes,
            "total_alocacoes": total, "celulas": n_cel}


# ───────────────────────── arquétipos (cores da roda do observatório) ─────────────────────────
def sem_artigo(n):
    return re.sub(r"^(O|A) ", "", n.strip())


def extrair_arquetipos(frascos):
    path = achar("observatorio_colecao_v")
    txt = open(path, encoding="utf-8").read()
    bloco = txt[txt.index("const ARCH = ["):]
    bloco = bloco[:bloco.index("];")]
    arqs = [{"nome": sem_artigo(n), "rotulo": n, "cor": c} for n, c in re.findall(r'\{n:"([^"]+)",\s*c:"(#[0-9A-Fa-f]{6})"', bloco)]
    assert len(arqs) == 16, len(arqs)
    nomes = {a["nome"] for a in arqs}
    falta = {f["arquetipo"] for f in frascos} - nomes
    assert not falta, falta
    # gaps abertos: tabela da seção 6 do 00_LEIA_PRIMEIRO.md
    leia = open(os.path.join(SPEC, "00_LEIA_PRIMEIRO.md"), encoding="utf-8").read()
    sec = leia[leia.index("## 6. Gaps"):]
    sec = sec[:sec.index("\n## ", 5)]
    gaps = []
    for n, nome, arq, status in re.findall(r"^\| (\d) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$", sec, flags=re.M):
        if "fechado" in status.lower() or arq.strip() in ("—", ""):
            continue
        gaps.append({"n": int(n), "gap": nome.strip(), "arquetipo": arq.strip(), "status": status.replace("*", "").strip()})
    assert gaps and all(g["arquetipo"] in nomes for g in gaps), gaps
    return {"fonte": os.path.basename(path), "arquetipos": arqs, "gaps": gaps}


# ───────────────────────── mercado (avaliação v51) ─────────────────────────
# Só campos descritivos. Ficam de fora, por regra do projeto: veredicto histórico (PASSAR/MONITORAR/…),
# coluna Observação (histórico com "PASSAR por default") e a escala "Agrega".
def extrair_mercado():
    path = achar("avaliacao_perfumes_v")
    txt = open(path, encoding="utf-8").read()
    i = txt.index("const D = /*<<D>>*/") + len("const D = /*<<D>>*/")
    D, _ = json.JSONDecoder().raw_decode(txt[i:])
    assert len(D) > 1000 and len(D[0]) == 22, (len(D), len(D[0]))
    vazio = lambda v: "" if v in (None, "—") else str(v).strip()
    out = []
    for r in D:
        out.append({"casa": r[0], "nome": r[1], "tier": r[2] or "", "masc": r[4], "calor": r[5], "ameno": r[6], "frio": r[7],
                    "resumo": vazio(r[11]), "topo": vazio(r[12]), "coracao": vazio(r[13]), "base": vazio(r[14]),
                    "nariz": vazio(r[16]), "wish": r[17] == "✓", "arquetipo": sem_artigo(r[18]) if r[18] else "",
                    "gap": vazio(r[19]), "posse": r[21] or ""})
    return {"fonte": os.path.basename(path), "perfumes": out}


def main():
    os.makedirs(DATA, exist_ok=True)
    frascos = extrair_frascos()
    fichas = extrair_fichas(frascos)
    playbook = extrair_playbook(frascos)
    versao = {"frascos": "frascos_v7.py", "fichas": fichas["fonte"], "playbook": playbook["fonte"],
              "modelo": os.path.basename(achar("modelo_diario_v"))}
    arquetipos = extrair_arquetipos(frascos)
    mercado = extrair_mercado()
    versao["mercado"] = mercado["fonte"]
    for nome, obj in (("frascos.json", {"versao": versao, "frascos": frascos}), ("fichas.json", fichas),
                      ("playbook.json", playbook), ("arquetipos.json", arquetipos), ("mercado.json", mercado)):
        with open(os.path.join(DATA, nome), "w", encoding="utf-8") as fh:
            if nome == "mercado.json":
                json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))   # 1.205 linhas: compacto
            else:
                json.dump(obj, fh, ensure_ascii=False, indent=1)
    g = [f for f in frascos if f["camada"] == "grade" and f["tier"] != "D"]
    print(f"OK — {len(frascos)} frascos · grade {len(g)} · janelas {playbook['total_alocacoes']} · "
          f"células {playbook['celulas']} (42 nominais) · fichas {len(fichas['fichas'])} · arquétipos 16 · "
          f"mercado {len(mercado['perfumes'])} · {versao}")


if __name__ == "__main__":
    main()
