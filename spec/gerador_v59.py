# -*- coding: utf-8 -*-
"""
gerador_v59.py — regera a cadeia v59 (05/out/2026) a partir dos arquivos v58 do projeto.

Entradas (na pasta corrente): playbook_v58.md · fichas_tecnicas_v8.md · tabelao_v2_6.md/.xlsx · frascos_v6.py ·
modelo_diario_v1_5.py · observatorio_colecao_v4_5.html · mapa_climatico_colecao_v4.html ·
avaliacao_perfumes_v50_2026-09-25.html.   Saídas: pasta out/.
Toda troca de texto é guardada por assert (conta exata de ocorrências); o script falha em vez de gerar algo errado.
Verificações: células do playbook idênticas à v58 (651 alocações); observatório difere da v57 só pelo Vibrato fora
de 6 células de noite; tiers dos 79 frascos próprios iguais entre tabelão v2.7 (= aba Tiers do Sheets), fichas,
frascos_v7 e avaliação.
Depois de rodar: python3 recalc.py out/tabelao_v2_7.xlsx (recalcula as fórmulas da aba Distribuição).
"""
import os; os.makedirs('out', exist_ok=True)

# ======== PARTE 1 ========
# -*- coding: utf-8 -*-
# Parte 1 do gerador v59: playbook_v59.md e fichas_tecnicas_v9.md a partir de playbook_v58.md / fichas_tecnicas_v8.md
import re, collections

def rep1(s, a, b, n=1):
    assert s.count(a) == n, (s.count(a), a[:70])
    return s.replace(a, b)

# ---------------------------------------------------------------- PLAYBOOK
L = open('playbook_v58.md', encoding='utf-8').read().split('\n')
idx = {l: i for i, l in enumerate(L)}
i_band0 = next(i for i, l in enumerate(L) if l.startswith('## 🔴 Muito Quente'))
i_custo = next(i for i, l in enumerate(L) if l.startswith('## Custo por uso com dois slots'))
i_dist = next(i for i, l in enumerate(L) if l.startswith('## Como a coleção se distribui'))
i_mud = next(i for i, l in enumerate(L) if l.startswith('## Mudanças vs v56'))

hdr = {k: next(l for l in L[:i_band0] if l.startswith(k)) for k in
       ['> **Regras de derivação', '> 1. ', '> 2. ', '> 3. ', '> 4. ', '> 5. ', '> **Overrides', '> **Princípio', '> **Dois slots']}

bands = [l for l in L[i_band0:i_custo] if not l.startswith('**Custo do dia:**')]
# remove linhas em branco duplicadas deixadas pela remoção
b2 = []
for l in bands:
    if l == '' and b2 and b2[-1] == '':
        continue
    b2.append(l)
bands = '\n'.join(b2)
JOG = [
    ('10 de uso e 9.5 de pele: o chypre-frutado que resolve o calor', 'o chypre-frutado que resolve o calor'),
    ('Chá-canela-incenso de teto alto: 10 de uso, 9.5 de pele', 'Chá-canela-incenso de teto alto'),
    ('Topo da coleção (9.5 🟡): verde-chá-conífera seco, zero doçura', 'Verde-chá-conífera seco, zero doçura'),
    ('Incenso seco e sério, 8.88 — criminosamente subusado na v45 (7 janelas)', 'Incenso seco e sério'),
    ('Único ≥9 fora do S — 9.3 com 6 janelas na v45', 'Boozy-baunilha-âmbar sem oud: o respiro do óbvio'),
]
for a, b in JOG:
    assert a in bands, a
    bands = bands.replace(a, b)
assert not re.search(r'\b\d\.\d+\b', bands), re.findall(r'.{30}\b\d\.\d+\b.{30}', bands)

# ---- parse das células para contagens e verificação
OCC = ['Lazer', 'Trab. Informal', 'Trab. Formal', 'Cozy Dia', 'Noite Informal', 'Noite Formal', 'Cozy Noite']
DIA = {'Lazer', 'Trab. Informal', 'Trab. Formal', 'Cozy Dia'}
def parse_cells(txt):
    cells = {}; band = None
    for l in txt.split('\n'):
        if l.startswith('## '):
            band = l[3:].split(' (')[0]
        m = re.match(r'\*\*(' + '|'.join(re.escape(o) for o in OCC) + r')\*\* — (.*)', l)
        if m and band:
            body = m.group(2)
            seg = re.search(r'\*\*Seguro: (.+?)\*\* \((\d+)\)', body)
            jog = re.search(r'\*\*A jogada: (.+?)\*\*', body)
            tam = re.search(r'\*\*Também:\*\* (.*?)\.?$', body)
            names = [seg.group(1)] + ([jog.group(1)] if jog else []) + ([x.strip() for x in tam.group(1).split(',')] if tam else [])
            cells[(band, m.group(1))] = (seg.group(1), seg.group(2), jog.group(1) if jog else None, names)
    return cells

old_cells = parse_cells('\n'.join(L[i_band0:i_custo]))
new_cells = parse_cells(bands)
assert old_cells == new_cells, 'células mudaram!'
tot = sum(len(v[3]) for v in new_cells.values())
assert tot == 651, tot
per = collections.Counter(n for v in new_cells.values() for n in v[3])
assert len(per) == 69, len(per)

band_order = ['🔴 Muito Quente', '🟠 Quente', '🟡 Ameno', '🔵 Fresco', '🟣 Frio', '⚫ Muito Frio']
inmet = {'🔴 Muito Quente': (27, 1), '🟠 Quente': (124, 36), '🟡 Ameno': (154, 154), '🔵 Fresco': (55, 143), '🟣 Frio': (5, 30), '⚫ Muito Frio': (0, 1)}
rows = []
for b in band_order:
    dia = {n for (bb, o), v in new_cells.items() if bb == b and o in DIA for n in v[3]}
    noi = {n for (bb, o), v in new_cells.items() if bb == b and o not in DIA for n in v[3]}
    d, n = inmet[b]
    fd = f"{d/len(dia):.1f}".replace('.', ',') if dia else '—'
    fn = f"{n/len(noi):.1f}".replace('.', ',') if noi else '—'
    rows.append(f"| {b} | {d} | {n} | {len(dia)} / {len(noi)} | {fd} / {fn} |")
ameno_fresco_noite = [len({n for (bb, o), v in new_cells.items() if bb == b and o not in DIA for n in v[3]}) for b in ('🟡 Ameno', '🔵 Fresco')]
fresco_dia = len({n for (bb, o), v in new_cells.items() if bb == '🔵 Fresco' and o in DIA for n in v[3]})

dist = '\n'.join(L[i_dist:i_mud]).rstrip()
dist = rep1(dist, ' *(idêntico desde a v51 — nenhum Seguro ou jogada mudou, nem na calibração da v57.)*',
            ' *(Seguros e jogadas idênticos desde a v51 — regra de incumbência, decisão dele de 25/set/2026.)*')

PB = f"""# Playbook v59 — 69 frascos na grade (+ Bedouin Rose, tier D, fora)

> **v59 (05/out/2026) — limpeza, sem mudança de alocação.** Células, Seguros, jogadas, *Também* e sprays são **idênticos à v58** (verificado por script: 42 células, 651 alocações). Saíram do arquivo: o histórico de versões v52–v58 (resumido no fim), as linhas *Custo do dia* (camada custo fora de qualquer framework — regra dele, 25/set/2026), as notas numéricas residuais nas descrições de jogada (o tier é a única régua desde 19/set/2026) e a tabela de grupos de custo por uso da v55, que não foi recalculada depois das entradas de 23/set, da calibração de 25/set e da saída do Vibrato das noites. A tabela de custo por uso abaixo foi **recalculada a partir da grade atual**.
>
> **Fonte de tier:** aba *Tiers* da planilha Google Sheets "Diário de Uso — Perfumes" (decisão dele, 04/out/2026). Os tiers da grade abaixo conferem com ela em 05/out/2026.

{hdr['> **Regras de derivação']}
{hdr['> 1. ']}
{hdr['> 2. ']}
{hdr['> 3. ']}
{hdr['> 4. ']}
{hdr['> 5. ']}
>
{hdr['> **Overrides'].replace(', herdados da v50 sem alteração', '')}
>
> **Total: 651 alocações · 69 frascos · S 31 · A 26 · B 10 · C 2** (+ Bedouin Rose D, 0 janelas). Promovidos de 25/set que não chegam ao teto por falta de célula elegível: Crab Apple Blossom (S, 9), Odéon (S, 9), Oud Satin Mood (S, 9); Tygar Extrait (S) tem 6 e Scarlet Sands (S) 9.
> **Camada custo (9 frascos):** fora do playbook, do ranking e de qualquer análise — usada só em academia e corrida (regra dele, 25/set/2026).

{hdr['> **Princípio'].replace(' (mantido)', '')}
>
{hdr['> **Dois slots'].replace(' (v55)', '')}

---

{bands.strip()}

## Custo por uso com dois slots

Dias e noites por faixa: normais INMET 1991–2020 (Mirante de Santana); slot Noite medido a ~21h. Frascos alocados = frascos distintos que aparecem em alguma célula da faixa na grade v59 (Dia = Lazer, Trab. Informal, Trab. Formal, Cozy Dia; Noite = Noite Informal, Noite Formal, Cozy Noite).

| Faixa | Dias/ano (slot Dia) | Noites/ano (slot Noite) | Frascos alocados Dia / Noite | Dias por frasco / Noites por frasco |
|---|---|---|---|---|
""" + '\n'.join(rows) + f"""

**Regras (vigentes desde 19/set/2026; substituem o antigo "slot frio congelado"):**

1. **Noite Ameno/Fresco (~300 noites/ano) é a janela mais abundante da coleção.** Noturno denso não reprova por clima; reprova, se reprovar, por **redundância dentro do slot Noite** e por tier — hoje {ameno_fresco_noite[0]} frascos disputam a noite de Ameno e {ameno_fresco_noite[1]} a de Fresco.
2. **Frio e Muito Frio seguem escassos nos dois slots** (~31 noites e ~5 dias/ano). Candidato cujo envelope não inclua o Fresco tem custo por uso alto.
3. **O gargalo é o slot Dia** (~12h, AC/trabalho, Ameno–Quente). Compra por gap se defende de dia. Fresco de dia: {fresco_dia} frascos para ~55 dias.
4. **Noite de calor é rara** (~37 noites/ano Quente/Muito Quente a 21h).

{dist}

## Notas de uso

- **Também** = ordem de prioridade dentro da célula (tier → aptidão → nome). Com 31 S na grade, o tier separa pouco dentro das células de noite; na dúvida entre S do *Também*, pesa o uso real registrado no diário.
- **Dois slots:** célula do Dia de manhã (7h00–7h30) e célula da Noite antes do banho (19h–20h). O perfume da noite é o segundo do dia — não repetir o da manhã; evitar dois densos (peso ≥4) no mesmo dia; mesmo arquétipo nos dois slots é aceitável. Em casa à noite, −1 spray. O perfume do Dia **não precisa durar até a noite** (decisão dele, 25/set/2026).
- **Sprays das células são valores finais.** Em extraits e beasts, primeira vez numa faixa nova: comece 1 abaixo. Désobéissant: 6–7. Ombre Nomade e Outlands no Fresco: 2.
- Cozy Dia/Noite não existem em Muito Quente/Quente.
- **Faixa do slot Dia:** máxima prevista para as horas restantes do dia. **Slot Noite:** temperatura prevista para ~20–22h (em SP, tipicamente uma faixa abaixo da máxima).
- **Td:** coluna Td da ficha do frasco para o modificador ±2.
- **O que reabre o playbook:** mudança de tier na aba *Tiers*, mudança de aptidão/envelope declarada por ele, ou frasco novo — sempre por script, nunca editando célula à mão. **Pendências que reabrem:** (1) onde ele de fato usa Favonius, Omnia Omnibus Ubique e Scarlet Sands (envelopes hoje estimados pelo Claude); (2) se ele quiser que os Seguros reflitam os novos S (hoje vale incumbência, por decisão dele).

## Histórico (resumo)

| Versão | Data | O que mudou | Alocações |
|---|---|---|---|
| v59 | 05/out/2026 | Limpeza: sem histórico longo, sem *Custo do dia*, sem notas numéricas; custo por uso recalculado; nenhuma célula muda | 651 |
| v58 | 05/out/2026 | Vibrato sai das noites (decisão dele): 15 → 9 janelas, só Lazer/Trab. Informal/Trab. Formal em MQ/Q/A | 651 |
| v57 | 25/set/2026 | Calibração de tiers por arquétipo: 24 promoções, nenhum rebaixamento | 657 |
| v56 | 23/set/2026 | Correção de cadastro: entram Favonius, Omnia Omnibus Ubique, Scarlet Sands (S); saem Bossa (dada à Bia) e Jean Lowe Vibe | 588 |
| v55 | 19/set/2026 | Leitura em dois slots por dia; revogado "slot frio congelado" | 561 |
| v54 | 19/set/2026 | Entra Les Sables Roses (S, noites Ameno–MF) | 561 |
| v53 | 18/set/2026 | Tygar Extrait S definitivo; Vibrato com exceção de 15 janelas (revogada na v58) | — |
| v52 | 18/set/2026 | Coleção reaberta; entra Tygar Extrait | — |
"""
PB = re.sub(r'\n{3,}', '\n\n', PB)
open('out/playbook_v59.md', 'w', encoding='utf-8').write(PB)
assert parse_cells(PB) == old_cells

# ---------------------------------------------------------------- FICHAS
F = open('fichas_tecnicas_v8.md', encoding='utf-8').read()
FL = F.split('\n')
i_como = next(i for i, l in enumerate(FL) if l.startswith('## Como ler'))
i_lt = next(i for i, l in enumerate(FL) if l.startswith('### 3. Tier × nota'))
i_t4 = next(i for i, l in enumerate(FL) if l.startswith('### 4. Territórios'))
i_t5 = next(i for i, l in enumerate(FL) if l.startswith('### 5. Pendências'))

LEIT = {
 '7 Loewe': 'Incenso seco de EDT: o Monge mais leve e mais usável de dia.',
 'Al Qurashi Blend': 'Oud ocidentalizado e polido — o único oud da coleção que aguenta 30°C.',
 'Ani X': "A baunilha-de-calor da coleção; relatos 10–12h. Fronteira Confeiteiro registrada ('lemon cake').",
 'Apotecário': 'Botica escura couro-chá-resina.',
 'Beach Hut Man': 'Verde-mineral que fica vivíssimo no calor.',
 'Bedouin Rose': 'Descrição literal do Brompton. Tier D: fora da grade (0 janelas). Frasco de 10 ml experimental.',
 'Black Saffron Absolu': "Açafrão-couro com framboesa: o mais 'urbano' dos açafrões. Perde para o Bijou na mesma célula.",
 'Blonde Amber': 'Lareira líquida de dia.',
 'Bois du Portugal': 'Fougère de terno — só formal, atrás de Purpose 50 e Bois Impérial nas mesmas células.',
 'Caden': 'Boozy-açafrão-café sobre baunilha candy — a fronteira do dessert gourmand recusado no DNA.',
 'Castley': 'Cítrico-apimentado competente.',
 'Crab Apple Blossom': 'Mojito-marinho de calor extremo.',
 'Decision': 'Incenso seco e sério. Ganha noite e trabalho fresco.',
 'Désobéissant': 'Verde-chá-conífera seco, zero doçura. Projeção íntima (~6h) → 6–7 sprays sempre, reaplicar.',
 'Grand Soir': 'Boozy-baunilha-âmbar sem oud: o respiro do óbvio.',
 'Green Irish Tweed': 'Clássico verde-ambergris.',
 'Hacivat': 'O chypre-frutado que resolve o calor — âncora de Lazer e Noite Informal em todo o calor.',
 'Himalaya': 'Cítrico-solar de pirâmide, frio-metálico na pele.',
 'Imagination': 'Chá-canela-incenso de teto alto. O luminoso-versátil que a prioridade #1 procurava — já estava em casa.',
 'Imperial': 'Barbearia opulenta sobre base oud-couro. Função formal de frio.',
 'Intoxicated': 'Único Confeiteiro da grade; vizinho de Caden no café-baunilha.',
 'K-Musk': 'Skin scent limpo-verde de calor. Frasco de 10 ml experimental.',
 "L'Immensité": 'Ambroxan-gengibre que não vira sopa a 30°C.',
 'Liwa': 'Açafrão-âmbar-oud num território com 3 moradores diretos.',
 'Lucius': 'Cítrico sobre âmbar seco-tonka-vetiver: a seriedade que os frescos puros não entregam, sem somar calor.',
 'Monarch': "Opulência Sultão. Fica por decisão dele ('vou gostar um dia', 19/set/2026).",
 'New York': 'O mais doce da leva de set — fronteira Confeiteiro registrada (caramelo).',
 'Ombre Nomade': 'Nuclear. Noite Formal e Cozy Noite no Fresco com 2 sprays.',
 'Oud Satin Mood': 'Rosa-oud-caramelo em extrait. 2 sprays; noite formal e cozy noite.',
 'Outlands': 'A catedral de olíbano-elemi-açafrão-oud.',
 'Reflection Man': 'Flor branca masculina, execução limpa.',
 'Santal 33': 'Não é sândalo cremoso — é cedro-couro-violeta com assinatura. O gap #4 continua aberto apesar dele.',
 'Search': 'Cítrico-incenso woody; relatos: cítrico some em 30–45 min, sobra incenso esfumaçado.',
 "Terre d'Hermès": 'Sílex-pimenta sobre vetiver-cedro: sofisticação seca.',
 'Town & Country': 'Aromático-mineral com chá branco-olíbano sobre ambergris: formal, seco e arejado.',
 'Ultima Storia': 'Cítrico-couro-empoado de extrait discreto. Formalidade com textura de talco e linho.',
 'Wood Whisper': "Sândalo-cashmere cremoso sobre âmbar branco: o mais perto de 'cremoso' que a coleção chega — e ainda não é o gap #4.",
 "Ya'e": "Aldeído-íris-pistache metálico: moderno, empoado, unissex — o frasco mais 'perfumaria de autor' da grade.",
 'Supremacy CE': 'Sonda barata do DNA Aventus.',
 'Inception': 'Sonda barata do Imagination.',
 'Dubai Musk': 'Skin scent clean; ex-grade. Musk limpo para dia de calor.',
}
SUB = [  # trechos a remover dentro de leituras longas
 ('Les Sables Roses', ' Sem nota de pele em sessão formal — medir no drydown de 4h+ em noite fresca.', ''),
 ('Les Sables Roses', '**Registro franco:** 7º frasco do território rosa oriental e 13º oud nomeado', '**Registro franco (na compra):** 7º frasco do território rosa oriental e 13º oud nomeado'),
]
done = set()
out = []
for l in FL[:i_lt]:
    m = re.match(r'\| (\d+) \| \*\*(.+?)\*\* \|', l)
    if m:
        cells = l.split(' | ')
        name = m.group(2)
        if name in LEIT:
            cells[-1] = LEIT[name] + ' |'
            done.add(name)
        l = ' | '.join(cells)
        l = re.sub(r' ?\*\*Tier v[27]: [SABCD] \(era [SABCD]\)(?: — calibração por arquétipo, 25/set/2026)?\.?\*\*\.?', '', l)
        for n, a, b in SUB:
            if n == name:
                assert a in l, a; l = l.replace(a, b)
    out.append(l)
assert done == set(LEIT), set(LEIT) - done
body = '\n'.join(out[i_como:])
body = rep1(body, '| **Envelope** | faixa mín–máx | Peso + doçura + concentração, reconciliado com o histórico de pele da v45; alargado só onde tier S/A justifica',
            '| **Envelope** | faixa mín–máx | Peso + doçura + concentração, reconciliado com o histórico de uso; alargado só onde tier S/A justifica')
body = rep1(body, '| **Janelas v57** | nº de células |', '| **Janelas** | nº de células (playbook v59) |')
body = body.replace('| Sprays-base | Janelas v57 |', '| Sprays-base | Janelas |')
body = rep1(body, '> Renomeada em 12/set/2026 (ex-"camada árabe"). Fichas informativas: envelope e aptidão servem só à linha **Custo do dia** de cada faixa.',
            '> **Fora de qualquer análise ou framework** (regra dele, 25/set/2026): usada só em academia e corrida. As fichas ficam aqui apenas porque o modelo diário as usa quando a entrada traz `Extra: corrida` ou `Extra: academia`.')
body = rep1(body, '## Camada custo — 9 frascos (rotação livre; fora da grade, do ranking e do custo-por-uso)', '## Camada custo — 9 frascos (só academia e corrida)')

t4 = '\n'.join(FL[i_t4:i_t5])
T4 = [
 ('| + Musamam Black. Grand Soir 9.3 é o topo |', '| + Musamam Black (camada custo, fora da análise) |'),
 ('| + Incense 01. Blonde Amber 6.95 é o elo fraco |', '| + Incense 01 (camada custo, fora da análise) |'),
 ('| Désobéissant 9.5 e T&C 8.5 são os únicos picos; o resto mede 6.3–7.2 |', '| 4 S (Désobéissant, Reflection Man, 1872 for Men, Bois du Portugal não — B) · ver tiers na grade |'),
 ('| 3 clones na camada custo (Jean Lowe Vibe saiu em 19/set). Imagination é o único indispensável.', '| Imagination é o único indispensável.'),
 ('| + Supremacy CE. Hacivat resolve; Anelo vive de calor extremo |', '| Hacivat resolve; Anelo vive de calor extremo |'),
]
for a, b in T4:
    t4 = rep1(t4, a, b)
NEWS = '\n'.join(FL[:i_como])  # cabeçalho antigo é descartado
# contagem real de S no verde-aromático
FICHA_TIER = {}
for l in out:
    m = re.match(r'\| \d+ \| \*\*(.+?)\*\* \| [^|]+ \| [^|]+ \| [^|]+ \| ([SABCD]) \|', l)
    if m: FICHA_TIER[m.group(1)] = m.group(2)
verdes = ['Green Irish Tweed', 'Torino 21', 'Beach Hut Man', 'Reflection Man', '1872 for Men', 'Town & Country', 'Bois du Portugal', 'Désobéissant']
sv = [v for v in verdes if FICHA_TIER[v] == 'S']
t4 = t4.replace('| 4 S (Désobéissant, Reflection Man, 1872 for Men, Bois du Portugal não — B) · ver tiers na grade |',
                f"| {len(sv)} S ({', '.join(sv)}) |")

t5 = """### 5. Pendências (05/out/2026)

- **Três entradas de 23/set com campos derivados por estimativa** (Favonius, Omnia Omnibus Ubique, Scarlet Sands): envelope, aptidões e sprays saem da pirâmide, não de uso declarado. O que reabre a grade: ele dizer onde usa cada um.
- **Auditoria de posse:** 13 amostras S/A do tabelão podem ser frascos (mesmo erro do Favonius) — Reflection 45, Sequence, Dragon, Knight of Love, Valiant, Aventus Cologne, Blue Talisman Extrait, Lust in Paradise Extrait, Rehab, Oud Maracujá, Jazz Club, Haltane, Layton. Confirmar com ele.
- **Tygar Extrait:** se render em noite fresca, o envelope alarga ao Fresco e a grade regera (S comporta 12; hoje tem 6)."""

head = """# Fichas Técnicas — v9 (05/out/2026) · grade 69 + Bedouin Rose (D) + camada custo 9

> **v9 — limpeza.** Nenhum envelope, aptidão, eixo, doçura, peso, Td, spray ou janela muda vs v8. Saíram: notas numéricas de pele e de uso nas leituras (o tier é o veredicto único desde 19/set/2026), marcas de mudança de tier antigas ("era X"), pedidos de nova medição, referências a "Tier C: n células-lar" em frascos que já não são C, a seção "Tier × nota" e o histórico de versões. Janelas = playbook v59 (651 alocações; Vibrato 9, só dia, desde 05/out/2026).
>
> **Fonte de tier:** aba *Tiers* da planilha "Diário de Uso — Perfumes" (decisão dele, 04/out/2026). Tiers desta ficha conferem com ela em 05/out/2026.

> **O que é dado dele e o que é derivado.** *Dado por ele:* tier e as leituras de uso declaradas (Vibrato só dia; Tygar Extrait noite de calor; Les Sables Roses noites exceto as quentes). *Verificado em fonte:* pirâmide, concentração, ano/nariz onde consta. *Derivado por análise* (estimativa, revisável pelo uso): eixo DNA, doçura, peso, sensibilidade ao Td, envelope térmico, aptidão por ocasião, sprays-base. As derivações organizam **onde** usar, não **quanto** vai agradar.

"""
FI = head + body[:body.find('### 3. Tier × nota')] + t4.rstrip() + '\n\n' + t5 + '\n'
FI = re.sub(r'\n{3,}', '\n\n', FI)
# checagens
for bad in ['Tier v2', 'Tier v7', 'remedi', '🟡)', ' 9.5', '8.88', 'Janelas v57', 'Custo do dia']:
    assert bad not in FI, bad
open('out/fichas_tecnicas_v9.md', 'w', encoding='utf-8').write(FI)
print('playbook', len(PB), 'fichas', len(FI), 'S verdes', sv)

# ======== PARTE 2 ========
# -*- coding: utf-8 -*-
# Parte 2 do gerador v59: tabelão v2.7 (xlsx + md), frascos_v7.py, modelo_diario_v1_6.py
import openpyxl, copy, re, collections
from openpyxl.styles import PatternFill

# ------------------------------------------------ TABELÃO XLSX
wb = openpyxl.load_workbook('tabelao_v2_6.xlsx')
ws = wb['Tabelão v2']
rows = [list(r) for r in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=6, values_only=True) if r[2]]
assert len(rows) == 333
fill_by_tier = {}
for r in range(2, ws.max_row + 1):
    t = ws.cell(r, 5).value
    if t and t not in fill_by_tier:
        fill_by_tier[t] = copy.copy(ws.cell(r, 5).fill)
base_styles = [copy.copy(ws.cell(2, c)._style) for c in range(1, 7)]

def find(p):
    c = [r for r in rows if r[2] == p]; assert len(c) == 1, p; return c[0]

CHG = []  # (casa, perfume, mudança)
r = find('Jubilation 40 (Exceptional Extrait)'); assert r[4] == 'B'; r[4] = 'S'; CHG.append((r[1], r[2], 'Tier B → S (Sheets, 04/out/2026)'))
r = find('Acqua Viva'); assert r[3] == 'a confirmar'; r[3] = 'Amostra'; CHG.append((r[1], r[2], 'Posse a confirmar → Amostra (Sheets; teste registrado no diário em 04/out)'))
for p in ('Iris Debonair', '21 Conduit St'):
    r = find(p); r[3] = 'a confirmar'; CHG.append((r[1], r[2], 'Posse: texto normalizado para "a confirmar"'))
NEW = [('Amouage', 'Bracken', 'Amostra', 'A', 'Sheets, 04/out/2026 — versão (Man ou Woman) a confirmar'),
       ('Fragrance du Bois', 'Oud Bleu Intense', 'a confirmar', 'B', 'Sheets, 04/out/2026'),
       ('Memo Paris', 'Portobello Road', 'a confirmar', 'C', 'Sheets, 04/out/2026')]
for casa, p, po, t, ori in NEW:
    last = max(i for i, x in enumerate(rows) if x[1] == casa)
    rows.insert(last + 1, [None, casa, p, po, t, '—'])
    CHG.append((casa, p, f'Linha nova · {po} · tier {t} ({ori})'))
for i, x in enumerate(rows, 1):
    x[0] = i
N = len(rows); assert N == 336
for ri, x in enumerate(rows, 2):
    for c in range(1, 7):
        cell = ws.cell(ri, c); cell._style = copy.copy(base_styles[c - 1]); cell.value = x[c - 1]
    ws.cell(ri, 5).fill = copy.copy(fill_by_tier[x[4]])
last_row = N + 1
ws.auto_filter.ref = f'A1:F{last_row}'

wd = wb['Distribuição']
for row in wd.iter_rows(min_row=2, max_row=6):
    for c in row:
        if isinstance(c.value, str) and c.value.startswith('='):
            c.value = c.value.replace('$334', f'${last_row}')
wd['H1'] = 'A confirmar'
wd['A9'] = ('Fonte: aba Tiers da planilha Google Sheets "Diário de Uso — Perfumes" (fonte única de tier desde 04/out/2026), '
            'espelhada em 05/out/2026. Coluna Nota removida em 13/set/2026.')

# Histórico consolidado (substitui as abas Mudanças)
hist = [('v2.7', '05/out/2026', c, p, m) for c, p, m in CHG]
def take(name, ver, data, fn):
    s = wb[name]
    for rr in s.iter_rows(min_row=2, values_only=True):
        if rr[0]: hist.append((ver, data, rr[0], rr[1], fn(rr)))
    wb.remove(s)
take('Mudanças v2.6', 'v2.6', '25/set/2026', lambda r: f'Tier {r[2]} · {r[3]}')
take('Mudanças v2.5', 'v2.5', '23/set/2026', lambda r: f'Posse {r[2]} · tier {r[3]} · {r[4]}')
take('Mudanças v2.4', 'v2.4', '19/set/2026', lambda r: f'Posse {r[2]} · tier {r[3]} · {r[4]}')
take('Mudanças v2.2', 'v2.2', '18/set/2026', lambda r: f'Posse {r[2]} · tier {r[3]} · {r[4]}')
take('Mudanças vs v1.1', 'v2', '12/set/2026', lambda r: f'Tier {r[2]} → {r[3]}')
hs = wb.create_sheet('Histórico', 1)
hs.append(['Versão', 'Data', 'Casa', 'Perfume', 'Mudança'])
for h in hist:
    hs.append([str(x).replace('**', '') for x in h])
hdr_style = copy.copy(ws.cell(1, 1)._style)
for c in range(1, 6):
    hs.cell(1, c)._style = copy.copy(hdr_style)
    for rr in range(2, hs.max_row + 1):
        hs.cell(rr, c)._style = copy.copy(base_styles[1])
for col, w in zip('ABCDE', (8, 13, 22, 36, 90)):
    hs.column_dimensions[col].width = w
hs.freeze_panes = 'A2'
wb.save('out/tabelao_v2_7.xlsx')

# ------------------------------------------------ TABELÃO MD
cnt = collections.Counter((x[4], x[3]) for x in rows)
cols = ['Frasco Gui', 'Frasco Bia', 'Amostra Bia', 'Amostra', 'Avaliado', 'a confirmar']
dist = ['| Tier | Total | ' + ' | '.join(cols) + ' |', '|' + '---|' * (len(cols) + 2)]
for t in 'SABCD':
    dist.append(f'| {t} | {sum(cnt[(t, c)] for c in cols)} | ' + ' | '.join(str(cnt[(t, c)]) for c in cols) + ' |')
dist.append(f'| **Total** | **{N}** | ' + ' | '.join(f"**{sum(cnt[(t, c)] for t in 'SABCD')}**" for c in cols) + ' |')
assert sum(cnt[(t, c)] for t in 'SABCD' for c in cols) == N
fg = {t: cnt[(t, 'Frasco Gui')] for t in 'SABCD'}
old = open('tabelao_v2_6.md', encoding='utf-8').read()
novos = old[old.find('## Novos no tabelão'):old.find('## Tier D')].rstrip()
novos = novos.replace('Encaixe nos arquétipos: ver `arquetipos_v1_14.md`; características completas (clima, pirâmide, nariz) no `avaliacao_perfumes_v50`.',
                      'Características completas (clima, pirâmide, nariz) no `avaliacao_perfumes_v51`.')
novos = re.sub(r' Creed Iris Debonair e Jovoy 21 Conduit St vieram marcados "Novo" — se forem frascos comprados, a coleção fechada em 06/set reabriu\.',
               ' Iris Debonair e 21 Conduit St vieram marcados "Novo" — posse segue a confirmar.', novos)
novos = novos.replace('Marcado NOVO — confirmar posse', 'Posse a confirmar').replace('Marcado Novo — confirmar posse', 'Posse a confirmar')
tierD = [x for x in rows if x[4] == 'D']
md = f"""# Tabelão v2.7 — S/A/B/C/D (05/out/2026)

> **Espelho da aba *Tiers* da planilha Google Sheets "Diário de Uso — Perfumes"**, que é a fonte única de tier desde 04/out/2026 (decisão dele). Em conflito, a planilha vence; este arquivo é regerado a partir dela. Âncora: **S** compraria de novo amanhã · **A** alegria real · **B** respeito, cumpre função · **C** neutro · **D** fora (não comprar / fora da grade).
>
> **v2.7 (05/out/2026):** Jubilation 40 B→S · Acqua Viva → Amostra · entram Bracken (Amostra, A — versão Man/Woman a confirmar), Oud Bleu Intense (a confirmar, B) e Portobello Road (a confirmar, C). Nenhum frasco próprio mudou. {N} linhas. Histórico completo de versões na aba *Histórico* do xlsx.

## Distribuição

{chr(10).join(dist)}

Frasco Gui = {sum(fg.values())} (69 grade + Bedouin Rose em D + 9 camada custo) · por tier: S {fg['S']} · A {fg['A']} · B {fg['B']} · C {fg['C']} · D {fg['D']}.

## Tabelão

| # | Casa | Perfume | Posse | Tier | # v1 |
|---|---|---|---|---|---|
""" + '\n'.join(f'| {x[0]} | {x[1]} | {x[2]} | {x[3]} | {x[4]} | {x[5]} |' for x in rows) + f"""

## Mudanças v2.6 → v2.7 (05/out/2026)

| Casa | Perfume | Mudança |
|---|---|---|
""" + '\n'.join(f'| {c} | {p} | {m} |' for c, p, m in CHG) + f"""

{novos}

## Tier D — detalhe ({len(tierD)}, já incluídos na tabela)

| Casa | Perfume | Posse |
|---|---|---|
""" + '\n'.join(f'| {x[1]} | {x[2]} | {x[3]} |' for x in tierD) + '\n'
open('out/tabelao_v2_7.md', 'w', encoding='utf-8').write(md)
print('tabelão', N, dict(fg), len(hist), 'linhas de histórico')

# ------------------------------------------------ FRASCOS v7
f = open('frascos_v6.py', encoding='utf-8').read()
i = f.find('Fontes, por campo:')
doc = '''# -*- coding: utf-8 -*-
"""
frascos_v7.py — base de dados dos 79 frascos para o modelo diário (v7, 05/out/2026)

v7: só limpeza de cabeçalho e comentários. Nenhum dado muda vs v6. Tiers conferidos com a aba Tiers do Google Sheets
"Diário de Uso — Perfumes" (fonte única de tier desde 04/out/2026). Janelas = playbook v59 (651; Vibrato 9, só dia,
desde 05/out/2026). A camada custo (9) fica aqui só para o modelo sugerir quando a entrada traz "Extra: corrida" ou
"Extra: academia" — fora de qualquer análise da coleção (regra dele, 25/set/2026).

'''
f = doc + f[i:]
f = f.replace('= array DATA do mapa_climatico_colecao_v4.html, que por sua vez lê fichas v7 + arquétipos v1.14.',
              '= array DATA do mapa climático (v4, 25/set/2026), derivado das fichas técnicas.')
f = f.replace('FICHA (conc, eixo, aptidão, sprays_base, janelas_v57)', 'FICHA (conc, eixo, aptidão, sprays_base, janelas)')
f = f.replace('= transcritos das fichas_tecnicas_v7.md (grade 69 + Bedouin Rose + camada custo 9).', '= transcritos das fichas_tecnicas_v9.md (grade 69 + Bedouin Rose + camada custo 9).')
f = f.replace('Validação embutida: 79 frascos · Td grade C21/S25/N24 · janelas v57 = 657.', 'Validação embutida: 79 frascos · Td grade C21/S25/N24 · janelas = 651.')
f = f.replace('Nada aqui é\n        medição de pele.', 'Nada aqui é\n        medição.')
f = f.replace('# FICHA: nome -> (concentração, eixo, aptidão "Ocasião n · ...", sprays_base, janelas_v57)', '# FICHA: nome -> (concentração, eixo, aptidão "Ocasião n · ...", sprays_base, janelas)')
f = f.replace('   # v58: sai das noites (05/out/2026)', '   # sai das noites por decisão dele (05/out/2026)')
for bad in ('v57', '657', 'v1.14', 'remedição', 'SEM_PELE'):
    assert bad not in f, bad
open('out/frascos_v7.py', 'w', encoding='utf-8').write(f)

# ------------------------------------------------ MODELO v1.6
m = open('modelo_diario_v1_5.py', encoding='utf-8').read()
i = m.find('Uso:')
mdoc = '''# -*- coding: utf-8 -*-
"""
modelo_diario_v1_6.py — Top 10 do dia em DOIS SLOTS (v1.6, 05/out/2026 — base frascos_v7)

v1.6 vs v1.5: (1) a camada custo só aparece quando a entrada traz "Extra: corrida" ou "Extra: academia" — regra
dele (25/set/2026): camada custo é usada só em academia e corrida e fica fora de qualquer análise; (2) cabeçalho e
textos de versão corrigidos. Pesos, filtros e ranking da grade idênticos à v1.5.
Rotina (19/set/2026): 2x/dia, sempre — manhã 7h00–7h30 e noite após o banho ~19h–20h. O perfume do slot Dia não
precisa durar até a noite (25/set/2026): a "presença" estimada serve só aos filtros de clima/ocasião e ao resíduo.

'''
m = mdoc + m[i:]
m = m.replace('python3 modelo_diario_v1_2.py', 'python3 modelo_diario_v1_6.py')
m = m.replace('Extra: escuro | fresco | testar Liwa | vento | sol | corrida', 'Extra: escuro | fresco | testar Liwa | vento | sol | corrida | academia')
m = m.replace('top 10 da grade + custo do slot', 'top 10 da grade (+ camada custo só com corrida/academia)')
m = m.replace('Regras herdadas da cadeia v54 que este modelo NÃO altera', 'Regras do playbook que este modelo NÃO altera')
m = m.replace('from frascos_v6 import', 'from frascos_v7 import')
m = m.replace("'Reaplico' não existe mais na v1.2", "'Reaplico' não existe mais")
a = '        out.append(f"**Custo do slot** (camada custo, fora do ranking): "'
assert m.count(a) == 1
m = m.replace(a, '        if ("corrida" in d["extra"] or "academia" in d["extra"]):\n            out.append(f"**Custo do slot** (camada custo — corrida/academia, fora do ranking): "')
m = m.replace('_Modelo v1.5 (dois slots · base frascos_v6, 79 frascos)', '_Modelo v1.6 (dois slots · base frascos_v7, grade 69)')
for bad in ('frascos_v6', 'v1.5 (', 'v1_4', 'v1_2'):
    assert bad not in m, bad
open('out/modelo_diario_v1_6.py', 'w', encoding='utf-8').write(m)
print('frascos/modelo ok')

# ======== PARTE 3 ========
# -*- coding: utf-8 -*-
# Parte 3 do gerador v59: observatorio_colecao_v4_6.html, mapa_climatico_colecao_v5.html, avaliacao_perfumes_v51_2026-10-05.html
import json, re, openpyxl

def rep(s, a, b, n=1):
    assert s.count(a) == n, (s.count(a), a[:80])
    return s.replace(a, b)

# células do playbook v59 (parse_cells vem da parte 1)
PBMD = open('out/playbook_v59.md', encoding='utf-8').read()
cells = parse_cells(PBMD)
BK = {'🔴 Muito Quente': 'mq', '🟠 Quente': 'q', '🟡 Ameno': 'am', '🔵 Fresco': 'fr', '🟣 Frio': 'fri', '⚫ Muito Frio': 'mf'}
OK = {'Lazer': 'lazer', 'Trab. Informal': 'ti', 'Trab. Formal': 'tf', 'Noite Informal': 'ni', 'Noite Formal': 'nf', 'Cozy Dia': 'cd', 'Cozy Noite': 'cn'}
jdesc = {}
for l in PBMD.split('\n'):
    for m in re.finditer(r'\*\*A jogada: (.+?)\*\* — (.+?) \(tier [SABCD]\)', l):
        jdesc.setdefault(m.group(1), set()).add(m.group(2))

# ------------------------------------------------ OBSERVATÓRIO
s = open('observatorio_colecao_v4_5.html', encoding='utf-8').read()
a = s.find('const PB = ') + 11; b = s.find('\n};', a) + 2
OLD = json.loads(s[a:b])
NEW = {}
for bk, occs in OLD.items():
    NEW[bk] = {}
    for ok_, cell in occs.items():
        key = next(((bb, oo) for (bb, oo) in cells if BK[bb] == bk and OK[oo] == ok_), None)
        if key is None:
            assert cell is None; NEW[bk][ok_] = None; continue
        seg, spr, jog, names = cells[key]
        line = next(l for l in PBMD.split('\n')[PBMD.split('\n').index(next(x for x in PBMD.split('\n') if x.startswith('## ' + key[0]))):] if l.startswith('**' + key[1] + '**'))
        jd = re.search(r'\*\*A jogada: .+?\*\* — (.+?) \(tier [SABCD]\)', line)
        NEW[bk][ok_] = {'s': [seg, int(spr)], 'j': [jog, jd.group(1)] if jog else None,
                        't': names[2 if jog else 1:]}
        if cell.get('j') is None: NEW[bk][ok_]['j'] = None
# diferenças esperadas: só Vibrato fora das noites + textos de jogada
diff = []
for bk in OLD:
    for o in OLD[bk]:
        if OLD[bk][o] != NEW[bk][o]:
            ot, nt = OLD[bk][o]['t'], NEW[bk][o]['t']
            if ot != nt: diff.append((bk, o, sorted(set(ot) - set(nt)), sorted(set(nt) - set(ot))))
assert all(d[2] == ['Vibrato'] and d[3] == [] and d[1] in ('ni', 'nf') for d in diff), diff
assert len(diff) == 6, diff
pbjs = json.dumps(NEW, ensure_ascii=False, indent=0)
s = s[:a] + pbjs + s[b:]

fa = s.find('const FR = ') + 11; fb = s.find(';', fa)
FR = json.loads(s[fa:fb])
FR2 = [f for f in FR if not f.get('curio')]
assert len(FR) - len(FR2) == 9 and len(FR2) == 70
s = s[:fa] + json.dumps(FR2, ensure_ascii=False) + s[fb:]

s = rep(s, '<title>Observatório da Coleção v4.5 — tiers S/A/B/C/D · 69 na grade + 9 camada custo · 16 arquétipos · playbook v57</title>',
        '<title>Observatório da Coleção v4.6 — tiers S/A/B/C/D · 69 na grade · 16 arquétipos · playbook v59</title>')
i = s.find('<div class="sub">v4.5'); j = s.find('</div>', i)
s = s[:i] + ('<div class="sub">v4.6 · 05/out/2026 (playbook v59 · fichas v9 · tabelão v2.7) · <b>69 na grade</b> + Bedouin Rose fora da grade (tier D) · '
             'tiers = aba Tiers do Google Sheets (fonte única desde 04/out/2026) · Vibrato só dia e trabalho desde 05/out/2026 · '
             'camada custo fora do painel (só academia e corrida, regra de 25/set/2026) — a órbita é o tier (S externo → D interno); nenhum número decimal de gosto.') + s[j:]
s = s.replace('(playbook v57)', '(playbook v59)')
s = rep(s, 'célula literal do playbook v57', 'célula literal do playbook v59')
i = s.find('<span>Camada custo (10:'); j = s.find('</span>', i) + 7
s = s[:i] + '<span>Camada custo: fora do painel (usada só em academia e corrida).</span>' + s[j:]
s = re.sub(r'/\* ============ DADOS — 23/set/2026:[^*]*\*/', '/* ============ DADOS — 05/out/2026: 70 frascos (grade 69 + Bedouin Rose D); camada custo fora */', s)
s = re.sub(r'/\* ============ PLAYBOOK v57 — [^*]*\*/', '/* ============ PLAYBOOK v59 — grade literal (651 alocações · 69 frascos · teto S 12 · A 9 · B 6 · C 3 · D 0 · sem exceções) */', s)
s = s.replace('/* camada árabe: orbes tracejados, fora da grade; "árabe do dia" por fit */', '/* camada custo removida do painel em 05/out/2026; CURIO fica vazio */')
for bad in ('v57', 'Vibrato 15', 'árabe', '9.5 de pele', '10 de uso', 'Jean Lowe'):
    assert bad not in s, (bad, s[s.find(bad) - 100:s.find(bad) + 60])
open('out/observatorio_colecao_v4_6.html', 'w', encoding='utf-8').write(s)
print('observatório ok', len(diff), 'células sem Vibrato à noite')

# ------------------------------------------------ MAPA
s = open('mapa_climatico_colecao_v4.html', encoding='utf-8').read()
a = s.find('[', s.find('const DATA')); b = s.find('];', a) + 1
D = json.loads(s[a:b]); D2 = [d for d in D if not d['c']]
assert len(D2) == 70
s = s[:a] + json.dumps(D2, ensure_ascii=False, separators=(',', ':')) + s[b:]
s = rep(s, '<title>Mapa climático da coleção v4 — temperatura × ponto de orvalho × chuva · 79 frascos · fichas v7 · arquétipos v1.14 · 25/set/2026</title>',
        '<title>Mapa climático da coleção v5 — temperatura × ponto de orvalho × chuva · 70 frascos · fichas v9 · 05/out/2026</title>')
txt_old = re.search(r'v4 de 25/set/2026 \(calibração[^<]*?sem ocasião\.', s)
assert txt_old, 'texto de versão do mapa'
s = s.replace(txt_old.group(0), 'v5 de 05/out/2026: camada custo fora do mapa (usada só em academia e corrida — regra de 25/set/2026); 70 frascos = grade 69 + Bedouin Rose (D). Posições, envelopes e tiers inalterados vs v4 (tiers conferidos com a aba Tiers do Google Sheets). Sem ocasião.')
s = s.replace('79 frascos posicionados', '70 frascos posicionados').replace('Dispersão dos 79 frascos', 'Dispersão dos 70 frascos')
s = rep(s, '<span><i style="width:24px;height:24px;background:none;border:1.5px dashed var(--muted)"></i>camada custo</span>', '')
assert '79 frascos' not in s
open('out/mapa_climatico_colecao_v5.html', 'w', encoding='utf-8').write(s)
print('mapa ok')

# ------------------------------------------------ AVALIAÇÃO
s = open('avaliacao_perfumes_v50_2026-09-25.html', encoding='utf-8').read()
i = s.find('/*<<D>>*/') + 9; j = s.find('/*<</D>>*/')
D = json.loads(s[i:j])
def row(casa, nome):
    c = [r for r in D if r[0] == casa and r[1] == nome]; assert len(c) == 1, (casa, nome, len(c)); return c[0]
def note(r, t):
    r[15] = (r[15] + ' | ' if r[15] else '') + t
r = row('Amouage', 'Jubilation 40 (Exceptional Extrait)'); assert r[2] == 'B'; r[2] = 'S'; note(r, '04/out/2026: tier B → S (Sheets).')
r = row('Profumum Roma', 'Acqua Viva'); r[21] = 'Amostra'; note(r, '04/out/2026: testado como amostra (diário).')
r = row('Amouage', 'Bracken Man'); r[2] = 'A'; r[21] = 'Amostra'; note(r, "04/out/2026: tier A, Amostra (Sheets) — versão Man ou Woman a confirmar.")
r = row('Fragrance du Bois', 'Oud Bleu Intense'); r[2] = 'B'; note(r, '04/out/2026: tier B (Sheets); posse a confirmar.')
r = row('Memo Paris', 'Portobello Road'); r[2] = 'C'; note(r, '04/out/2026: tier C (Sheets); posse a confirmar.')
r = row('BYNOMADS', 'Oud Kyphi')
r[15] = rep(r[15], 'mas cai no slot mais saturado (~40 dias frios/ano). Risco é custo-por-uso, não perfil.',
            'risco registrado na compra: custo por uso (o princípio de ~40 dias frios foi revogado em 19/set/2026; com dois slots o risco é redundância no slot Noite).')
# conferência de tiers dos frascos próprios contra o tabelão v2.7 (= Sheets)
wb = openpyxl.load_workbook('out/tabelao_v2_7.xlsx'); ws = wb['Tabelão v2']
T = {(x[1], x[2]): x[4] for x in ws.iter_rows(min_row=2, values_only=True) if x[2]}
own = [r for r in D if r[21] == 'Frasco Gui']
mis = [(r[0], r[1], r[2], T.get((r[0], r[1]))) for r in own if T.get((r[0], r[1])) not in (None, r[2])]
assert len(own) == 79 and not mis, mis
ds = json.dumps(D, ensure_ascii=False)
s = s[:i] + ds + s[j:]
s = rep(s, '<title>Avaliação de perfumes — v50 (tiers)</title>', '<title>Avaliação de perfumes — v51 (tiers)</title>')
h1 = re.search(r'<h1>Avaliação de perfumes — <em>104 casas</em> · 1205 frascos · 25/set/2026 · v50 \(.*?\)</h1>', s, re.S)
assert h1
s = s.replace(h1.group(0), '<h1>Avaliação de perfumes — <em>104 casas</em> · 1205 frascos · 05/out/2026 · v51 (tiers espelhados da aba Tiers do Google Sheets — fonte única desde 04/out/2026 · Jubilation 40 B→S · Acqua Viva → Amostra · tiers dados a Bracken Man (A), Oud Bleu Intense (B) e Portobello Road (C) · 79 frascos próprios conferidos)</h1>')
open('out/avaliacao_perfumes_v51_2026-10-05.html', 'w', encoding='utf-8').write(s)
print('avaliação ok', len(own))
