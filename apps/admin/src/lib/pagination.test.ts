import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_SIZE, pageFromSearchParam, pageRange, pageSlice } from './pagination';

test('normalizes invalid page values to the first page', () => {
  assert.equal(pageFromSearchParam(undefined), 1);
  assert.equal(pageFromSearchParam('0'), 1);
  assert.equal(pageFromSearchParam('-4'), 1);
  assert.equal(pageFromSearchParam('abc'), 1);
  assert.equal(pageFromSearchParam(['3', '4']), 3);
});

test('requests one extra row and reports the next page correctly', () => {
  assert.deepEqual(pageRange(2), { from: PAGE_SIZE, to: PAGE_SIZE * 2 });
  const source = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => index);
  const page = pageSlice(source);
  assert.equal(page.rows.length, PAGE_SIZE);
  assert.equal(page.hasNextPage, true);
});
