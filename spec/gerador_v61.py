# -*- coding: utf-8 -*-
"""
gerador_v61.py — regera a cadeia v61 (23/out/2026) a partir dos arquivos v60 do projeto + tabelão v2.9.

Entradas (na pasta corrente): fichas_tecnicas_v10.md · frascos_v8.py · modelo_diario_v1_7.py ·
tabelao_v2_9.md · 00_LEIA_PRIMEIRO.md (versão de 23/out/2026 com tabelão v2.9).   Saídas: pasta out/.

O que muda (e só isso — verificado por assert):
  · entra Swiss Arabian Enigma of Taif na camada custo (11º frasco da camada; Frasco Gui, tier A — fala dele,
    23/out/2026; aba Tiers e tabelão v2.9). Ficha completa, entrada em MAPA/FICHA e override de performance.
  · grade (71), playbook v60 (668 alocações), observatório v4.8 e mapa climático v6 NÃO mudam: os três
    últimos excluem a camada custo por regra dele (25/set/2026); nenhum campo de nenhum outro frasco muda.

Origem dos campos do Enigma of Taif:
  · dado dele: posse e tier A; camada custo (só corrida/academia).
  · verificado em fonte: pirâmide, concentração (Extrait), ano 2025, nariz Shinichiro Oba, coleção Cities
    (Ferwer, Notino, Aar Fragrances, Ulta). Fragrantica/Parfumo sem dado acessível em 23/out/2026.
  · derivado pelo Claude (estimativa, revisável pelo uso): arquétipo, eixo, doçura, peso, Td, envelope, aptidão,
    sprays-base, índice de chuva, longevidade/projeção/curva (lastro: ScentVerdict — longevidade 6–10h,
    projeção forte; Ulta — projeção forte, noite e estações frias).
"""
import re, json, os, importlib.util, collections
os.makedirs('out', exist_ok=True)
def rep1(s, a, b, n=1):
    assert s.count(a) == n, (s.count(a), a[:90]); return s.replace(a, b)

N = 'Enigma of Taif'
MAPA_NOVO = dict(n=N, casa='Swiss Arabian', arq='Rosal', t='A', td='S', p=4, d=2, a=3, b=5, c=1, r=0.5, u=0)
FICHA_NOVA = ('Extrait', 'S', 'N.Inf 2 · N.For 3 · Cozy N 2', 2)
PERF_NOVA = (10, 4, 'F')
FICHA_ROW = ['82', f'**{N}**', 'Swiss Arabian', 'Extrait', 'Rosal', 'A',
 'cardamomo-pimenta preta-pimenta rosa-elemi-ameixa / rosa Taif-açafrão-violeta-osmanthus-olíbano / carvalho-melaço-vetiver-âmbar-labdanum '
 '(2025, Shinichiro Oba, coleção Cities — pirâmide: Ferwer, Notino, Aar Fragrances, Ulta; verificada em 23/out/2026. Uma listagem da Notino troca osmanthus por heliotrópio)',
 'S', '2', '4', 'S', '🔵F–⚫MF', FICHA_NOVA[2], str(FICHA_NOVA[3]), '—',
 'Bedouin Rose (rosa Taif-açafrão-olíbano-âmbar), Brompton, Radical Rose',
 "Rosa Taif jammy entre especiarias (cardamomo, pimentas) e ameixa, com base escura e adocicada de melaço-labdanum-âmbar: "
 "rosa oriental resinosa de frio. **Camada custo (tier A dado por ele, 23/out/2026): só corrida e academia — fora de qualquer análise.** "
 "Envelope, aptidão, sprays e performance são estimativa do Claude: varejistas relatam projeção forte e uso noturno/estações frias "
 "(Ulta; ScentVerdict: longevidade 6–10h, projeção forte, 'beast mode', perfil polarizante). Começar em 2 sprays. "
 "**Registro franco:** como perfume de corrida/academia é o mais denso da camada; o modelo só o sugere com Extra corrida/academia em faixa Fresco–MF."]

# ======== PARTE A — frascos_v9.py ========
spec = importlib.util.spec_from_file_location('fv8', 'frascos_v8.py'); fv8 = importlib.util.module_from_spec(spec); spec.loader.exec_module(fv8)
assert N not in {m['n'] for m in fv8.MAPA} and N not in fv8.FICHA
base = fv8.carregar(); assert len(base) == 81
S = open('frascos_v8.py', encoding='utf-8').read()
KEYS = ['n', 'casa', 'arq', 't', 'td', 'p', 'd', 'a', 'b', 'c', 'r', 'u']
mline = ' {' + ','.join(f'"{k}":' + json.dumps(MAPA_NOVO[k], ensure_ascii=False) for k in KEYS) + '},'
emp = ' {"n":"Empire","casa":"Mykonos","arq":"Marinho","t":"A","td":"C","p":2,"d":1,"a":0,"b":2,"c":1,"r":-0.5,"u":0},\n'
S = rep1(S, emp, emp + mline + '   # v9: camada custo (23/out/2026) — campos derivados pelo Claude, estimativa\n')
fe = ' "Empire": ("n/d", "F", "Lazer 3 · T.Inf 1", 4, None),\n'
S = rep1(S, fe, fe + f' {json.dumps(N)}: ("{FICHA_NOVA[0]}", "{FICHA_NOVA[1]}", "{FICHA_NOVA[2]}", {FICHA_NOVA[3]}, None),   # v9: camada custo, tier A dado por ele\n')
bss = ' "Blue Sapphire Supercharged": (10, 4, "F"),  # Fragrantica: relatos de 12h+ — estimativa\n'
S = rep1(S, bss, bss + f' {json.dumps(N)}: {PERF_NOVA!r},   # ScentVerdict 6–10h, projeção forte; Ulta: projeção forte — estimativa\n'.replace("'", '"'))
S = rep1(S, '    assert len(frascos) == 81, len(frascos)', '    assert len(frascos) == 82, len(frascos)')
S = rep1(S, '    assert len(grade) == 71\n', '    assert len(grade) == 71\n    custo = [f for f in frascos if f["custo"]]\n    assert len(custo) == 11, len(custo)\n')
S = rep1(S, '    assert tiers == {"S": 34, "A": 31, "B": 13, "C": 3, "D": 0}, tiers', '    assert tiers == {"S": 34, "A": 32, "B": 13, "C": 3, "D": 0}, tiers')
S = rep1(S, 'print("OK — 81 frascos · Td grade C21/S26/N24 · janelas 668 · tiers"', 'print("OK — 82 frascos (grade 71 + camada custo 11) · Td grade C21/S26/N24 · janelas 668 · tiers"')
i0 = S.index('"""\nfrascos_v8.py'); i1 = S.index('Fontes, por campo:')
S = S[:i0] + '''"""
frascos_v9.py — base de dados dos 82 frascos para o modelo diário (v9, 23/out/2026 — gerado por gerador_v61.py)

v9: entra Swiss Arabian Enigma of Taif na camada custo (11º; Frasco Gui, tier A — fala dele, 23/out/2026). Grade (71),
janelas (playbook v60, 668) e todos os demais frascos idênticos à v8. Tiers conferidos com o tabelão v2.9 (espelho da
aba Tiers do Google Sheets "Diário de Uso — Perfumes"). A camada custo (11) fica aqui só para o modelo sugerir quando
a entrada traz "Extra: corrida" ou "Extra: academia" — fora de qualquer análise da coleção (regra dele, 25/set/2026).

v8: entram Blue Sapphire Supercharged (grade, S) e Empire (camada custo, A); Bedouin Rose D→C entra na grade.

''' + S[i1:]
S = rep1(S, '= transcritos das fichas_tecnicas_v10.md (grade 71 + camada custo 10).', '= transcritos das fichas_tecnicas_v11.md (grade 71 + camada custo 11).')
S = rep1(S, 'Validação embutida: 81 frascos · Td grade C21/S26/N24 · janelas = 668.', 'Validação embutida: 82 frascos · camada custo 11 · Td grade C21/S26/N24 · janelas = 668.')
open('out/frascos_v9.py', 'w', encoding='utf-8').write(S)

# conferência: nada além do Enigma mudou
spec = importlib.util.spec_from_file_location('fv9', 'out/frascos_v9.py'); fv9 = importlib.util.module_from_spec(spec); spec.loader.exec_module(fv9)
novo = fv9.carregar(); assert len(novo) == 82
old = {f['nome']: f for f in base}; new = {f['nome']: f for f in novo}
assert set(new) - set(old) == {N}
for n in old: assert old[n] == new[n], n
e = new[N]
assert e['custo'] and e['tier'] == 'A' and (e['longev'], e['proj'], e['curva']) == PERF_NOVA and e['perf_origem'] == 'leitura'

# conferência com o tabelão v2.9 (espelho da aba Tiers)
T = open('tabelao_v2_9.md', encoding='utf-8').read()
rows = [[x.strip() for x in l.strip('|').split('|')] for l in T.split('\n') if re.match(r'^\| \d+ \| ', l)]
assert len(rows) == 362
fg = [r for r in rows if r[3] == 'Frasco Gui']
assert len(fg) == 82
assert ['Swiss Arabian', N, 'Frasco Gui', 'A'] in [r[1:5] for r in fg]
assert collections.Counter(r[4] for r in fg) == collections.Counter(f['tier'] for f in novo)
print('frascos_v9:', len(novo), 'frascos ·', sum(f['custo'] for f in novo), 'na camada custo · Enigma', e['longev'], e['proj'], e['curva'])

# ======== PARTE B — fichas_tecnicas_v11.md ========
F = open('fichas_tecnicas_v10.md', encoding='utf-8').read()
FL = F.split('\n')
iemp = [i for i, l in enumerate(FL) if l.startswith('| 81 | **Empire** |')]; assert len(iemp) == 1
assert not FL[iemp[0] + 1].startswith('| ')
FL.insert(iemp[0] + 1, '| ' + ' | '.join(FICHA_ROW) + ' |')
assert len(FICHA_ROW) == 17
F = '\n'.join(FL)
i0 = F.index('# Fichas Técnicas — v10'); i1 = F.index('> **Fonte de tier:**')
F = F[:i0] + """# Fichas Técnicas — v11 (23/out/2026) · grade 71 + camada custo 11

> **v11 — regerado por `gerador_v61.py`.** Entra **Enigma of Taif** (Swiss Arabian) na camada custo (11º frasco; tier A dado por ele, 23/out/2026). Grade, janelas (playbook v60, 668 alocações) e todas as demais fichas idênticas à v10.
>
> **v10 — regerado por `gerador_v60.py`.** Entram Blue Sapphire Supercharged (grade, S) e Empire (camada custo, A); Bedouin Rose D→C entra na grade; Favonius, Omnia Omnibus Ubique e Scarlet Sands revistos pelo Claude a pedido dele.
>
""" + F[i1:]
F = rep1(F, '## Camada custo — 10 frascos (só academia e corrida · slot E no diário)', '## Camada custo — 11 frascos (só academia e corrida · slot E no diário)')
F = rep1(F, 'Quatro pirâmides não têm fonte limpa documentada — marcadas como tal, não inventadas.',
         'Quatro pirâmides não têm fonte limpa documentada — marcadas como tal, não inventadas. Enigma of Taif (23/out/2026): pirâmide verificada em varejistas; envelope, aptidão, sprays e performance são estimativa do Claude.')
old_ro = [l for l in F.split('\n') if l.startswith('| Rosa oriental | 9 |')]; assert len(old_ro) == 1
F = rep1(F, old_ro[0], old_ro[0][:-2].rstrip() + '. + Enigma of Taif (camada custo, fora da análise) |')
F = rep1(F, '### 4. Pendências (23/out/2026)\n\n', '### 4. Pendências (23/out/2026)\n\n- **Enigma of Taif (camada custo):** envelope Fresco–MF, aptidão, 2 sprays e performance (10h · projeção 4 · fundo manda) são estimativa do Claude sem uso declarado; o slot E do diário confirma ou derruba.\n')
open('out/fichas_tecnicas_v11.md', 'w', encoding='utf-8').write(F)
cnt = sum(1 for l in F.split('\n') if re.match(r'^\| \d+ \| \*\*', l))
assert cnt == 82, cnt
print('fichas v11:', cnt, 'linhas de ficha')

# ======== PARTE C — modelo_diario_v1_8.py ========
M = open('modelo_diario_v1_7.py', encoding='utf-8').read()
M = rep1(M, 'modelo_diario_v1_7.py — Top 10 do dia em DOIS SLOTS (v1.7, 23/out/2026 — base frascos_v8)\n',
         'modelo_diario_v1_8.py — Top 10 do dia em DOIS SLOTS (v1.8, 23/out/2026 — base frascos_v9)\n\n'
         'v1.8 vs v1.7: só a base — frascos_v9 (camada custo 11: entra Enigma of Taif). Pesos, filtros e ranking idênticos.\n')
M = rep1(M, 'from frascos_v8 import carregar', 'from frascos_v9 import carregar')
M = M.replace('python3 modelo_diario_v1_7.py', 'python3 modelo_diario_v1_8.py')
M = rep1(M, '_Modelo v1.7 (dois slots · base frascos_v8, grade 71)', '_Modelo v1.8 (dois slots · base frascos_v9, grade 71 + camada custo 11)')
open('out/modelo_diario_v1_8.py', 'w', encoding='utf-8').write(M)
print('modelo v1.8 escrito')

# ======== PARTE D — 00_LEIA_PRIMEIRO.md ========
L = open('00_LEIA_PRIMEIRO.md', encoding='utf-8').read()
L = rep1(L, '| `fichas_tecnicas_v10.md` |', '| `fichas_tecnicas_v11.md` |')
L = rep1(L, '| `frascos_v8.py` + `modelo_diario_v1_7.py` | Modelo "Top 10 do dia" em dois slots (`python3 modelo_diario_v1_7.py --exemplo`) |',
         '| `frascos_v9.py` + `modelo_diario_v1_8.py` | Modelo "Top 10 do dia" em dois slots (`python3 modelo_diario_v1_8.py --exemplo`); 82 frascos (grade 71 + camada custo 11) |')
L = rep1(L, '| `gerador_v60.py` | Script que gera toda a cadeia v60 a partir da v59 + snapshot da aba Tiers, com verificações |',
         '| `gerador_v61.py` | Script da cadeia v61 (a partir da v60 + tabelão v2.9): entra Enigma of Taif na camada custo; grade e playbook v60 intactos |')
L = rep1(L, 'mapa v5, avaliação v51, gerador_v59)', 'mapa v5, avaliação v51, gerador_v59, fichas v10, frascos_v8, modelo v1.7, gerador_v60)')
L = rep1(L, '| Camada custo | 11 frascos (Enigma of Taif, A, entrou em 23/out/2026; fora do motor até a próxima geração) —',
         '| Camada custo | 11 frascos (Enigma of Taif, A, entrou em 23/out/2026 — ficha v11 e frascos_v9; campos derivados são estimativa do Claude) —')
L = rep1(L, '\n| 5 | Enigma of Taif (camada custo) entra em fichas e `frascos_v*` só na próxima rodada do gerador | Claude, na próxima regeração |', '')
L = rep1(L, '# 00 — LEIA PRIMEIRO · fonte de verdade do projeto (23/out/2026 · cadeia v60)', '# 00 — LEIA PRIMEIRO · fonte de verdade do projeto (23/out/2026 · cadeia v61)')
open('out/00_LEIA_PRIMEIRO.md', 'w', encoding='utf-8').write(L)
print('LEIA_PRIMEIRO atualizado')
