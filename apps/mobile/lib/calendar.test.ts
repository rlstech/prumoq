import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDate,
  getMonthDays,
  getTodayIso,
  isDateWithinRange,
  isIsoDate,
  monthFromIso,
  shiftMonth,
} from './calendar';

test('valida datas ISO e preserva a data sem conversão de fuso horário', () => {
  assert.equal(isIsoDate('2026-02-29'), false);
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(formatDate('2026-08-23'), '23/08/2026');
  assert.equal(getTodayIso(new Date(2026, 7, 23, 22, 30)), '2026-08-23');
});

test('gera a grade do mês com o dia correto da semana', () => {
  const august = getMonthDays({ year: 2026, month: 7 });
  assert.equal(august.length, 42);
  assert.equal(august[6]?.iso, '2026-08-01');
  assert.equal(august[28]?.iso, '2026-08-23');
});

test('navega entre meses e aplica os limites informados', () => {
  assert.deepEqual(shiftMonth(monthFromIso('2026-01-15'), -1), { year: 2025, month: 11 });
  assert.equal(isDateWithinRange('2026-08-23', '2026-08-01', '2026-08-31'), true);
  assert.equal(isDateWithinRange('2026-09-01', '2026-08-01', '2026-08-31'), false);
});
