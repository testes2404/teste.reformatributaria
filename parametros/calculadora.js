// parametros/calculadora.js
// Regras da planilha (PF x PJ pós-reforma) + payback com ITBI (3%) + honorários R$ 25.000

export function derivarAliquotas({ receitaMensal = 0, valorImovel = 0, numeroImoveis = 1 }) {
  const R = Number(receitaMensal || 0);
  const imoveis = Math.max(1, Number(numeroImoveis || 1));

  // PF
  const deducaoPF = Math.min(R * 0.20, 607.20);
  const basePF = Math.max(0, R - deducaoPF);
  const irpf = calcularIRPF(basePF);

  // IBS/CBS PF com redutor social
  const redutor = redutorSocial(R, imoveis);
  const ibsPf = redutor.eligivel ? Math.max(0, (R - redutor.valor) * 0.084) : 0;

  // PJ
  const lucroPresumido = R * 0.32;
  const irpj = (lucroPresumido * 0.15) + adicionalIRPJ(lucroPresumido);
  const csll = 0.0288 * R;
  const ibsBase = redutor.eligivel ? Math.max(0, (R - redutor.valor) * 0.084) : 0;
  const ibsPj = Math.max(0, ibsBase - 425.04); // crédito fixo

  const totalPJ = irpj + csll + ibsPj;

  // Percentuais efetivos visuais
  const irPfPctEff = R > 0 ? (irpf / R) * 100 : 0;
  const ibsPctEff  = R > 0 ? ((redutor.eligivel ? (R - redutor.valor) * 0.084 : 0) / R) * 100 : 0;
  const pjAliqEff  = R > 0 ? (totalPJ / R) * 100 : 0;

  return {
    irPfPct: round2(irPfPctEff),
    ibsPct: round2(ibsPctEff),
    pjAliqTotalPct: round2(pjAliqEff),
  };
}

export function calcularViabilidade(params) {
  const {
    receitaMensal = 0,
    valorImovel = 0,
    numeroImoveis = 1,
    descontosPct = 0, // caso use
  } = params || {};

  let R = Number(receitaMensal || 0);
  const imoveis = Math.max(1, Number(numeroImoveis || 1));
  const V = Math.max(0, Number(valorImovel || 0));
  const desc = Math.max(0, Number(descontosPct || 0));

  // aplica descontos percentuais (ex.: vacância/condomínio) se informados
  if (desc > 0 && desc < 90) {
    R = R * (1 - desc/100);
  }

  // ===== PF =====
  const deducaoPF = Math.min(R * 0.20, 607.20);
  const basePF = Math.max(0, R - deducaoPF);
  const irpf = calcularIRPF(basePF);

  const redutor = redutorSocial(R, imoveis);
  const ibsPf = redutor.eligivel ? Math.max(0, (R - redutor.valor) * 0.084) : 0;

  const totalPF = irpf + ibsPf;
  const pfLiquido = Math.max(0, R - totalPF);

  // ===== PJ =====
  const lucroPresumido = R * 0.32;
  const irpj = (lucroPresumido * 0.15) + adicionalIRPJ(lucroPresumido); // +10% sobre excedente de 20k no LP
  const csll = 0.0288 * R;

  const ibsBase = redutor.eligivel ? Math.max(0, (R - redutor.valor) * 0.084) : 0;
  const ibsPj = Math.max(0, ibsBase - 425.04);

  const totalPJ = irpj + csll + ibsPj;
  const pjLiquido = Math.max(0, R - totalPJ);

  // ===== Payback: ITBI + honorários fixos =====
  const itbi = V * 0.03;
  const honorariosImplant = 25000;
  const custoImplantacao = itbi + honorariosImplant;

  const economiaMensal = Math.max(0, pjLiquido - pfLiquido);
  const paybackMeses = economiaMensal > 0 ? (custoImplantacao / economiaMensal) : Infinity;

  // ===== Score =====
  const score = calcularScore(economiaMensal, paybackMeses, R);
  const recomendacao = gerarMensagemRecomendacao(economiaMensal, paybackMeses);

  return {
    pf: {
      liquidoMensal: round2(pfLiquido),
      impostos: round2(totalPF),
      irpf: round2(irpf),
      ibs: round2(ibsPf),
    },
    pj: {
      liquidoMensal: round2(pjLiquido),
      impostos: round2(totalPJ),
      irpj: round2(irpj),
      csll: round2(csll),
      ibs: round2(ibsPj),
    },
    economiaMensal: round2(economiaMensal),
    score,
    recomendacao,
    paybackMeses,
    custos: {
      implantacao: round2(custoImplantacao),
      itbi: round2(itbi),
      honorarios: honorariosImplant,
      redutorSocial: {
        elegivel: redutor.eligivel,
        valor: redutor.valor,
      },
    },
  };
}

// ---------- Helpers ----------

function adicionalIRPJ(lucroPresumidoMensal) {
  // adicional de 10% sobre o que excede 20.000 de lucro presumido mensal
  if (lucroPresumidoMensal <= 20000) return 0;
  return (lucroPresumidoMensal - 20000) * 0.10;
}

function redutorSocial(receitaMensal, numeroImoveis) {
  const Rm = Number(receitaMensal || 0);
  const anual = Rm * 12;
  // Elegível se (imóveis > 3 && anual > 240k) OU (anual > 280k)
  const elegivel =
    ((numeroImoveis > 3) && (anual > 240000)) ||
    (anual > 280000);

  const valor = elegivel ? (numeroImoveis * 600) : 0;
  return { elegivel, valor };
}

function calcularIRPF(base) {
  // Tabela 2024 (mensal) usada na planilha
  const b = Number(base || 0);
  if (b <= 2428.80) return 0;
  if (b <= 2826.65) return b * 0.075 - 182.16;
  if (b <= 3751.05) return b * 0.15 - 394.16;
  if (b <= 4664.68) return b * 0.225 - 675.49;
  return b * 0.275 - 908.73;
}

function calcularScore(economiaMensal, paybackMeses, receitaMensal) {
  if (economiaMensal <= 0) return 10;

  let s = 50;

  // economia relativa à receita
  const ratio = receitaMensal > 0 ? economiaMensal / receitaMensal : 0;
  s += Math.min(40, Math.max(0, ratio * 100 * 0.6)); // até +40

  // payback
  if (paybackMeses < 6) s += 35;
  else if (paybackMeses < 12) s += 25;
  else if (paybackMeses < 24) s += 10;

  return Math.max(5, Math.min(100, Math.round(s)));
}

function gerarMensagemRecomendacao(economiaMensal, paybackMeses) {
  if (economiaMensal <= 0) {
    return "No cenário informado, a holding não se paga: a economia mensal é nula ou negativa. Reavalie valores/lotes.";
  }
  if (paybackMeses === Infinity) {
    return "A holding gera economia, mas não é possível estimar payback com os dados atuais.";
  }
  if (paybackMeses <= 6) {
    return "Excelente viabilidade: payback curto e economia robusta. Vale avançar para a modelagem e execução.";
  }
  if (paybackMeses <= 12) {
    return "Viabilidade boa: payback em até 12 meses. Recomenda-se seguir com estruturação com ajustes finos.";
  }
  if (paybackMeses <= 24) {
    return "Viabilidade moderada: avalie negociar custos e otimizar aluguéis para reduzir o payback.";
  }
  return "Viabilidade baixa: payback longo. Reavalie custos (ITBI/honorários) e alternativas contratuais.";
}

function round2(x) {
  return Math.round(Number(x || 0) * 100) / 100;
}
