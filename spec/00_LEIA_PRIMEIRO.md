# 00 — LEIA PRIMEIRO · fonte de verdade do projeto (23/out/2026 · cadeia v60)

> Vale para toda conversa deste projeto, inclusive quando a skill @perfumista for acionada. Este arquivo só traz **regras vigentes** — o histórico de cada decisão está nos próprios arquivos (seção *Histórico*) e não deve ser usado como regra.

## 1. Hierarquia de fontes

| Ordem | Fonte | Para quê |
|---|---|---|
| 1 | **Fala do Guilherme** na conversa | Vence qualquer arquivo. Posse de frasco se confirma com ele antes de presumir |
| 2 | **Google Sheets "Diário de Uso — Perfumes"** | Aba **Tiers** = fonte única de tier S/A/B/C/D (decisão dele, 04/out/2026). Aba **Diário** = registro de uso (slots M / N / E). Aba **Frascos** = último uso e contagens |
| 3 | **Arquivos do projeto (lista abaixo)** | Alocação, fichas, modelo diário, visualizações |
| 4 | Skill @perfumista (roteador) | Só o fluxo; aponta sempre para a versão mais alta de cada arquivo do projeto |

## 2. Arquivos do projeto — os únicos válidos

| Arquivo | O que é |
|---|---|
| `00_LEIA_PRIMEIRO.md` | Este arquivo |
| `playbook_v60.md` | Grade por faixa × ocasião: 71 frascos, 668 alocações, Seguro / jogada / Também / sprays; custo por uso em dois slots |
| `fichas_tecnicas_v10.md` | Ficha de cada frasco: pirâmide, arquétipo, eixo, doçura, peso, Td, envelope, aptidão, sprays, janelas |
| `tabelao_v2_9.md` / `.xlsx` | Espelho da aba Tiers (362 linhas, posse + tier); xlsx com aba *Histórico* |
| `frascos_v8.py` + `modelo_diario_v1_7.py` | Modelo "Top 10 do dia" em dois slots (`python3 modelo_diario_v1_7.py --exemplo`) |
| `observatorio_colecao_v4_8.html` | Roda de arquétipos × tier, simulador por célula do playbook v60 |
| `mapa_climatico_colecao_v6.html` | Temperatura × Td × chuva, 71 frascos |
| `avaliacao_perfumes_v52_2026-10-23.html` | Base de avaliação (1.207 perfumes, pirâmides, veredictos históricos) |
| `gerador_v60.py` | Script que gera toda a cadeia v60 a partir da v59 + snapshot da aba Tiers, com verificações |

**Não existem mais e não devem ser citados:** qualquer versão anterior dos arquivos acima (playbook v59, fichas v9, tabelão v2.7 e v2.8, frascos_v7, modelo v1.6, observatório v4.6/v4.7, mapa v5, avaliação v51, gerador_v59), arquétipos v1.x, gaps v3.x, custo_por_uso_2slots, ranking_faixa, `claude/diario_uso.md`. O arquétipo de cada frasco está nas fichas; os gaps estão na seção 6; o custo por uso está no playbook.

## 3. Coleção

| Item | Valor |
|---|---|
| Grade | **71 frascos** — S 32 · A 26 · B 10 · C 3 (Oud Kyphi, Bleu de Chanel, Bedouin Rose) |
| Camada custo | 11 frascos (Enigma of Taif, A, entrou em 23/out/2026; fora do motor até a próxima geração) — **usada só em academia e corrida; ignorada em qualquer análise ou framework** (regra dele, 25/set/2026). Aparece no modelo diário só com `Extra: corrida` ou `Extra: academia`. No diário, slot **E** |
| Total próprio | 82 frascos (= Frasco Gui na aba Tiers) |
| Frascos de 10 ml experimentais | Oud Kyphi, Bedouin Rose, K-Musk — não tratar como frasco cheio em custo por uso ou desbaste |

## 4. Regras vigentes

| Tema | Regra |
|---|---|
| **Classificação** | Só o tier dado por ele. Âncora: S compraria de novo amanhã · A alegria real · B respeito, cumpre função · C neutro · D fora. Nota numérica de perfume, "nota na pele", remedição, preliminar e contestado **não existem** (encerrado em 19/set/2026) |
| **Rank dentro do arquétipo** | Reflete o que ele mais usa e não precisa seguir o tier. Seguros e jogadas do playbook ficam por incumbência (decisão de 25/set/2026) |
| **Coleção** | **Reaberta desde 18/set/2026.** Nada de "PASSAR por default" |
| **Avaliação de compra** | 5 gates: DNA · gap · redundância · clima/custo por uso **por slot** · performance × preço. Postura dura; teste na pele antes de comprar (anti-blind-buy). **Doçura não reprova no gate de DNA** (fala dele, 18/out/2026: "não tenho mais essa demanda de reprovação de doce") — pesam gap, slot e redundância |
| **Rotina 2x/dia** | Manhã 7h00–7h30 (slot Dia, faixa pela máxima das horas restantes) e noite pós-banho 19h–20h (slot Noite, faixa pela temperatura de ~20–22h). Dois top 10 por dia. Não repetir o da manhã à noite; evitar dois densos (peso ≥4) no mesmo dia; em casa à noite −1 spray. À noite ele pode usar densos mesmo em casa — a intenção é curtir |
| **Longevidade** | O perfume do Dia **não precisa durar até a noite** (25/set/2026). Longevidade não é critério |
| **Custo por uso** | Noite Ameno/Fresco ≈ 300 noites/ano: noturno denso não reprova por clima, reprova por redundância no slot Noite e por tier. Frio/Muito Frio seguem escassos (~31 noites, ~5 dias). O gargalo é o slot Dia. Noite de calor é rara (~37/ano) |
| **Janelas decididas por ele** | **Vibrato:** só dia e trabalho (Lazer, Trab. Informal, Trab. Formal em MQ/Q/A), 9 janelas. **Tygar Extrait:** noites de MQ/Q/A. **Les Sables Roses:** noites exceto as quentes (Ameno–MF). **Bedouin Rose:** C na grade (23/out/2026) — só Cozy Noite no Frio/MF |
| **Janelas decididas pelo Claude a pedido dele** (23/out/2026, Fragrantica/Parfumo/marca — estimativa, não uso declarado) | **Favonius:** só noite Ameno–MF (N.Inf · N.For · Cozy N). **Omnia Omnibus Ubique:** só noite Ameno–MF (N.For e Cozy N 3, N.Inf 2). **Scarlet Sands:** Quente–Frio, Lazer + noites. **Blue Sapphire Supercharged:** noites Ameno–MF para sair + Lazer/Cozy N no Fresco/Frio. O diário confirma ou derruba |
| **Desbaste** | Os C ficam ("têm valor em circunstâncias"). B redundantes só se decide com ≥90 dias de diário 2x/dia |
| **Alteração da grade** | Só por script (gerador), nunca editando célula à mão. Reabre com: mudança de tier na aba Tiers, aptidão/envelope declarado por ele, frasco novo ou saída |
| **Descrição de notas** | Sempre com fonte (Fragrantica, Parfumo, site da marca); nunca inventar pirâmide |

## 5. Diário de uso

Vive na aba **Diário** do Google Sheets (primeiro registro: 19/set/2026). Coluna Data sempre em **texto** `AAAA-MM-DD`, em ordem cronológica (formatar a coluna A como texto simples — senão o Sheets converte em número serial). Colunas: Data · Slot · Perfume (nome igual ao da coluna "Nome no diário" da aba Tiers) · Ocasião · Temp · Td · Sprays · NotaDia · Obs.

| Campo | Regra |
|---|---|
| **Slot** | **M** = manhã (slot Dia) · **N** = noite pós-banho (slot Noite) · **E** = Esporte (camada custo, corrida/academia; decisão dele, 23/out/2026). Segunda aplicação no mesmo slot = nova linha com o mesmo slot e Obs "2ª aplicação" (não existe `N2`) |
| **NotaDia** | **Acerto do dia, 1–5** (decisão dele, 23/out/2026): o quanto aquele perfume serviu àquele dia/slot (clima, ocasião, humor). 5 acertou em cheio · 4 bom · 3 ok · 2 errado para o dia · 1 não repetir nessa condição. **Não é nota do perfume** — tier continua sendo a única régua de gosto. Uso: calibrar janelas do playbook (2–3 repetidos numa faixa/slot tiram o frasco da célula) e alimentar o desbaste de B redundantes. Não retroativa |

## 6. Gaps (status conforme observatório)

| # | Gap | Arquétipo | Status |
|---|---|---|---|
| 1 | Vetiver seco/mineral protagonista | Geólogo | aberto |
| 2 | Chypre verde aromático | Botânico | aberto |
| 3 | Tabaco dark | — | **fechado** (Montabaco Intensivo) |
| 4 | Sândalo cremoso protagonista (gap de dia/cozy) | Marceneiro | aberto — Santal 33 e Wood Whisper não fecham |
| 5 | Leather raw birch-tar | Curtidor | aberto, baixa prioridade |

**Território saturado (não é gap, é alerta):** rosa-oud / Rosal — 7 frascos na grade, 6 S. Compra de rosa-oriental parte de redundância alta no gate 3.

## 7. Pendências abertas

| # | Pendência | Com quem |
|---|---|---|
| 1 | Validar no diário (NotaDia) as janelas de Favonius, Omnia Omnibus Ubique, Scarlet Sands e Blue Sapphire Supercharged — decididas pelo Claude em 23/out/2026 | Guilherme, pelo uso |
| 2 | Divisão do arquétipo Mediterrâneo em Mediterrâneo + Solar (Imagination, Lucius, Tygar Extrait), pedida em 05/out/2026: não propagada a fichas, mapa e observatório | Guilherme decide se segue |
| 3 | Sem tier, ainda a dar: Amouage Enclave, Vinegia 21, Demon Dancer, Raw Gold, Spirit of Kings Honor, Vetiveria (todas Amostra) | Guilherme |
| 4 | Confirmar nomes: Spirit of Kings "Honoro" (na marca só existe Honor) e Raw Gold EDP ou Extrait | Guilherme |
| 5 | Enigma of Taif (camada custo) entra em fichas e `frascos_v*` só na próxima rodada do gerador | Claude, na próxima regeração |
