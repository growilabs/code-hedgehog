import { expect } from '@std/expect';
// deno-lint-ignore-file no-explicit-any
import { test } from '@std/testing/bdd';
import { createHorizontalBatches, createVerticalBatches } from './batch.ts';

test('createHorizontalBatches: normal case', () => {
  const result = createHorizontalBatches([1, 2, 3, 4, 5], 2);
  expect(result, 'should split into batches of 2').toEqual([[1, 2], [3, 4], [5]]);
});

test('createHorizontalBatches: batchSize > array length', () => {
  const result = createHorizontalBatches([1, 2], 5);
  expect(result, 'should return single batch').toEqual([[1, 2]]);
});

test('createHorizontalBatches: batchSize = 1', () => {
  const result = createHorizontalBatches([1, 2, 3], 1);
  expect(result, 'should split into single-element batches').toEqual([[1], [2], [3]]);
});

test('createHorizontalBatches: empty array', () => {
  const result = createHorizontalBatches([], 3);
  expect(result, 'should return empty array').toEqual([]);
});

test('createVerticalBatches: normal case', () => {
  const result = createVerticalBatches([1, 2, 3, 4, 5, 6], 3);
  expect(result, 'should group vertically').toEqual([
    [1, 3, 5],
    [2, 4, 6],
  ]);
});

test('createVerticalBatches: batchSize > array length', () => {
  const result = createVerticalBatches([1, 2], 5);
  expect(result, 'should group all elements in one batch').toEqual([[1, 2]]);
});

test('createVerticalBatches: batchSize = 1', () => {
  const result = createVerticalBatches([1, 2, 3], 1);
  expect(result, 'should return each element as a batch').toEqual([[1], [2], [3]]);
});

test('createVerticalBatches: empty array', () => {
  const result = createVerticalBatches([], 3);
  expect(result, 'should return empty array').toEqual([]);
});
