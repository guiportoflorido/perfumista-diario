# -*- coding: utf-8 -*-
"""
modelo_diario_v1_6.py — Top 10 do dia em DOIS SLOTS (v1.6, 05/out/2026 — base frascos_v7)

v1.6 vs v1.5: (1) a camada custo só aparece quando a entrada traz "Extra: corrida" ou "Extra: academia" — regra
dele (25/set/2026): camada custo é usada só em academia e corrida e fica fora de qualquer análise; (2) cabeçalho e
textos de versão corrigidos. Pesos, filtros e ranking da grade idênticos à v1.5.
Rotina (19/set/2026): 2x/dia, sempre — manhã 7h00–7h30 e noite após o banho ~19h–20h. O perfume do slot Dia não
precisa durar até a noite (25/set/2026): a "presença" estimada serve só aos filtros de clima/ocasião e ao resíduo.

Uso:
    python3 modelo_diario_v1_6.py entrada.txt      # ou: cat entrada.txt | python3 modelo_diario_v1_6.py -
    python3 modelo_diario_v1_6.py --exemplo        # roda o dia de exemplo embutido

Entrada (texto, uma chave por linha; ordem livre; só T e Td são obrigatórias):
    Data: 2026-09-21                      (default: hoje)
    T: 17-28 pico 15 noite 21             (mín→máx do dia; pico e noite opcionais)
    Td: 16                                (°C; "nd" = indisponível → sem modificador na rua)
    Chuva: seco | pancadas | continua     (default: seco)
    Aplico: 7:15                          (aplicação da manhã; default 7:15)
    Noite: 19:30                          (aplicação da noite, pós-banho; default 19:30; "Noite: nao" = só um slot)
    Tiro: 23                              (fim do dia; default 23)
    Manhã: Hacivat                        (opcional — o que já passou de manhã; ativa a regra de resíduo no slot Noite)
    Dia: 8-18 ti ac fechado; 18-19:30 rua; 19:30-23 cn casa
         segmentos "início-fim ocasião [ambiente] [flags]" separados por ";"
         ocasião: lazer | ti | tf | ni | nf | cd | cn   (T.Inf, T.For, N.Inf, N.For, Cozy Dia, Cozy Noite)
         ambiente: rua | ac | casa       (default: ti/tf → ac · cd/cn → casa · resto → rua)
         flags: fechado (reunião longa, avião, carro, elevador o dia todo)
         sem "Dia:" → default por dia da semana (declarado no output)
    AC: 23                                (temperatura do regime de ar-condicionado; default 23)
    Roupa: manga longa, paletó            (livre; "manga longa"/"paletó"/"manga curta" são lidos)
    Extra: escuro | fresco | testar Liwa | vento | sol | corrida | academia
    Diario: 2026-09-18 Vibrato (manhã); 2026-09-18 Liwa (noite); 2026-09-17 Hacivat
            (ou linhas no formato do diário "AAAA-MM-DD | Perfume | ...")

Arquitetura (spec v1 + slots):
    para cada slot (Dia = Aplico→Noite · Noite = Noite→Tiro):
      0 filtros duros (escalados ao tamanho do slot) → 1 fit climático contínuo → 2 fit de contexto
      → 3 multiplicador de tier → 4 rotação/adaptação/resíduo → top 10 da grade (+ camada custo só com corrida/academia)

Pesos e parâmetros: bloco CFG abaixo. São julgamento declarado, a calibrar com o diário.
Regras do playbook que este modelo NÃO altera: Td em bandas (≥20 / 12–20 / <12) com a
coluna Td da ficha; nunca estimar Td externo; tier D fora; tier C só em célula-lar; sprays da célula
do playbook continuam valendo quando ele consultar o playbook — aqui sprays vêm da ficha + regra de faixa.
"""
import sys, re, math, datetime as dt
from frascos_v7 import carregar, FAIXAS, FAIXA_LIM, OCASIOES

CFG = {
    "passo_h": 0.5,            # resolução temporal
    "w_clima": 0.55, "w_ctx": 0.45,
    "w_td": 0.12,              # amplitude do modificador de Td (±)
    "w_chuva": 0.04,           # amplitude do índice de chuva (hipótese)
    "w_fechado": 0.30,         # peso da penalidade de espaço fechado
    "doce_calor": 0.08,        # penalidade por ponto de doçura acima de 1, por hora quente na rua
    "tier_mult": {"S": 1.00, "A": 0.88, "B": 0.70, "C": 0.50},
    "rot": [(1, 0.60), (3, 0.80), (7, 0.92), (44, 1.00), (10**6, 1.06)],  # (dias_ate, mult)
    "adaptacao": 0.92,         # 2+ dos últimos 3 registros no mesmo arquétipo
    "intent_boost": 1.12, "intent_pen": 0.95,
    "presenca_viva": 0.45,     # abaixo disso o frasco "já foi" para os filtros
    "corte_quente_h": 2.0,     # horas vivas acima do envelope (rua) → fora
    "corte_frio_h": 5.0,       # horas vivas abaixo do envelope → fora
    "corte_apt0_h": 2.0,       # horas vivas em ocasião com aptidão 0 → fora
    "corte_frac_slot": 0.5,    # cada corte vale no máx. 50% da duração do slot (slot Noite é curto)
    "ac_td_banda": "seco",     # regime declarado do ar-condicionado (parâmetro, não medição)
    "ac_td_fator": 0.5,        # confiança do regime de AC no modificador de Td (metade do dado medido)
    "ac_T": 23.0,
    "casa_inercia": 0.30,      # em casa sem AC: T = T_rua + 0.30 × (21 − T_rua) — inércia térmica declarada
    "aplico_default": 7.25, "noite_default": 19.5, "tiro_default": 23.0,
    "residuo_denso": 0.90,     # slot Noite: manhã ainda viva e ambos peso ≥4 → sobreposição densa
    "casa_menos1": True,       # slot ≥70% em casa: −1 spray (parâmetro declarado)
    "top_n": 10, "custo_n": 3,
}

OCAS_ALIAS = {"lazer": "Lazer", "l": "Lazer", "ti": "T.Inf", "trab.informal": "T.Inf", "trabalho": "T.Inf",
              "tf": "T.For", "trab.formal": "T.For", "ni": "N.Inf", "noite.informal": "N.Inf", "noite": "N.Inf",
              "nf": "N.For", "noite.formal": "N.For", "cd": "Cozy D", "cozy.dia": "Cozy D",
              "cn": "Cozy N", "cozy.noite": "Cozy N"}
ESCUROS = {"Sultão", "Monge", "Lareira", "Curtidor", "Rosal", "Marceneiro"}
DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']


# ───────────────────────── parsing ─────────────────────────
def fmt_h(h):
    h = h - 24 if h >= 24 else h
    m = int(round((h - int(h)) * 60))
    return f"{int(h)}h" if m == 0 else f"{int(h)}h{m:02d}"


def _hora(s):
    s = s.strip().lower().replace("h", ":")
    if ":" in s:
        h, m = s.split(":")
        return int(h) + (int(m) if m else 0) / 60
    return float(s)


def _num(s):
    return float(s.replace(",", "."))


def _nome_diario(s):
    return re.sub(r"\s*\((manh[ãa]|noite|dia|m|n)\)\s*$", "", s.strip(), flags=re.I).strip()


def parse_entrada(txt):
    d = {"data": None, "T": None, "pico": 15.0, "noite_T": None, "Td": None, "Td_nd": False,
         "chuva": 0, "aplico": CFG["aplico_default"], "noite": CFG["noite_default"], "tiro": CFG["tiro_default"],
         "manha": None, "segs": None, "ac_T": CFG["ac_T"], "roupa": "", "extra": "", "diario": [], "avisos": []}
    diario_lines = []
    for raw in txt.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^\d{4}-\d{2}-\d{2}\s*\|", line):  # linha do diário colada
            diario_lines.append(line); continue
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip().lower(), v.strip()
        if k == "data":
            d["data"] = dt.date.fromisoformat(v)
        elif k == "t":
            m = re.search(r"(-?\d+(?:[.,]\d+)?)\s*(?:-|–|→|a|->)\s*(-?\d+(?:[.,]\d+)?)", v)
            if not m:
                raise ValueError("T: use 'mín-máx', ex. 'T: 17-28 pico 15'")
            d["T"] = (_num(m.group(1)), _num(m.group(2)))
            mp = re.search(r"pico\s*(\d+(?:[:h.]\d+)?)", v, re.I)
            if mp: d["pico"] = _hora(mp.group(1))
            mn = re.search(r"noite\s*(-?\d+(?:[.,]\d+)?)", v, re.I)
            if mn: d["noite_T"] = _num(mn.group(1))
        elif k == "td":
            if re.match(r"^(nd|n/d|—|-|indispon)", v.lower()):
                d["Td_nd"] = True
            else:
                d["Td"] = _num(re.search(r"-?\d+(?:[.,]\d+)?", v).group(0))
        elif k == "chuva":
            vl = v.lower()
            d["chuva"] = 2 if ("cont" in vl or "forte" in vl) else 1 if ("panc" in vl or "chuv" in vl) else 0
        elif k == "aplico": d["aplico"] = _hora(v)
        elif k in ("noite", "aplico noite", "banho"):
            d["noite"] = None if re.match(r"^(n[ãa]o|nao|n|sem|0)$", v.lower()) else _hora(v)
        elif k == "tiro": d["tiro"] = _hora(v)
        elif k == "reaplico": d["avisos"].append("'Reaplico' não existe mais — o dia já tem dois slots (Aplico / Noite)")
        elif k in ("manhã", "manha", "usei"): d["manha"] = v.strip() or None
        elif k == "ac": d["ac_T"] = _num(v)
        elif k == "dia": d["segs"] = parse_segmentos(v)
        elif k == "roupa": d["roupa"] = v
        elif k == "extra": d["extra"] = v.lower()
        elif k in ("diario", "diário"):
            for item in re.split(r"[;·]", v):
                item = item.strip()
                m = re.match(r"(\d{4}-\d{2}-\d{2})\s+(.+)", item)
                if m: d["diario"].append((dt.date.fromisoformat(m.group(1)), _nome_diario(m.group(2))))
    for line in diario_lines:
        parts = [p.strip() for p in line.split("|")]
        d["diario"].append((dt.date.fromisoformat(parts[0]), _nome_diario(parts[1])))
    if d["T"] is None:
        raise ValueError("Falta a linha 'T: mín-máx'.")
    if d["Td"] is None and not d["Td_nd"]:
        raise ValueError("Falta a linha 'Td: <°C>' (ou 'Td: nd').")
    if d["data"] is None:
        d["data"] = dt.date.today()
    if d["tiro"] <= d["aplico"]:
        d["tiro"] += 24  # madrugada
    if d["noite"] is not None and not (d["aplico"] < d["noite"] < d["tiro"]):
        raise ValueError("'Noite:' precisa ficar entre 'Aplico:' e 'Tiro:' (ou 'Noite: nao').")
    # slots
    if d["noite"] is None:
        d["slots"] = [{"nome": "Dia", "ini": d["aplico"], "fim": d["tiro"]}]
        d["avisos"].append("Noite: nao → dia de um perfume só (janela inteira no slot Dia)")
    else:
        d["slots"] = [{"nome": "Dia", "ini": d["aplico"], "fim": d["noite"]},
                      {"nome": "Noite", "ini": d["noite"], "fim": d["tiro"]}]
    return d


def parse_segmentos(v):
    segs = []
    for part in re.split(r"[;·]", v):
        part = part.strip()
        if not part: continue
        m = re.match(r"(\d+(?:[:h.]\d+)?)\s*(?:-|–|→|a)\s*(\d+(?:[:h.]\d+)?)\s*(.*)", part)
        if not m:
            raise ValueError(f"Segmento ilegível: '{part}' — use 'início-fim ocasião [ambiente] [fechado]'")
        ini, fim, resto = _hora(m.group(1)), _hora(m.group(2)), m.group(3).lower()
        toks = re.findall(r"[a-zà-ú.]+", resto)
        ocas, amb, fech = None, None, False
        for t in toks:
            if t in OCAS_ALIAS: ocas = OCAS_ALIAS[t]
            elif t in ("rua", "fora", "externo"): amb = "rua"
            elif t in ("ac", "escritorio", "escritório", "office"): amb = "ac"
            elif t in ("casa", "home"): amb = "casa"
            elif t in ("fechado", "reuniao", "reunião", "aviao", "avião", "carro", "elevador"): fech = True
        if fim <= ini: fim += 24
        segs.append({"ini": ini, "fim": fim, "ocas": ocas, "amb": amb, "fechado": fech})
    for i, s in enumerate(segs):
        if s["ocas"] is None:
            ref = next((segs[j]["ocas"] for j in range(i - 1, -1, -1) if segs[j]["ocas"]), None) \
                  or next((segs[j]["ocas"] for j in range(i + 1, len(segs)) if segs[j]["ocas"]), None)
            if ref is None:
                raise ValueError("Nenhum segmento com ocasião (lazer/ti/tf/ni/nf/cd/cn)")
            s["ocas"] = ref
        if s["amb"] is None:
            s["amb"] = "ac" if s["ocas"] in ("T.Inf", "T.For") else "casa" if s["ocas"].startswith("Cozy") else "rua"
    return segs


def segmentos_default(d):
    wd = d["data"].weekday()  # 0 = segunda
    a, t = d["aplico"], d["tiro"]
    n = d["noite"] if d["noite"] is not None else 18.0
    if wd < 5:
        segs = [{"ini": a, "fim": min(18, t), "ocas": "T.Inf", "amb": "ac", "fechado": False}]
        if n > 18: segs.append({"ini": 18, "fim": n, "ocas": "N.Inf", "amb": "rua", "fechado": False})
        if t > n: segs.append({"ini": n, "fim": t, "ocas": "Cozy N", "amb": "casa", "fechado": False})
        d["avisos"].append("Dia: sem agenda informada → assumido dia útil: trabalho informal em AC até 18h, rua até o banho, Cozy Noite em casa depois")
    else:
        segs = [{"ini": a, "fim": min(n, t), "ocas": "Lazer", "amb": "rua", "fechado": False}]
        if t > n: segs.append({"ini": n, "fim": t, "ocas": "Cozy N", "amb": "casa", "fechado": False})
        d["avisos"].append("Dia: sem agenda informada → assumido fim de semana: lazer na rua até o banho, Cozy Noite em casa depois")
    return segs


# ───────────────────────── modelo físico do dia ─────────────────────────
def T_rua(h, Tmin, Tmax, pico, noite):
    """Curva diurna simples: mínima às 6h, máxima no pico, decai até 23h (valor 'noite' ou 35% da amplitude), volta à mínima às 6h."""
    amp = Tmax - Tmin
    h = h % 24 if h < 30 else h
    if h < 6: h += 24
    if h <= pico:
        return Tmin + amp * math.sin(math.pi / 2 * (h - 6) / max(pico - 6, 1))
    T23 = noite if noite is not None else Tmin + 0.35 * amp
    if h <= 23:
        return Tmax + (T23 - Tmax) * (1 - math.cos(math.pi / 2 * (h - pico) / max(23 - pico, 1)))
    return T23 + (Tmin - T23) * (h - 23) / 7  # 23h → 6h


def faixa_idx(T):
    return 0 if T > 32 else 1 if T >= 27 else 2 if T >= 22 else 3 if T >= 17 else 4 if T >= 12 else 5


def banda_td(Td):
    if Td is None: return "nd"
    return "carregado" if Td >= 20 else "seco" if Td < 12 else "neutro"


def presenca(e, L, curva):
    if e < 0: return 0.0
    lv = {"S": (1.0, 0.75, 0.45), "L": (1.0, 0.90, 0.70), "F": (0.80, 0.90, 0.90)}[curva]
    if e < 1: p = lv[0]
    elif e < 3: p = lv[1]
    elif e <= L: p = lv[2]
    else: p = max(0.10, lv[2] * math.exp(-(e - L) / 2.0))
    return p


def linha_do_tempo(d):
    """Lista de passos: hora, T_eff, banda Td, faixa, ocasião, ambiente, fechado."""
    segs = d["segs"] or segmentos_default(d)
    Tmin, Tmax = d["T"]
    banda_rua = "nd" if d["Td_nd"] else banda_td(d["Td"])
    passos, h = [], d["aplico"]
    while h < d["tiro"] - 1e-9:
        seg = next((s for s in segs if s["ini"] - 1e-9 <= h < s["fim"]), None)
        if seg is None:  # transição: rua, ocasião do segmento anterior (ou próximo)
            prev = [s for s in segs if s["fim"] <= h]; nxt = [s for s in segs if s["ini"] > h]
            ref = (prev[-1] if prev else nxt[0] if nxt else segs[0])
            seg = {"ocas": ref["ocas"], "amb": "rua", "fechado": False}
        if seg["amb"] == "ac":
            T, banda = d["ac_T"], CFG["ac_td_banda"]
        else:
            T, banda = T_rua(h, Tmin, Tmax, d["pico"], d["noite_T"]), banda_rua
            if seg["amb"] == "casa":
                T = T + CFG["casa_inercia"] * (21 - T)
        passos.append({"h": h, "T": T, "banda": banda, "faixa": faixa_idx(T), "ocas": seg["ocas"],
                       "amb": seg["amb"], "fechado": seg["fechado"]})
        h += CFG["passo_h"]
    return passos, segs


# ───────────────────────── score por frasco ─────────────────────────
def fit_termico(T, f):
    lo, hi, ideal = f["env_lo"], f["env_hi"], f["ideal"]
    if lo <= T <= hi:
        return 0.8 + 0.2 * math.exp(-((T - ideal) / 8) ** 2), 0.0, 0.0
    if T > hi:
        x = T - hi
        return 0.8 * math.exp(-(x / 3) ** 2), x, 0.0
    x = lo - T
    return 0.8 * math.exp(-(x / 5) ** 2), 0.0, x


def avaliar(f, passos, d, slot):
    dt_h = CFG["passo_h"]
    aplico = slot["ini"]; slot_len = slot["fim"] - slot["ini"]
    W = th = tdm = aptm = fech = 0.0
    h_quente = h_frio = h_apt0 = h_viva = h_ac_viva = h_casa_viva = 0.0
    horas_ocas = {}
    hottest_rua = None; coldest_viva = None; any_fechado = False
    for p in passos:
        e = p["h"] - aplico
        w = presenca(e, f["longev"], f["curva"])
        viva = w >= CFG["presenca_viva"]
        ft, viol_q, viol_f = fit_termico(p["T"], f)
        if p["amb"] != "ac" and p["T"] >= 27 and f["doc"] >= 2:
            ft -= CFG["doce_calor"] * (f["doc"] - 1)
        if p["banda"] == "carregado": c = 1 if f["td"] == "C" else -1 if f["td"] == "S" else 0
        elif p["banda"] == "seco": c = 1 if f["td"] == "S" else -1 if f["td"] == "C" else 0
        else: c = 0
        if p["amb"] == "ac": c *= CFG["ac_td_fator"]
        apt = f["apt"].get(p["ocas"], 0)
        pen_f = max(0.0, (f["proj"] + f["peso"] - 6) / 4) if p["fechado"] else 0.0
        W += w; th += w * ft; tdm += w * c; aptm += w * apt / 3; fech += w * min(1.0, pen_f)
        if viva:
            h_viva += dt_h
            horas_ocas[p["ocas"]] = horas_ocas.get(p["ocas"], 0) + dt_h
            if p["amb"] != "ac" and viol_q > 1.0: h_quente += dt_h
            if viol_f > 1.0: h_frio += dt_h
            if apt == 0 and p["amb"] != "casa": h_apt0 += dt_h
            if p["amb"] == "ac": h_ac_viva += dt_h
            if p["amb"] == "casa": h_casa_viva += dt_h
            if p["fechado"]: any_fechado = True
            if p["amb"] != "ac":
                hottest_rua = p["faixa"] if hottest_rua is None else min(hottest_rua, p["faixa"])
            coldest_viva = p["faixa"] if coldest_viva is None else max(coldest_viva, p["faixa"])
    if W == 0:
        return None
    th, tdm, aptm, fech = th / W, tdm / W, aptm / W, fech / W
    r = {"f": f, "slot": slot["nome"], "termico": th, "td_mod": tdm, "apt": aptm, "fech": fech, "h_viva": h_viva,
         "h_quente": h_quente, "h_frio": h_frio, "h_apt0": h_apt0, "h_ac_viva": h_ac_viva, "h_casa_viva": h_casa_viva,
         "hottest_rua": hottest_rua, "coldest_viva": coldest_viva, "any_fechado": any_fechado,
         "ocas_dom": max(horas_ocas, key=horas_ocas.get) if horas_ocas else None, "fora": None}
    # ── filtros duros (cortes escalados ao slot)
    fr = CFG["corte_frac_slot"] * slot_len
    c_q, c_f, c_a = min(CFG["corte_quente_h"], fr), min(CFG["corte_frio_h"], fr), min(CFG["corte_apt0_h"], fr)
    if f["tier"] == "D": r["fora"] = "tier D (fora da grade)"
    elif h_quente >= c_q:
        r["fora"] = f"{h_quente:g}h na rua acima do envelope ({FAIXAS[f['env_hot']]} é o teto)"
    elif h_frio >= c_f:
        r["fora"] = f"{h_frio:g}h abaixo do envelope ({FAIXAS[f['env_cold']]} é o piso)"
    elif h_apt0 >= c_a:
        oc = [o for o in OCASIOES if o in [p["ocas"] for p in passos if p["amb"] != "casa"] and f["apt"].get(o, 0) == 0]
        r["fora"] = f"{h_apt0:g}h vivas fora de casa sem aptidão ({', '.join(oc)})"
    elif f["tier"] == "C" and f["apt"].get(r["ocas_dom"], 0) < 3:
        r["fora"] = f"tier C fora da célula-lar ({r['ocas_dom']} não é aptidão 3)"
    elif slot["nome"] == "Noite" and d.get("_manha") and d["_manha"]["nome"] == f["nome"]:
        r["fora"] = "já usado hoje de manhã (o slot Noite é o segundo perfume do dia)"
    # ── score
    chuva_eff = 0.0
    if d["chuva"] == 2: chuva_eff = max(-1.5, min(1.5, f["chuva"]))
    elif d["chuva"] == 0: chuva_eff = -max(-1.5, min(1.5, f["chuva"])) * 0.5
    clima = max(0.0, min(1.0, th + CFG["w_td"] * tdm + CFG["w_chuva"] * chuva_eff))
    ctx = max(0.0, min(1.0, aptm - CFG["w_fechado"] * fech))
    base = CFG["w_clima"] * clima + CFG["w_ctx"] * ctx
    tm = CFG["tier_mult"].get(f["tier"], 0.0)
    # rotação
    rot, dias, adapt = 1.0, None, False
    if d["diario"]:
        cobre45 = (d["data"] - min(dd for dd, _ in d["diario"])).days >= 45
        usos = [dd for dd, nome in d["diario"] if nome.strip().lower() == f["nome"].lower()]
        if usos:
            dias = (d["data"] - max(usos)).days
            for lim, mult in CFG["rot"]:
                if dias <= lim: rot = mult; break
        elif cobre45:
            rot = CFG["rot"][-1][1]
            dias = "45+"
        ult3 = sorted(d["diario"], key=lambda x: x[0], reverse=True)[:3]
        por_nome = {x["nome"].lower(): x["arq"] for x in d["_frascos"]}
        mesmos = sum(1 for _, n in ult3 if por_nome.get(n.strip().lower()) == f["arq"])
        if mesmos >= 2: rot *= CFG["adaptacao"]; adapt = True
    # resíduo da manhã (só no slot Noite, só se ele disse o que usou)
    residuo = 1.0; res_txt = None
    if slot["nome"] == "Noite" and d.get("_manha"):
        m = d["_manha"]
        pres = presenca(slot["ini"] - d["aplico"], m["longev"], m["curva"])
        if pres >= CFG["presenca_viva"]:
            if m["peso"] >= 4 and f["peso"] >= 4:
                residuo = CFG["residuo_denso"]; res_txt = f"sobre resíduo denso de {m['nome']} ↓"
            elif m["arq"] == f["arq"]:
                res_txt = f"mesmo arquétipo do {m['nome']} da manhã (contínuo)"
    # intenção
    intent = 1.0
    ex = d["extra"]
    if "escuro" in ex:
        intent = CFG["intent_boost"] if (f["peso"] >= 4 or f["arq"] in ESCUROS) else CFG["intent_pen"]
    if "fresco" in ex:
        intent = CFG["intent_boost"] if (f["peso"] <= 2 or f["td"] == "C") else CFG["intent_pen"]
    r.update({"clima": clima, "ctx": ctx, "base": base, "tier_mult": tm, "rot": rot, "dias": dias,
              "adapt": adapt, "intent": intent, "chuva_eff": chuva_eff, "residuo": residuo, "res_txt": res_txt,
              "score": 100 * tm * base * rot * intent * residuo})
    return r


def sprays(r, d, vento):
    f = r["f"]; nome = f["nome"]
    if nome == "Désobéissant": return 6, "6–7 fixo"
    fx = r["hottest_rua"] if r["hottest_rua"] is not None else r["coldest_viva"]
    ac_dom = r["h_viva"] > 0 and r["h_ac_viva"] / r["h_viva"] >= 0.5
    casa_dom = r["h_viva"] > 0 and r["h_casa_viva"] / r["h_viva"] >= 0.7
    s0 = s = f["sprays_base"]; nota = []
    beast = f["peso"] >= 5 or f["proj"] >= 5
    if fx == 0 and s > 3: s = 3; nota.append("MQ máx 3")
    elif fx == 1 and s > 4: s = 4; nota.append("Q máx 4")
    elif fx in (4, 5) and not ac_dom and not casa_dom and not beast: s += 1; nota.append("frio +1")
    cap = 5 if f["edt"] else 4
    if nome in ("Tygar Extrait", "Vibrato"): cap = 3
    if nome in ("Ombre Nomade", "Outlands") and fx == 3:
        s = 2; nota = ["Fresco: 2, sem exceção"]
    if nome == "Vibrato" and (r["any_fechado"] or ac_dom): s = 2; nota = ["escritório fechado: 2"]
    if r["any_fechado"] and f["proj"] >= 4 and nome != "Vibrato": s = max(1, s - 1); nota.append("fechado −1")
    if casa_dom and CFG["casa_menos1"] and s > 1 and nome not in ("Ombre Nomade", "Outlands"):
        s -= 1; nota.append("em casa −1")
    if vento and not ac_dom and not casa_dom and nome not in ("Ombre Nomade", "Outlands", "Vibrato", "Tygar Extrait"):
        s += 1; nota.append("vento +1")
    s = max(1, min(s, cap))
    if s == s0: nota = []
    return s, ", ".join(nota)


def vivo_ate(r, slot):
    e = 0.0
    while e < 30 and presenca(e, r["f"]["longev"], r["f"]["curva"]) >= CFG["presenca_viva"]:
        e += 0.25
    return slot["ini"] + e


def porque(r, d, ocas_slot):
    f = r["f"]; t = []
    t.append(f"térmico {r['termico']:.2f}")
    if r["td_mod"] > 0.15: t.append("Td ↑")
    elif r["td_mod"] < -0.15: t.append("Td ↓")
    if abs(r["chuva_eff"]) >= 0.6: t.append("chuva " + ("↑" if r["chuva_eff"] > 0 else "↓"))
    aps = [f"{o} {f['apt'][o]}" for o in OCASIOES if o in f["apt"] and o in ocas_slot]
    if aps: t.append("/".join(aps))
    if r["fech"] > 0.05: t.append("fechado ↓")
    if r["dias"] == "45+": t.append("sem uso em 45+d 🕸️")
    elif r["dias"] is not None:
        t.append(f"usado há {r['dias']}d" + (" 🕸️" if r["dias"] >= 45 else ""))
    if r["adapt"]: t.append("mesmo arquétipo 3 registros ↓")
    if r["res_txt"]: t.append(r["res_txt"])
    if r["intent"] != 1.0: t.append("intenção " + ("↑" if r["intent"] > 1 else "↓"))
    return " · ".join(t)


def onde_aplicar(d, passos, slot):
    ex, roupa = d["extra"], d["roupa"].lower()
    rua_q = sum(CFG["passo_h"] for p in passos if p["amb"] != "ac" and p["T"] >= 27)
    ac_h = sum(CFG["passo_h"] for p in passos if p["amb"] == "ac")
    casa_h = sum(CFG["passo_h"] for p in passos if p["amb"] == "casa")
    tot = max(slot["fim"] - slot["ini"], 0.5)
    linhas = []
    if slot["nome"] == "Noite":
        linhas.append("pós-banho: pele limpa e ainda morna absorve mais — pescoço/peito, sem esfregar; esperar a pele secar antes de vestir")
        if casa_h / tot >= 0.7:
            linhas.append("noite em casa: o perfume é para você e para quem está perto — projeção pesa menos que o drydown")
        return " · ".join(linhas)
    if "sol" in ex or "corrida" in ex or rua_q >= 2:
        linhas.append("calor/sol na rua: 1–2 sprays na camisa (tecido segura sem suar), o resto pescoço e peito; pulsos fora do sol")
    elif "manga longa" in roupa or "paletó" in roupa or "paleto" in roupa:
        linhas.append("manga longa: pescoço + pulsos por dentro da manga — o tecido prolonga o rastro")
    else:
        linhas.append("pescoço/peito e pulsos")
    if ac_h / tot >= 0.5:
        linhas.append("dia majoritariamente em AC: você percebe menos o próprio perfume (mucosa seca) — não compensar com spray")
    return " · ".join(linhas)


# ───────────────────────── execução ─────────────────────────
def rodar(txt):
    d = parse_entrada(txt)
    frascos = carregar(); d["_frascos"] = frascos
    if d["manha"]:
        alvo = d["manha"].lower()
        hit = next((f for f in frascos if f["nome"].lower() == alvo), None) or \
              next((f for f in frascos if f["nome"].lower().startswith(alvo)), None)
        if hit: d["_manha"] = hit
        else: d["avisos"].append(f"Manhã: '{d['manha']}' não encontrado na base — regra de resíduo desligada")
    elif len(d["slots"]) == 2:
        d["avisos"].append("Sem 'Manhã:' → slot Noite sem regra de resíduo (diga o que passou de manhã para ativar)")
    passos_all, segs = linha_do_tempo(d)
    vento = "vento" in d["extra"]
    m_test = re.search(r"testar\s+([^/|,;]+)", d["extra"])
    alvo_test = m_test.group(1).strip().lower() if m_test else None

    out = []
    Tmin, Tmax = d["T"]
    out.append(f"📅 {d['data'].strftime('%d/%m/%Y')} ({DIAS[d['data'].weekday()]}) · " +
               " · ".join(f"slot {s['nome']} {fmt_h(s['ini'])}→{fmt_h(s['fim'])} ({s['fim']-s['ini']:g}h)" for s in d["slots"]))
    rua = [p for p in passos_all if p["amb"] != "ac"]
    fx_rua = sorted({p["faixa"] for p in rua})
    out.append(f"🌡️ Rua: {Tmin:g}→{Tmax:g}°C (pico {d['pico']:g}h)" + (f" · noite {d['noite_T']:g}°C" if d['noite_T'] is not None else "") +
               (f" · faixas presenciadas na rua: {', '.join(FAIXAS[i] for i in fx_rua)}" if fx_rua else " · nenhuma hora na rua"))
    ac = [p for p in passos_all if p["amb"] == "ac"]
    if ac: out.append(f"❄️ AC: {sum(CFG['passo_h'] for p in ac):g}h a {d['ac_T']:g}°C, ar {CFG['ac_td_banda']} (regime declarado, não medido)")
    casa = [p for p in passos_all if p["amb"] == "casa"]
    if casa: out.append(f"🏠 Casa: {sum(CFG['passo_h'] for p in casa):g}h a {min(p['T'] for p in casa):.0f}–{max(p['T'] for p in casa):.0f}°C (rua com inércia térmica de {CFG['casa_inercia']:.0%})")
    if d["Td_nd"]: out.append("🌫️ Td rua: indisponível → sem modificador nas horas de rua")
    else: out.append(f"🌫️ Td rua: {d['Td']:g}°C — ar {banda_td(d['Td'])}")
    out.append(f"🌧️ Chuva: {['seco','pancadas','contínua'][d['chuva']]}" + (" · 💨 vento" if vento else "") + (" · ☀️ sol direto" if "sol" in d["extra"] else ""))
    out.append("📍 Dia: " + " · ".join(f"{fmt_h(s['ini'])}–{fmt_h(s['fim'])} {s['ocas']} ({s['amb']}{', fechado' if s['fechado'] else ''})" for s in segs))
    if d["roupa"]: out.append(f"👔 Roupa: {d['roupa']}")
    if d.get("_manha"):
        m = d["_manha"]; noite = d["slots"][-1]["ini"]
        pres = presenca(noite - d["aplico"], m["longev"], m["curva"])
        out.append(f"🧴 Manhã: {m['nome']} ({m['tier']}, {m['arq']}) — resíduo às {fmt_h(noite)}: {'ainda vivo' if pres >= CFG['presenca_viva'] else 'praticamente foi'} (presença {pres:.2f}, estimativa)")
    for a in d["avisos"]: out.append(f"⚠️ {a}")

    for slot in d["slots"]:
        passos = [p for p in passos_all if slot["ini"] - 1e-9 <= p["h"] < slot["fim"] - 1e-9]
        ocas_slot = {p["ocas"] for p in passos}
        res = [x for x in (avaliar(f, passos, d, slot) for f in frascos) if x]
        grade = sorted([r for r in res if not r["f"]["custo"] and not r["fora"]], key=lambda r: -r["score"])
        custo = sorted([r for r in res if r["f"]["custo"] and not r["fora"]], key=lambda r: -r["score"])
        fora = [r for r in res if r["fora"] and not r["f"]["custo"] and r["f"]["tier"] in ("S", "A")]
        fim_slot = slot["fim"]
        out.append(""); out.append(f"## Slot {slot['nome']} ({fmt_h(slot['ini'])}→{fmt_h(fim_slot)}) — Top {CFG['top_n']} da grade")
        out.append(f"🧴 Onde aplicar: {onde_aplicar(d, passos, slot)}")
        out.append("| # | Perfume | Casa | Tier | Sprays | Vivo até | Score | Por quê |"); out.append("|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(grade[:CFG["top_n"]], 1):
            s, nota = sprays(r, d, vento)
            va = vivo_ate(r, slot)
            va_txt = "fim" if va >= fim_slot else f"~{fmt_h(va)}"
            if slot["nome"] == "Dia" and len(d["slots"]) == 2 and va >= fim_slot + 1: va_txt += " 🔁"
            out.append(f"| {i} | **{r['f']['nome']}** | {r['f']['casa']} | {r['f']['tier']} | {s}{' ('+nota+')' if nota else ''} | {va_txt} | {r['score']:.0f} | {porque(r, d, ocas_slot)} |")
        if slot["nome"] == "Dia" and len(d["slots"]) == 2:
            out.append("🔁 = ainda vivo na hora do banho: entra como resíduo sob o perfume da noite (informe em 'Manhã:' para o slot Noite considerar)")
        if alvo_test:
            hit = next((r for r in res if r["f"]["nome"].lower().startswith(alvo_test)), None)
            if hit and not hit["fora"]:
                pos = grade.index(hit) + 1 if hit in grade else None
                s_, _ = sprays(hit, d, vento); va = vivo_ate(hit, slot)
                out.append(f"★ Testar **{hit['f']['nome']}** ({hit['f']['tier']}) neste slot: passa nos filtros · {s_} sprays · vivo até {'fim' if va >= fim_slot else '~'+fmt_h(va)} · score {hit['score']:.0f}" + (f" (#{pos})" if pos else "") + f" · {porque(hit, d, ocas_slot)}")
            elif hit:
                out.append(f"★ Testar {hit['f']['nome']}: reprovado nos filtros deste slot — {hit['fora']}")
            elif slot is d["slots"][0]:
                out.append(f"★ Testar '{m_test.group(1).strip()}': frasco não encontrado na base")
        if ("corrida" in d["extra"] or "academia" in d["extra"]):
            out.append(f"**Custo do slot** (camada custo — corrida/academia, fora do ranking): " + (" · ".join(f"{r['f']['nome']} ({r['f']['tier']}, {sprays(r, d, vento)[0]} sprays, {r['score']:.0f})" for r in custo[:CFG["custo_n"]]) if custo else "nenhum frasco da camada passa nos filtros"))
        if fora:
            out.append("S/A fora neste slot: " + " · ".join(f"{r['f']['nome']} ({r['f']['tier']}: {r['fora']})" for r in sorted(fora, key=lambda r: ({'S': 0, 'A': 1}[r['f']['tier']], r['f']['nome']))[:8]))

    out.append("")
    out.append(f"_Modelo v1.6 (dois slots · base frascos_v7, grade 69) · pesos declarados no CFG · longevidade/projeção/curva são estimativas ({sum(1 for f in frascos if f['perf_origem']=='leitura')} com lastro na ficha, {sum(1 for f in frascos if f['perf_origem']=='regra')} por regra) · calibrar com o diário._")
    out.append("📓 Depois me diga o que usou de manhã e à noite pra eu registrar as duas linhas.")
    return "\n".join(out)


EXEMPLO = """Data: 2026-09-21
T: 17-28 pico 15 noite 21
Td: 16
Chuva: pancadas
Aplico: 7:15
Noite: 19:30
Tiro: 23
Manhã:
Dia: 8-18 ti ac fechado; 18-19:30 rua; 19:30-23 cn casa
Roupa: camisa manga longa, sem paletó
Extra:
Diario: 2026-09-18 Vibrato (manhã); 2026-09-18 Liwa (noite); 2026-09-17 Hacivat; 2026-09-16 Imagination; 2026-08-01 Désobéissant
"""

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--exemplo":
        print(rodar(EXEMPLO))
    elif len(sys.argv) > 1 and sys.argv[1] != "-":
        print(rodar(open(sys.argv[1], encoding="utf-8").read()))
    else:
        print(rodar(sys.stdin.read()))
