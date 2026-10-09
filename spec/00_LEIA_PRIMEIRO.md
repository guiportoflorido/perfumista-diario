# 00 — LEIA PRIMEIRO · fonte de verdade do projeto (05/out/2026 · cadeia v59)

> Vale para toda conversa deste projeto, inclusive quando a skill @perfumista for acionada. Este arquivo só traz **regras vigentes** — o histórico de cada decisão está nos próprios arquivos (seção *Histórico*) e não deve ser usado como regra.

## 1. Hierarquia de fontes

| Ordem | Fonte | Para quê |
|---|---|---|
| 1 | **Fala do Guilherme** na conversa | Vence qualquer arquivo. Posse de frasco se confirma com ele antes de presumir |
| 2 | **Google Sheets "Diário de Uso — Perfumes"** | Aba **Tiers** = fonte única de tier S/A/B/C/D (decisão dele, 04/out/2026). Aba **Diário** = registro de uso (manhã M / noite N). Aba **Frascos** = último uso e contagens |
| 3 | **Arquivos do projeto (lista abaixo)** | Alocação, fichas, modelo diário, visualizações |
| 4 | Skill @perfumista | Só o fluxo. Playbook v44, "coleção fechada", "slot frio congelado", Apple Notes e nota na pele da skill estão **superados** |

## 2. Arquivos do projeto — os únicos válidos

| Arquivo | O que é |
|---|---|
| `00_LEIA_PRIMEIRO.md` | Este arquivo |
| `playbook_v59.md` | Grade por faixa × ocasião: 69 frascos, 651 alocações, Seguro / jogada / Também / sprays; custo por uso em dois slots |
| `fichas_tecnicas_v9.md` | Ficha de cada frasco: pirâmide, arquétipo, eixo, doçura, peso, Td, envelope, aptidão, sprays, janelas |
| `tabelao_v2_7.md` / `.xlsx` | Espelho da aba Tiers (336 linhas, posse + tier); xlsx com aba *Histórico* |
| `frascos_v7.py` + `modelo_diario_v1_6.py` | Modelo "Top 10 do dia" em dois slots (`python3 modelo_diario_v1_6.py --exemplo`) |
| `observatorio_colecao_v4_6.html` | Roda de arquétipos × tier, simulador por célula do playbook v59 |
| `mapa_climatico_colecao_v5.html` | Temperatura × Td × chuva, 70 frascos |
| `avaliacao_perfumes_v51_2026-10-05.html` | Base de avaliação (1.205 perfumes, pirâmides, veredictos históricos) |
| `gerador_v59.py` | Script que gera toda a cadeia v59 a partir da v58, com verificações |

**Não existem mais e não devem ser citados:** arquétipos v1.x, gaps v3.x, custo_por_uso_2slots, ranking_faixa, geradores_v5x, calibração de tiers, `claude/diario_uso.md`, `gen_v58.py` e qualquer versão anterior dos arquivos acima. O arquétipo de cada frasco está nas fichas; os gaps estão na seção 6; o custo por uso está no playbook.

## 3. Coleção

| Item | Valor |
|---|---|
| Grade | **69 frascos** — S 31 · A 26 · B 10 · C 2 (Oud Kyphi, Bleu de Chanel) |
| Fora da grade | Bedouin Rose (D, 0 janelas) |
| Camada custo | 9 frascos — **usada só em academia e corrida; ignorada em qualquer análise ou framework** (regra dele, 25/set/2026). Aparece no modelo diário só com `Extra: corrida` ou `Extra: academia` |
| Total próprio | 79 frascos (= Frasco Gui na aba Tiers) |
| Frascos de 10 ml experimentais | Oud Kyphi, Bedouin Rose, K-Musk — não tratar como frasco cheio em custo por uso ou desbaste |

## 4. Regras vigentes

| Tema | Regra |
|---|---|
| **Classificação** | Só o tier dado por ele. Âncora: S compraria de novo amanhã · A alegria real · B respeito, cumpre função · C neutro · D fora. Nota numérica, "nota na pele", remedição, preliminar e contestado **não existem** (encerrado em 19/set/2026) |
| **Rank dentro do arquétipo** | Reflete o que ele mais usa e não precisa seguir o tier. Seguros e jogadas do playbook ficam por incumbência (decisão de 25/set/2026) |
| **Coleção** | **Reaberta desde 18/set/2026.** Nada de "PASSAR por default" |
| **Avaliação de compra** | 5 gates: DNA · gap · redundância · clima/custo por uso **por slot** · performance × preço. Postura dura; teste na pele antes de comprar (anti-blind-buy) |
| **Rotina 2x/dia** | Manhã 7h00–7h30 (slot Dia, faixa pela máxima das horas restantes) e noite pós-banho 19h–20h (slot Noite, faixa pela temperatura de ~20–22h). Dois top 10 por dia. Não repetir o da manhã à noite; evitar dois densos (peso ≥4) no mesmo dia; em casa à noite −1 spray. À noite ele pode usar densos mesmo em casa — a intenção é curtir |
| **Longevidade** | O perfume do Dia **não precisa durar até a noite** (25/set/2026). Longevidade não é critério |
| **Custo por uso** | Noite Ameno/Fresco ≈ 300 noites/ano: noturno denso não reprova por clima, reprova por redundância no slot Noite e por tier. Frio/Muito Frio seguem escassos (~31 noites, ~5 dias). O gargalo é o slot Dia. Noite de calor é rara (~37/ano) |
| **Janelas decididas por ele** | **Vibrato:** só dia e trabalho (Lazer, Trab. Informal, Trab. Formal em MQ/Q/A), 9 janelas — saiu das noites em 05/out/2026. **Tygar Extrait:** noites de MQ/Q/A. **Les Sables Roses:** noites exceto as quentes (Ameno–MF). **Favonius, Omnia Omnibus Ubique, Scarlet Sands:** janelas estimadas pelo Claude pela pirâmide — não declaradas |
| **Desbaste** | Os C ficam ("têm valor em circunstâncias"). Único fora: Bedouin Rose. B redundantes só se decide com ≥90 dias de diário 2x/dia |
| **Alteração da grade** | Só por script (gerador), nunca editando célula à mão. Reabre com: mudança de tier na aba Tiers, aptidão/envelope declarado por ele, frasco novo ou saída |
| **Descrição de notas** | Sempre com fonte (Fragrantica, Parfumo, site da marca); nunca inventar pirâmide |

## 5. Diário de uso

Vive na aba **Diário** do Google Sheets (primeiro registro: 30/set/2026). Datas sempre no formato texto AAAA-MM-DD, em ordem cronológica. Colunas: Data · Slot (M/N) · Perfume (nome igual ao da coluna "Nome no diário" da aba Tiers) · Ocasião · Temp · Td · Sprays · NotaDia · Obs. Até duas linhas por dia. Nota numérica espontânea dele vai em Obs, sem virar métrica.

## 6. Gaps (status conforme observatório)

| # | Gap | Arquétipo | Status |
|---|---|---|---|
| 1 | Vetiver seco/mineral protagonista | Geólogo | aberto |
| 2 | Chypre verde aromático | Botânico | aberto |
| 3 | Tabaco dark | — | **fechado** (Montabaco Intensivo) |
| 4 | Sândalo cremoso protagonista (gap de dia/cozy) | Marceneiro | aberto — Santal 33 e Wood Whisper não fecham |
| 5 | Leather raw birch-tar | Curtidor | aberto, baixa prioridade |

## 7. Pendências abertas

| # | Pendência | Com quem |
|---|---|---|
| 1 | Onde ele usa Favonius, Omnia Omnibus Ubique e Scarlet Sands (hoje estimado) | Guilherme |
| 2 | Auditoria de posse: 13 amostras S/A que podem ser frascos — Reflection 45, Sequence, Dragon, Knight of Love, Valiant, Aventus Cologne, Blue Talisman Extrait, Lust in Paradise Extrait, Rehab, Oud Maracujá, Jazz Club, Haltane, Layton | Guilherme |
| 3 | Bracken: versão Man ou Woman | Guilherme |
| 4 | 18 linhas com posse "a confirmar" na aba Tiers (inclui Iris Debonair, 21 Conduit St, Herbes Troublantes) | Guilherme |
| 5 | Skill @perfumista ainda carrega playbook v44 e Apple Notes — o projeto vence até ela ser atualizada | — |
