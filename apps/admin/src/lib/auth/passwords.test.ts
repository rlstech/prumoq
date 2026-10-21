import assert from 'node:assert/strict';
import test from 'node:test';
import { changePasswordSchema, minimumPasswordSchema } from './passwords';

test('exige pelo menos oito caracteres para novas senhas', () => {
  assert.equal(minimumPasswordSchema.safeParse('1234567').success, false);
  assert.equal(minimumPasswordSchema.safeParse('12345678').success, true);
});

test('aceita troca com senha atual, nova senha e confirmação válidas', () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: 'senha-antiga',
    newPassword: 'senha-nova-segura',
    confirmation: 'senha-nova-segura',
  });

  assert.equal(result.success, true);
});

test('rejeita confirmação divergente e reutilização da senha atual', () => {
  const mismatch = changePasswordSchema.safeParse({
    currentPassword: 'senha-atual',
    newPassword: 'senha-nova',
    confirmation: 'outra-senha',
  });
  const reused = changePasswordSchema.safeParse({
    currentPassword: 'senha-repetida',
    newPassword: 'senha-repetida',
    confirmation: 'senha-repetida',
  });

  assert.equal(mismatch.success, false);
  assert.equal(reused.success, false);
});
