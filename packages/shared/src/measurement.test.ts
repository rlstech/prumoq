import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAvailable, calculateContractorTransfer, calculateMeasurementValue, cumulativeDelta, hasExactStageWeights, validateApprovedProgress } from './measurement';

test('calcula somente a diferença acumulada disponível', () => {
  assert.equal(calculateAvailable('500', '350', '50'), '100');
  assert.equal(calculateAvailable('350', '200', '0'), '150');
});

test('não produz saldo negativo e preserva precisão decimal', () => {
  assert.equal(calculateAvailable('1.5', '2', '0'), '0');
  assert.equal(calculateAvailable('2.75', '1.5', '0'), '1.25');
  assert.equal(calculateMeasurementValue('12.5', '10.4'), '130');
});

test('pesos de etapas exigem 100%', () => {
  assert.equal(hasExactStageWeights(['16.6667', '16.6667', '16.6667', '16.6667', '16.6667', '16.6665']), true);
  assert.equal(hasExactStageWeights(['50', '49.9999']), false);
});

test('aprovações semanais acumuladas liberam somente a diferença', () => {
  assert.equal(cumulativeDelta('0', '200'), '200');
  assert.equal(cumulativeDelta('200', '350'), '150');
  assert.equal(cumulativeDelta('350', '500'), '150');
  assert.throws(() => cumulativeDelta('350', '349.999'), /não pode ser reduzido/);
});

test('avanço aprovado respeita execução, escopo e etapa binária', () => {
  assert.equal(validateApprovedProgress({ previousExecuted:'200',previousApproved:'200',executed:'350',approved:'351',assignedScope:'1000',partialAllowed:true }), 'O avanço aprovado não pode superar o executado.');
  assert.equal(validateApprovedProgress({ previousExecuted:'200',previousApproved:'200',executed:'1001',approved:'500',assignedScope:'1000',partialAllowed:true }), 'O avanço não pode superar o escopo atribuído.');
  assert.equal(validateApprovedProgress({ previousExecuted:'0',previousApproved:'0',executed:'50',approved:'50',assignedScope:'100',partialAllowed:false }), 'Etapa binária exige aprovação integral.');
  assert.equal(validateApprovedProgress({ previousExecuted:'0',previousApproved:'0',executed:'100',approved:'100',assignedScope:'100',partialAllowed:false }), null);
});

test('troca de empreiteiro preserva crédito anterior e transfere apenas o não executado', () => {
  assert.deepEqual(calculateContractorTransfer({ assignedScope:'1000',executed:'450',approved:'450',measured:'300' }), {
    previousApprovedBalance: '150',
    newContractorScope: '550',
  });
  assert.throws(() => calculateContractorTransfer({ assignedScope:'1000',executed:'450',approved:'450',measured:'451' }), /inválido/);
});
