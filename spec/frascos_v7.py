# -*- coding: utf-8 -*-
"""
frascos_v7.py — base de dados dos 79 frascos para o modelo diário (v7, 05/out/2026)

v7: só limpeza de cabeçalho e comentários. Nenhum dado muda vs v6. Tiers conferidos com a aba Tiers do Google Sheets
"Diário de Uso — Perfumes" (fonte única de tier desde 04/out/2026). Janelas = playbook v59 (651; Vibrato 9, só dia,
desde 05/out/2026). A camada custo (9) fica aqui só para o modelo sugerir quando a entrada traz "Extra: corrida" ou
"Extra: academia" — fora de qualquer análise da coleção (regra dele, 25/set/2026).

Fontes, por campo:
  MAPA  (n, casa, arq, tier, td, peso, doc, env_hot, env_cold, custo, chuva, sem_piramide)
        = array DATA do mapa climático (v4, 25/set/2026), derivado das fichas técnicas.
        chuva = índice hipótese do Claude (nota a nota sobre a pirâmide), não dado medido.
  FICHA (conc, eixo, aptidão, sprays_base, janelas)
        = transcritos das fichas_tecnicas_v9.md (grade 69 + Bedouin Rose + camada custo 9).
        Validação embutida: 79 frascos · Td grade C21/S25/N24 · janelas = 651.
  NOVO  (longevidade_h, projecao, curva)
        = ESTIMATIVA derivada por regra (concentração × peso × doçura) + overrides onde a
        Leitura da ficha traz dado (beast, projeção íntima, relatos de horas). Nada aqui é
        medição. Ajustar frasco a frasco conforme o uso — o campo existe para o
        modelo ter em que se apoiar, não para afirmar performance.

Envelope: índice de faixa 0=Muito Quente (>32) · 1=Quente (27–32) · 2=Ameno (22–27)
          3=Fresco (17–22) · 4=Frio (12–17) · 5=Muito Frio (<12). env_hot = faixa mais quente,
          env_cold = faixa mais fria que o frasco aceita.
"""

FAIXAS = ["Muito Quente", "Quente", "Ameno", "Fresco", "Frio", "Muito Frio"]
FAIXA_LIM = [(32, 38), (27, 32), (22, 27), (17, 22), (12, 17), (6, 12)]  # (lo, hi) em °C

MAPA = [
 {"n":"1872 for Men","casa":"Clive Christian","arq":"Barbeiro","t":"S","td":"C","p":2,"d":0,"a":0,"b":2,"c":0,"r":0.27,"u":0},
 {"n":"7 Loewe","casa":"Loewe","arq":"Monge","t":"B","td":"N","p":2,"d":0,"a":1,"b":3,"c":0,"r":0.67,"u":0},
 {"n":"African Leather","casa":"Memo Paris","arq":"Curtidor","t":"S","td":"S","p":4,"d":1,"a":2,"b":5,"c":0,"r":0.32,"u":0},
 {"n":"Al Qurashi Blend","casa":"Abdul Samad Al Qurashi","arq":"Sultão","t":"A","td":"N","p":3,"d":1,"a":1,"b":3,"c":0,"r":0.0,"u":0},
 {"n":"Amyris Homme Extrait","casa":"MFK","arq":"Lareira","t":"S","td":"N","p":3,"d":2,"a":2,"b":5,"c":0,"r":0.19,"u":0},
 {"n":"Anelo","casa":"Pernoire","arq":"Chiprista","t":"A","td":"C","p":2,"d":1,"a":0,"b":2,"c":0,"r":-0.83,"u":0},
 {"n":"Ani X","casa":"Nishane","arq":"Lareira","t":"A","td":"N","p":3,"d":2,"a":1,"b":3,"c":0,"r":-0.61,"u":0},
 {"n":"Apotecário","casa":"Granado","arq":"Curtidor","t":"B","td":"S","p":4,"d":1,"a":3,"b":5,"c":0,"r":1.21,"u":0},
 {"n":"Aventus","casa":"Creed","arq":"Chiprista","t":"A","td":"N","p":3,"d":1,"a":0,"b":3,"c":0,"r":0.14,"u":0},
 {"n":"Aventus Absolu","casa":"Creed","arq":"Chiprista","t":"S","td":"N","p":3,"d":1,"a":1,"b":5,"c":0,"r":0.11,"u":0},
 {"n":"Beach Hut Man","casa":"Amouage","arq":"Botânico","t":"A","td":"C","p":2,"d":0,"a":0,"b":4,"c":0,"r":1.66,"u":0},
 {"n":"Bedouin Rose","casa":"BYNOMADS","arq":"Rosal","t":"D","td":"S","p":4,"d":2,"a":3,"b":5,"c":0,"r":0.88,"u":0},
 {"n":"Bijou Zafran","casa":"Ormonde Jayne","arq":"Curtidor","t":"S","td":"S","p":3,"d":1,"a":2,"b":5,"c":0,"r":1.21,"u":0},
 {"n":"Black Saffron Absolu","casa":"Byredo","arq":"Curtidor","t":"A","td":"N","p":3,"d":1,"a":2,"b":4,"c":0,"r":0.75,"u":0},
 {"n":"Bleu de Chanel","casa":"Chanel","arq":"Mediterrâneo","t":"C","td":"C","p":2,"d":0,"a":0,"b":2,"c":0,"r":-0.11,"u":0},
 {"n":"Blonde Amber","casa":"Clive Christian","arq":"Lareira","t":"S","td":"S","p":4,"d":2,"a":3,"b":5,"c":0,"r":1.08,"u":0},
 {"n":"Blue Talisman","casa":"Ex Nihilo","arq":"Mediterrâneo","t":"A","td":"C","p":2,"d":1,"a":0,"b":2,"c":0,"r":0.0,"u":0},
 {"n":"Bois du Portugal","casa":"Creed","arq":"Barbeiro","t":"B","td":"N","p":3,"d":0,"a":1,"b":5,"c":0,"r":0.82,"u":0},
 {"n":"Bois Impérial","casa":"Essential Parfums","arq":"Geólogo","t":"S","td":"C","p":3,"d":0,"a":1,"b":3,"c":0,"r":0.45,"u":0},
 {"n":"Brompton","casa":"Ex Nihilo","arq":"Rosal","t":"S","td":"S","p":4,"d":2,"a":2,"b":5,"c":0,"r":0.4,"u":0},
 {"n":"Caden","casa":"Omanluxury","arq":"Lareira","t":"A","td":"S","p":5,"d":3,"a":3,"b":5,"c":0,"r":0.43,"u":0},
 {"n":"Carved Oud","casa":"Thameen","arq":"Marceneiro","t":"A","td":"S","p":4,"d":1,"a":2,"b":5,"c":0,"r":1.2,"u":0},
 {"n":"Castley","casa":"Parfums de Marly","arq":"Mediterrâneo","t":"B","td":"C","p":2,"d":1,"a":1,"b":3,"c":0,"r":-0.13,"u":0},
 {"n":"Crab Apple Blossom","casa":"Clive Christian","arq":"Marinho","t":"S","td":"C","p":1,"d":1,"a":0,"b":2,"c":0,"r":-0.63,"u":0},
 {"n":"Decision","casa":"Amouage","arq":"Monge","t":"S","td":"S","p":3,"d":1,"a":2,"b":5,"c":0,"r":1.26,"u":0},
 {"n":"Drunk Lovers","casa":"Born to Stand Out","arq":"Lareira","t":"A","td":"N","p":3,"d":2,"a":2,"b":4,"c":0,"r":0.4,"u":0},
 {"n":"Désobéissant","casa":"Givenchy","arq":"Botânico","t":"S","td":"C","p":2,"d":0,"a":0,"b":3,"c":0,"r":0.63,"u":0},
 {"n":"Favonius","casa":"Nishane","arq":"Rosal","t":"S","td":"S","p":4,"d":1,"a":2,"b":5,"c":0,"r":0.6,"u":0},
 {"n":"Gentle Fluidity Silver","casa":"MFK","arq":"Minimalista","t":"S","td":"N","p":3,"d":1,"a":1,"b":4,"c":0,"r":0.38,"u":0},
 {"n":"Grand Soir","casa":"MFK","arq":"Lareira","t":"S","td":"S","p":5,"d":2,"a":3,"b":5,"c":0,"r":0.0,"u":0},
 {"n":"Green Irish Tweed","casa":"Creed","arq":"Botânico","t":"B","td":"C","p":2,"d":0,"a":0,"b":4,"c":0,"r":0.57,"u":0},
 {"n":"Gris Charnel","casa":"BDK","arq":"Marceneiro","t":"S","td":"N","p":4,"d":2,"a":2,"b":5,"c":0,"r":1.2,"u":0},
 {"n":"Hacivat","casa":"Nishane","arq":"Chiprista","t":"S","td":"N","p":3,"d":1,"a":0,"b":3,"c":0,"r":0.18,"u":0},
 {"n":"Himalaya","casa":"Creed","arq":"Geólogo","t":"B","td":"C","p":2,"d":0,"a":0,"b":2,"c":0,"r":0.0,"u":0},
 {"n":"Imagination","casa":"Louis Vuitton","arq":"Mediterrâneo","t":"S","td":"C","p":3,"d":0,"a":0,"b":3,"c":0,"r":0.3,"u":0},
 {"n":"Imperial","casa":"Boadicea","arq":"Barbeiro","t":"A","td":"S","p":4,"d":1,"a":3,"b":5,"c":0,"r":1.01,"u":0},
 {"n":"Intoxicated","casa":"By Kilian","arq":"Confeiteiro","t":"A","td":"S","p":4,"d":3,"a":3,"b":5,"c":0,"r":-0.12,"u":0},
 {"n":"K-Musk","casa":"BYNOMADS","arq":"Minimalista","t":"B","td":"C","p":2,"d":1,"a":0,"b":2,"c":0,"r":0.0,"u":0},
 {"n":"L'Immensité","casa":"Louis Vuitton","arq":"Mediterrâneo","t":"A","td":"C","p":3,"d":1,"a":0,"b":2,"c":0,"r":-0.63,"u":0},
 {"n":"Les Sables Roses","casa":"Louis Vuitton","arq":"Rosal","t":"S","td":"S","p":4,"d":1,"a":2,"b":5,"c":0,"r":0.41,"u":0},
 {"n":"Liwa","casa":"Widian","arq":"Sultão","t":"S","td":"S","p":4,"d":2,"a":2,"b":5,"c":0,"r":1.17,"u":0},
 {"n":"Lucius","casa":"Fragrance du Bois","arq":"Mediterrâneo","t":"S","td":"N","p":3,"d":1,"a":0,"b":3,"c":0,"r":0.29,"u":0},
 {"n":"Monarch","casa":"Boadicea","arq":"Sultão","t":"B","td":"S","p":4,"d":2,"a":3,"b":5,"c":0,"r":0.92,"u":0},
 {"n":"Montabaco Intensivo","casa":"Ormonde Jayne","arq":"Curtidor","t":"A","td":"S","p":3,"d":1,"a":2,"b":5,"c":0,"r":0.94,"u":0},
 {"n":"Météore","casa":"Louis Vuitton","arq":"Geólogo","t":"S","td":"C","p":2,"d":0,"a":0,"b":2,"c":0,"r":-0.13,"u":0},
 {"n":"New York","casa":"Widian","arq":"Lareira","t":"A","td":"N","p":3,"d":2,"a":1,"b":3,"c":0,"r":0.45,"u":0},
 {"n":"Odéon","casa":"Memo Paris","arq":"Rosal","t":"S","td":"N","p":3,"d":2,"a":2,"b":4,"c":0,"r":0.32,"u":0},
 {"n":"Ombre Nomade","casa":"Louis Vuitton","arq":"Sultão","t":"S","td":"S","p":5,"d":2,"a":3,"b":5,"c":0,"r":0.5,"u":0},
 {"n":"Omnia Omnibus Ubique","casa":"Memo Paris","arq":"Empoado","t":"S","td":"S","p":3,"d":2,"a":2,"b":5,"c":0,"r":0.45,"u":0},
 {"n":"Oud Kyphi","casa":"BYNOMADS","arq":"Sultão","t":"C","td":"S","p":4,"d":2,"a":3,"b":5,"c":0,"r":-0.12,"u":0},
 {"n":"Oud Satin Mood","casa":"MFK","arq":"Sultão","t":"S","td":"S","p":5,"d":3,"a":3,"b":5,"c":0,"r":0.13,"u":0},
 {"n":"Oudós Lux Solis","casa":"Nishane","arq":"Sultão","t":"A","td":"N","p":3,"d":2,"a":1,"b":4,"c":0,"r":-1.59,"u":0},
 {"n":"Outlands","casa":"Amouage","arq":"Monge","t":"S","td":"S","p":5,"d":1,"a":3,"b":5,"c":0,"r":0.46,"u":0},
 {"n":"Purpose 50","casa":"Amouage","arq":"Monge","t":"S","td":"S","p":4,"d":1,"a":2,"b":5,"c":0,"r":1.03,"u":0},
 {"n":"Radical Rose","casa":"Matière Première","arq":"Rosal","t":"S","td":"S","p":4,"d":1,"a":3,"b":5,"c":0,"r":0.16,"u":0},
 {"n":"Reflection Man","casa":"Amouage","arq":"Florista Branco","t":"S","td":"C","p":2,"d":1,"a":0,"b":3,"c":0,"r":0.87,"u":0},
 {"n":"Royal Oud","casa":"Creed","arq":"Marceneiro","t":"A","td":"N","p":3,"d":0,"a":1,"b":5,"c":0,"r":0.45,"u":0},
 {"n":"Santal 33","casa":"Le Labo","arq":"Marceneiro","t":"A","td":"N","p":3,"d":1,"a":2,"b":5,"c":0,"r":1.26,"u":0},
 {"n":"Scarlet Sands","casa":"Ex Nihilo","arq":"Florista Branco","t":"S","td":"N","p":3,"d":2,"a":1,"b":3,"c":0,"r":-0.3,"u":0},
 {"n":"Search","casa":"Amouage","arq":"Monge","t":"A","td":"N","p":3,"d":0,"a":0,"b":3,"c":0,"r":0.79,"u":0},
 {"n":"Serenity","casa":"Omanluxury","arq":"Curtidor","t":"B","td":"S","p":4,"d":2,"a":3,"b":5,"c":0,"r":0.58,"u":0},
 {"n":"Terre d'Hermès","casa":"Hermès","arq":"Geólogo","t":"A","td":"C","p":3,"d":0,"a":0,"b":3,"c":0,"r":0.67,"u":0},
 {"n":"Torino 21","casa":"Xerjoff","arq":"Botânico","t":"A","td":"C","p":1,"d":0,"a":0,"b":2,"c":0,"r":-0.45,"u":0},
 {"n":"Town & Country","casa":"Clive Christian","arq":"Mediterrâneo","t":"A","td":"C","p":2,"d":0,"a":0,"b":2,"c":0,"r":1.11,"u":0},
 {"n":"Tygar Extrait","casa":"Bvlgari (Le Gemme)","arq":"Mediterrâneo","t":"S","td":"N","p":3,"d":2,"a":0,"b":2,"c":0,"r":-0.12,"u":0},
 {"n":"Ultima Storia","casa":"Thomas de Monaco","arq":"Empoado","t":"A","td":"N","p":3,"d":1,"a":1,"b":3,"c":0,"r":0.29,"u":0},
 {"n":"Vibrato","casa":"Sospiro","arq":"Mediterrâneo","t":"A","td":"C","p":3,"d":1,"a":0,"b":2,"c":0,"r":0.43,"u":0},
 {"n":"Wild Vetiver","casa":"Creed","arq":"Geólogo","t":"A","td":"C","p":2,"d":1,"a":0,"b":3,"c":0,"r":0.45,"u":0},
 {"n":"Wood Whisper","casa":"OJAR","arq":"Marceneiro","t":"A","td":"N","p":3,"d":2,"a":2,"b":5,"c":0,"r":0.32,"u":0},
 {"n":"Ya'e","casa":"Hind Al Oud","arq":"Empoado","t":"B","td":"N","p":3,"d":1,"a":2,"b":3,"c":0,"r":0.35,"u":0},
 {"n":"Supremacy CE","casa":"Afnan","arq":"Chiprista","t":"S","td":"N","p":3,"d":1,"a":1,"b":3,"c":1,"r":0.17,"u":1},
 {"n":"Musamam Black","casa":"Lattafa","arq":"Lareira","t":"A","td":"S","p":4,"d":3,"a":3,"b":5,"c":1,"r":0.0,"u":1},
 {"n":"Aquatica","casa":"Rayhaan","arq":"Marinho","t":"B","td":"C","p":1,"d":0,"a":0,"b":1,"c":1,"r":-1.0,"u":1},
 {"n":"Incense 01","casa":"Swiss Arabian","arq":"Lareira","t":"B","td":"S","p":4,"d":3,"a":3,"b":5,"c":1,"r":1.0,"u":0},
 {"n":"Island Dreams","casa":"Khadlaj","arq":"Mediterrâneo","t":"B","td":"C","p":2,"d":1,"a":0,"b":2,"c":1,"r":-0.22,"u":0},
 {"n":"Sky","casa":"Khadlaj","arq":"Mediterrâneo","t":"A","td":"C","p":2,"d":1,"a":0,"b":2,"c":1,"r":0.0,"u":0},
 {"n":"Belgravia","casa":"Maison Asrar","arq":"Mediterrâneo","t":"A","td":"C","p":2,"d":1,"a":1,"b":3,"c":1,"r":0.6,"u":0},
 {"n":"Inception","casa":"Mykonos","arq":"Mediterrâneo","t":"S","td":"C","p":3,"d":0,"a":0,"b":3,"c":1,"r":0.14,"u":0},
 {"n":"Dubai Musk","casa":"Al Ambra","arq":"Minimalista","t":"A","td":"N","p":2,"d":1,"a":0,"b":3,"c":1,"r":0.0,"u":0},
]

# FICHA: nome -> (concentração, eixo, aptidão "Ocasião n · ...", sprays_base, janelas)
# Ocasiões: Lazer · T.Inf · T.For · N.Inf · N.For · Cozy D · Cozy N (ausente = não aloca)
FICHA = {
 "1872 for Men": ("Parfum ~20%", "F", "Lazer 2 · T.Inf 3 · T.For 2 · N.Inf 1", 4, 12),
 "7 Loewe": ("EDT", "P", "Lazer 2 · T.Inf 3 · T.For 1 · N.Inf 2", 4, 6),
 "African Leather": ("EDP", "P", "Lazer 1 · T.Inf 2 · T.For 1 · N.Inf 2 · N.For 1 · Cozy D 2 · Cozy N 3", 3, 12),
 "Al Qurashi Blend": ("EDP", "S", "Lazer 1 · N.Inf 2 · N.For 2", 3, 9),
 "Amyris Homme Extrait": ("Extrait", "S", "T.Inf 1 · N.Inf 2 · N.For 2 · Cozy D 2 · Cozy N 3", 3, 12),
 "Anelo": ("Extrait 30%", "F", "Lazer 3 · T.Inf 2 · N.Inf 2", 3, 9),
 "Ani X": ("Extrait", "S", "Lazer 2 · T.Inf 1 · N.Inf 3 · Cozy D 2", 3, 9),
 "Apotecário": ("EDP", "P", "T.Inf 2 · N.Inf 2 · Cozy N 2", 3, 6),
 "Aventus": ("EDP", "F", "Lazer 3 · T.Inf 3 · N.Inf 3 · N.For 1", 3, 9),
 "Aventus Absolu": ("EDP", "F", "Lazer 2 · T.Inf 1 · N.Inf 3 · N.For 3", 3, 12),
 "Beach Hut Man": ("EDP", "P", "Lazer 3 · T.Inf 3", 3, 9),
 "Bedouin Rose": ("n/d", "S", "N.Inf 2 · N.For 2 · Cozy N 2", 3, 0),
 "Bijou Zafran": ("EDP", "P", "T.Inf 1 · N.Inf 3 · N.For 1 · Cozy N 3", 3, 12),
 "Black Saffron Absolu": ("Absolu de Parfum", "P", "T.Inf 1 · N.Inf 3 · Cozy D 2 · Cozy N 2", 3, 9),
 "Bleu de Chanel": ("EDP", "F", "T.Inf 3 · T.For 2 · N.Inf 2", 4, 3),
 "Blonde Amber": ("EDP", "S", "N.Inf 2 · N.For 2 · Cozy D 3 · Cozy N 3", 4, 12),
 "Blue Talisman": ("EDP", "F", "Lazer 3 · T.Inf 3 · N.Inf 2", 4, 9),
 "Bois du Portugal": ("EDT", "F", "T.For 3 · N.For 3", 4, 6),
 "Bois Impérial": ("EDP", "P", "Lazer 1 · T.Inf 3 · T.For 3 · N.Inf 1", 3, 12),
 "Brompton": ("Extrait", "S", "N.Inf 3 · N.For 3 · Cozy D 2 · Cozy N 2", 2, 12),
 "Caden": ("EDP", "S", "N.Inf 3 · N.For 1 · Cozy D 3 · Cozy N 3", 3, 9),
 "Carved Oud": ("Extrait", "P", "T.Inf 2 · T.For 3 · N.Inf 2 · N.For 2", 3, 9),
 "Castley": ("EDP", "F", "Lazer 2 · T.Inf 3 · T.For 2 · N.Inf 2", 3, 6),
 "Crab Apple Blossom": ("EDP", "F", "Lazer 3 · T.Inf 2 · N.Inf 1", 4, 9),
 "Decision": ("EDP", "P", "T.Inf 3 · T.For 3 · N.Inf 2 · N.For 2", 3, 12),
 "Drunk Lovers": ("EDP", "S", "Lazer 2 · N.Inf 3 · Cozy D 2 · Cozy N 2", 3, 9),
 "Désobéissant": ("EDP", "P", "Lazer 3 · T.Inf 3 · T.For 2 · N.Inf 2", 6, 12),
 "Favonius": ("Extrait", "P", "T.For 2 · N.Inf 3 · N.For 3", 3, 12),
 "Gentle Fluidity Silver": ("EDP", "S", "Lazer 3 · T.Inf 3 · T.For 1 · N.Inf 2 · Cozy D 3", 4, 12),
 "Grand Soir": ("EDP", "S", "N.Inf 3 · N.For 2 · Cozy D 3 · Cozy N 3", 3, 12),
 "Green Irish Tweed": ("EDT", "P", "Lazer 3 · T.Inf 3", 4, 6),
 "Gris Charnel": ("Extrait", "S", "Lazer 2 · T.Inf 2 · N.Inf 1 · Cozy D 3 · Cozy N 2", 4, 12),
 "Hacivat": ("Extrait", "F", "Lazer 3 · T.Inf 2 · N.Inf 3 · N.For 1", 3, 12),
 "Himalaya": ("EDT", "P", "Lazer 2 · T.Inf 3 · T.For 2", 4, 6),
 "Imagination": ("EDP", "P", "Lazer 2 · T.Inf 3 · T.For 3 · N.Inf 3 · N.For 2", 3, 12),
 "Imperial": ("EDP", "F", "T.For 3 · N.Inf 2 · N.For 3", 3, 9),
 "Intoxicated": ("EDP", "F", "N.Inf 1 · Cozy D 2 · Cozy N 2", 3, 9),
 "K-Musk": ("n/d", "F", "Lazer 2 · T.Inf 3 · Cozy D 2", 4, 6),
 "L'Immensité": ("EDP", "F", "Lazer 3 · T.Inf 3 · T.For 2 · N.Inf 2", 4, 9),
 "Les Sables Roses": ("EDP", "S", "N.Inf 3 · N.For 3 · Cozy N 2", 3, 12),
 "Liwa": ("EDP", "S", "N.Inf 2 · N.For 2 · Cozy N 2", 3, 12),
 "Lucius": ("Extrait", "P", "T.Inf 2 · T.For 3 · N.Inf 3 · N.For 3 · Cozy D 1", 3, 12),
 "Monarch": ("EDP", "S", "Lazer 1 · T.Inf 1 · N.Inf 2 · N.For 2", 3, 6),
 "Montabaco Intensivo": ("EDP (Intensivo 42%)", "P", "Lazer 2 · T.Inf 3 · T.For 3 · N.Inf 2", 3, 9),
 "Météore": ("EDP", "P", "Lazer 2 · T.Inf 3 · T.For 3 · N.For 2", 3, 12),
 "New York": ("EDP", "S", "Lazer 2 · N.Inf 3 · Cozy D 2 · Cozy N 2", 3, 9),
 "Odéon": ("EDP", "S", "N.Inf 2 · Cozy D 3 · Cozy N 3", 3, 9),
 "Ombre Nomade": ("EDP", "S", "T.For 1 · N.Inf 3 · N.For 3 · Cozy N 2", 2, 12),
 "Omnia Omnibus Ubique": ("EDP", "S", "N.Inf 3 · N.For 2 · Cozy N 2", 3, 12),
 "Oud Kyphi": ("n/d", "S", "N.Inf 2 · N.For 2 · Cozy N 1", 3, 3),
 "Oud Satin Mood": ("Extrait", "S", "N.Inf 2 · N.For 3 · Cozy N 3", 2, 9),
 "Oudós Lux Solis": ("Extrait", "S", "Lazer 2 · N.Inf 3 · N.For 1", 3, 9),
 "Outlands": ("EDP", "P", "Lazer 2 · T.For 2 · N.Inf 3 · N.For 3 · Cozy N 2", 3, 12),
 "Purpose 50": ("Extrait 50%", "P", "T.Inf 1 · T.For 3 · N.Inf 2 · N.For 3", 2, 12),
 "Radical Rose": ("Extrait", "S", "T.For 2 · N.Inf 3 · N.For 3", 3, 9),
 "Reflection Man": ("EDP", "F", "Lazer 2 · T.Inf 3 · T.For 2 · N.For 2", 4, 12),
 "Royal Oud": ("EDP", "P", "T.Inf 1 · T.For 3 · N.For 3", 3, 9),
 "Santal 33": ("EDP", "P", "Lazer 3 · T.Inf 3 · Cozy D 2", 3, 9),
 "Scarlet Sands": ("EDP", "F", "Lazer 2 · N.Inf 3 · N.For 2", 3, 9),
 "Search": ("EDP", "P", "Lazer 2 · T.Inf 3 · T.For 3 · N.Inf 2", 4, 9),
 "Serenity": ("EDP", "S", "N.Inf 2 · N.For 3 · Cozy N 3", 3, 6),
 "Terre d'Hermès": ("Parfum", "P", "T.Inf 2 · T.For 3 · N.For 3", 3, 9),
 "Torino 21": ("EDP", "P", "Lazer 3 · T.Inf 3 · N.Inf 1", 4, 9),
 "Town & Country": ("EDP", "P", "Lazer 1 · T.Inf 2 · T.For 3 · N.Inf 3 · N.For 3", 3, 9),
 "Tygar Extrait": ("Extrait", "F", "N.Inf 3 · N.For 3", 2, 6),
 "Ultima Storia": ("Extrait", "P", "T.Inf 2 · T.For 3 · N.Inf 2 · N.For 3", 3, 9),
 "Vibrato": ("EDP", "F", "Lazer 3 · T.Inf 3 · T.For 2", 2, 9),   # sai das noites por decisão dele (05/out/2026)
 "Wild Vetiver": ("EDT", "P", "Lazer 3 · T.Inf 3 · T.For 2", 4, 9),
 "Wood Whisper": ("EDP", "S", "Lazer 1 · T.Inf 3 · Cozy D 3 · Cozy N 2", 3, 9),
 "Ya'e": ("EDP", "F", "T.Inf 3 · T.For 2 · N.Inf 2 · Cozy D 2", 3, 6),
 # camada custo (janelas = None: fora da grade)
 "Supremacy CE": ("EDP", "F", "Lazer 3 · N.Inf 2", 3, None),
 "Musamam Black": ("EDP", "S", "N.Inf 2 · Cozy N 3", 3, None),
 "Aquatica": ("EDP", "F", "Lazer 3", 4, None),
 "Incense 01": ("Extrait", "S", "Cozy D 2 · Cozy N 3", 3, None),
 "Island Dreams": ("Extrait", "F", "Lazer 3 · T.Inf 2", 4, None),
 "Sky": ("EDP", "F", "Lazer 3 · T.Inf 2", 4, None),
 "Belgravia": ("EDP", "F", "Lazer 3 · T.Inf 2 · N.Inf 1", 4, None),
 "Inception": ("Extrait", "P", "Lazer 2 · T.Inf 3 · N.Inf 3", 3, None),
 "Dubai Musk": ("Extrait", "F", "Lazer 2 · T.Inf 3 · Cozy D 2", 3, None),
}

# NOVO — overrides de performance com lastro na Leitura da ficha (ou no relato dele).
# Formato: nome -> (longevidade_h, projecao_1a5, curva S/L/F) ; None = manter regra.
# S = saída manda (vive da primeira hora) · L = linear · F = fundo manda (o drydown é o ponto)
OVERRIDE_PERF = {
 "1872 for Men": (5, 2, "S"),       # "performance é o ponto fraco documentado"
 "Désobéissant": (6, 1, "L"),       # "projeção íntima (~6h)"
 "Beach Hut Man": (10, 4, "L"),     # "beast 10+ hours"
 "Ani X": (11, 3, "F"),             # "relatos 10–12h"
 "Vibrato": (10, 5, "L"),           # "beast"; teto 3 sprays, 2 em escritório
 "Amyris Homme Extrait": (9, 2, "F"),  # "projeção educada"
 "Tygar Extrait": (10, 4, "L"),     # extrait Le Gemme; teto 3 sprays — estimativa
 "Ombre Nomade": (14, 5, "F"),      # "nuclear"; 2 sprays
 "Les Sables Roses": (9, 3, "F"),   # relatos: forte 8–10h+, projeção que assenta — estimativa
 "Search": (7, 2, "F"),             # "cítrico some em 30–45 min, sobra incenso"
 "Ultima Storia": (8, 2, "L"),      # "extrait discreto"
 "Hacivat": (9, 4, "L"),            # extrait de projeção alta — estimativa
 "Liwa": (10, 4, "F"),              # DNA BR540/OFG — estimativa
 "Purpose 50": (12, 4, "F"),        # extrait 50%, "2 no ameno"
 "Oud Satin Mood": (12, 4, "F"),    # extrait; 2 sprays
 "Brompton": (12, 4, "F"),          # extrait; "começar em 2 sprays"
}

OCASIOES = ["Lazer", "T.Inf", "T.For", "N.Inf", "N.For", "Cozy D", "Cozy N"]


def _is_extrait(conc):
    c = conc.lower()
    return any(k in c for k in ("extrait", "parfum", "absolu", "intensivo"))


def perf_por_regra(conc, peso, doc):
    """Estimativa por regra: (longevidade_h, projecao, curva)."""
    c = conc.lower()
    if "edt" in c:
        L, P = (6 if peso <= 2 else 7), (2 if peso <= 2 else 3)
    elif _is_extrait(conc):
        L, P = {1: 6, 2: 7, 3: 9, 4: 11, 5: 12}[peso], {1: 2, 2: 2, 3: 3, 4: 3, 5: 4}[peso]
    else:  # EDP e n/d
        L, P = {1: 5, 2: 6, 3: 8, 4: 10, 5: 12}[peso], {1: 2, 2: 2, 3: 3, 4: 3, 5: 4}[peso]
    if peso <= 2 and doc <= 1:
        curva = "S"
    elif peso >= 4 or doc >= 2:
        curva = "F"
    else:
        curva = "L"
    return L, P, curva


def parse_aptidao(s):
    apt = {}
    for part in s.split("·"):
        part = part.strip()
        if not part:
            continue
        nome, n = part.rsplit(" ", 1)
        apt[nome.strip()] = int(n)
    return apt


def carregar():
    """Devolve lista de dicts com todos os campos, validada."""
    frascos = []
    for m in MAPA:
        f = FICHA[m["n"]]
        conc, eixo, apt_s, sprays, janelas = f
        L, P, curva = perf_por_regra(conc, m["p"], m["d"])
        origem = "regra"
        if m["n"] in OVERRIDE_PERF:
            L, P, curva = OVERRIDE_PERF[m["n"]]
            origem = "leitura"
        lo = FAIXA_LIM[m["b"]][0]
        hi = FAIXA_LIM[m["a"]][1]
        # ideal térmico: centro do envelope deslocado 0,5 faixa p/ frio por ponto de peso > 3 (mapa v1)
        ideal = 34.5 - 5 * ((m["a"] + m["b"]) / 2 + 0.5 * (m["p"] - 3))
        ideal = max(7.5, min(36.5, ideal))
        frascos.append({
            "nome": m["n"], "casa": m["casa"], "arq": m["arq"], "tier": m["t"], "td": m["td"],
            "peso": m["p"], "doc": m["d"], "env_hot": m["a"], "env_cold": m["b"],
            "env_lo": lo, "env_hi": hi, "ideal": ideal,
            "custo": bool(m["c"]), "chuva": m["r"], "sem_piramide": bool(m["u"]),
            "conc": conc, "eixo": eixo, "apt": parse_aptidao(apt_s), "sprays_base": sprays,
            "janelas": janelas, "longev": L, "proj": P, "curva": curva, "perf_origem": origem,
            "edt": "edt" in conc.lower(),
        })
    # validações
    assert len(frascos) == 79, len(frascos)
    grade = [f for f in frascos if not f["custo"]]
    assert len(grade) == 70
    td_cnt = {k: sum(1 for f in grade if f["td"] == k) for k in "CSN"}
    assert td_cnt == {"C": 21, "S": 25, "N": 24}, td_cnt
    assert sum(f["janelas"] or 0 for f in grade) == 651, sum(f["janelas"] or 0 for f in grade)
    tiers = {k: sum(1 for f in frascos if f["tier"] == k) for k in "SABCD"}
    assert tiers == {"S": 33, "A": 30, "B": 13, "C": 2, "D": 1}, tiers
    return frascos


if __name__ == "__main__":
    fr = carregar()
    print("OK — 79 frascos · Td grade C21/S25/N24 · janelas 651 · tiers", {k: sum(1 for f in fr if f['tier']==k) for k in 'SABCD'})
    print("perf por leitura:", sum(1 for f in fr if f["perf_origem"] == "leitura"), "· por regra:", sum(1 for f in fr if f["perf_origem"] == "regra"))
