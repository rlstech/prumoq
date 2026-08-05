import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNcFinancialDeclaration } from './nc-finance';

test('declaração financeira de NC exige os campos da situação escolhida', () => {
  assert.equal(validateNcFinancialDeclaration(null), 'Declare a situação financeira da não conformidade.');
  assert.equal(validateNcFinancialDeclaration({ situacao: 'sem_impacto', bloqueio: 'nao', justificativaSemImpacto: 'Sem custo', valorConfirmado: '0' }), null);
  assert.equal(validateNcFinancialDeclaration({ situacao: 'em_avaliacao', bloqueio: 'nao' }), 'Impacto em avaliação exige responsável e prazo.');
  assert.equal(validateNcFinancialDeclaration({ situacao: 'confirmado', bloqueio: 'parcial', valorConfirmado: '10', responsavelFinanceiro: 'empreiteiro', categoria: 'outro' }), 'Bloqueio parcial exige quantidade ou percentual positivo.');
  assert.equal(validateNcFinancialDeclaration({ situacao: 'sem_impacto', bloqueio: 'nao', justificativaSemImpacto: '', valorConfirmado: '0' }), 'Sem impacto exige justificativa e valor zero.');
  assert.equal(validateNcFinancialDeclaration({ situacao: 'estimado', bloqueio: 'nao', valorEstimado: '0', responsavelFinanceiro: 'construtora', categoria: 'atraso' }), 'Informe valor positivo, responsável e categoria financeira.');
  assert.equal(validateNcFinancialDeclaration({ situacao: 'confirmado', bloqueio: 'parcial', valorConfirmado: '100', responsavelFinanceiro: 'empreiteiro', categoria: 'mao_obra_retrabalho', quantidadeBloqueada: '5' }), null);
});
