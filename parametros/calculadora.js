// parametros/calculadora.js
// Regras simplificadas com base em faixas típicas da Reforma 2025.
// Ajuste as faixas/percentuais conforme a versão final da lei.

export function derivarAliquotas({ receitaMensal = 0, valorImovel = 0 }) {
  // ---- IR PF progressivo (faixas ilustrativas) ----
  let irPfPct = 0;
  const r = receitaMensal;
  if      (r <= 2112)     irPfPct = 0;
  else if (r <= 2826.65)  irPfPct = 7.5;
  else if (r <= 3751.05)  irPfPct = 15;
  else if (r <= 4664.68)  irPfPct = 22.5;
  else                    irPfPct = 27.5;

  // ---- IBS/CBS (faixa por valor do imóvel; placeholders) ----
  let ibsPct = 0;
  if      (valorImovel <= 300000)  ibsPct = 0.50;    // locação residencial popular – alíquota reduzida (exemplo)
  else if (valorImovel <= 700000)  ibsPct = 1.00;
  else if (valorImovel <= 1500000) ibsPct = 2.00;
  else                             ibsPct = 3.00;

  // ---- PJ (IRPJ+CSLL+ISS/IBS/CBS efetivo médio para holding de locação; placeholder) ----
  let pjAliqTotalPct = 11.33; // Simples/Presumido médio; ajuste conforme cenários.

  return { irPfPct, ibsPct, pjAliqTotalPct };
}

export function calcularViabilidade(params) {
  const {
    receitaMensal = 0,
    descontosPct = 0,
    irPfPct = 0,
    ibsPct = 0,
    pjAliqTotalPct = 0,
    honorariosMensais = 0,
    manutencaoAnual = 0,
    custoImplantacao = 0,
    outrasDespesasPJ = 0
  } = params || {};

  const receitaLiquidaBase = receitaMensal * (1 - (descontosPct/100));

  // PF: IR sobre a receita líquida (aprox.; ajuste conforme regra final de deduções)
  const irPfValor   = receitaLiquidaBase * (irPfPct/100);
  const pfLiquido   = Math.max(0, receitaLiquidaBase - irPfValor);

  // PJ: tributos efetivos + custos fixos mensais
  const tribPJ      = receitaLiquidaBase * (pjAliqTotalPct/100);
  const ibsValor    = receitaLiquidaBase * (ibsPct/100);
  const pjLiquido   = Math.max(0, receitaLiquidaBase - tribPJ - ibsValor - honorariosMensais - outrasDespesasPJ);

  const economiaMensal = Math.max(0, pjLiquido - pfLiquido); // se PJ > PF, economia é positiva

  // Payback: custo de implantação / economia mensal (desconsidera manutenção anual aqui;
  // a manutenção já está sendo abatida no fluxo mensal via honorários/ outras, e a anual pode ser considerada
  // no primeiro ano como (manutencaoAnual/12) se desejar. Mantemos simples:
  const ecoMensalAposManut = Math.max(0, economiaMensal - (manutencaoAnual/12));
  const paybackMeses = ecoMensalAposManut > 0 ? (custoImplantacao / ecoMensalAposManut) : Infinity;

  // Score simples de viabilidade
  let score = 0;
  if (ecoMensalAposManut <= 0) score = 0;
  else if (paybackMeses <= 12) score = 90;
  else if (paybackMeses <= 24) score = 70;
  else if (paybackMeses <= 36) score = 50;
  else score = 25;

  const recomendacao =
    score >= 80 ? "Alta viabilidade: considere avançar para estruturação da holding."
  : score >= 60 ? "Viável com bons indícios: refine premissas e avalie timing."
  : score >= 40 ? "Viabilidade moderada: ajuste custos/tributos e reavalie."
                : "Inviável no cenário atual: reveja receita, custos ou regime tributário.";

  return {
    pf: { liquidoMensal: pfLiquido, irValor: irPfValor },
    pj: { liquidoMensal: pjLiquido, tributos: tribPJ + ibsValor, custosFixos: honorariosMensais + outrasDespesasPJ },
    economiaMensal,
    paybackMeses,
    score: Math.round(score),
    recomendacao
  };
}
