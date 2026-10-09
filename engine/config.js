// config.js — bloco CFG idêntico ao de spec/modelo_diario_v1_6.py. Não alterar sem pedido explícito:
// a paridade com o Python (tests/paridade.test.js) quebra se qualquer número aqui mudar.

export const CFG = Object.freeze({
  passo_h: 0.5,
  w_clima: 0.55, w_ctx: 0.45,
  w_td: 0.12,
  w_chuva: 0.04,
  w_fechado: 0.30,
  doce_calor: 0.08,
  tier_mult: { S: 1.00, A: 0.88, B: 0.70, C: 0.50 },
  rot: [[1, 0.60], [3, 0.80], [7, 0.92], [44, 1.00], [1e6, 1.06]],
  adaptacao: 0.92,
  intent_boost: 1.12, intent_pen: 0.95,
  presenca_viva: 0.45,
  corte_quente_h: 2.0,
  corte_frio_h: 5.0,
  corte_apt0_h: 2.0,
  corte_frac_slot: 0.5,
  ac_td_banda: "seco",
  ac_td_fator: 0.5,
  ac_T: 23.0,
  casa_inercia: 0.30,
  aplico_default: 7.25, noite_default: 19.5, tiro_default: 23.0,
  residuo_denso: 0.90,
  casa_menos1: true,
  top_n: 10, custo_n: 3,
});

export const FAIXAS = ["Muito Quente", "Quente", "Ameno", "Fresco", "Frio", "Muito Frio"];
export const FAIXAS_CURTAS = ["MQ", "Q", "A", "F", "Fr", "MF"];
export const OCASIOES = ["Lazer", "T.Inf", "T.For", "N.Inf", "N.For", "Cozy D", "Cozy N"];
export const OCAS_ALIAS = {
  lazer: "Lazer", l: "Lazer", ti: "T.Inf", "trab.informal": "T.Inf", trabalho: "T.Inf",
  tf: "T.For", "trab.formal": "T.For", ni: "N.Inf", "noite.informal": "N.Inf", noite: "N.Inf",
  nf: "N.For", "noite.formal": "N.For", cd: "Cozy D", "cozy.dia": "Cozy D",
  cn: "Cozy N", "cozy.noite": "Cozy N",
};
export const ESCUROS = new Set(["Sultão", "Monge", "Lareira", "Curtidor", "Rosal", "Marceneiro"]);
export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
