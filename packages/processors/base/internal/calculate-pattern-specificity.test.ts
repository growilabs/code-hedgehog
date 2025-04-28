import { expect } from '@std/expect';
import { test } from '@std/testing/bdd';
import { calculatePatternSpecificity } from './calculate-pattern-specificity.ts';

test('calculatePatternSpecificity: 基本的なパス', () => {
  const pattern = 'src/utils/helper.ts';
  const expectedSpecificity = pattern.length + 5; // 長さ + 拡張子ボーナス
  expect(calculatePatternSpecificity(pattern), '基本的なパスの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: 単純なワイルドカード', () => {
  const pattern = 'src/*/helper.ts';
  const expectedSpecificity = pattern.length + 5 - 2; // 長さ + 拡張子 - ワイルドカードペナルティ
  expect(calculatePatternSpecificity(pattern), '単純なワイルドカードの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: ダブルワイルドカード', () => {
  const pattern = 'src/**/helper.ts';
  const expectedSpecificity = pattern.length + 5 - 3; // 長さ + 拡張子 - ダブルワイルドカードペナルティ
  expect(calculatePatternSpecificity(pattern), 'ダブルワイルドカードの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: 複数のワイルドカード', () => {
  const pattern = 'src/**/test/*.test.ts';
  const expectedSpecificity = pattern.length + 5 - 3 - 2; // 長さ + 拡張子 - ダブルワイルドカード - ワイルドカード
  expect(calculatePatternSpecificity(pattern), '複数のワイルドカードの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: 拡張子なし', () => {
  const pattern = 'src/utils/helper';
  const expectedSpecificity = pattern.length; // 長さのみ
  expect(calculatePatternSpecificity(pattern), '拡張子なしの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: 拡張子グループ', () => {
  const pattern = 'src/components/*.{js,ts}';
  const expectedSpecificity = pattern.length + 5 + 3 - 2; // 長さ + 拡張子 + グループボーナス - ワイルドカード
  expect(calculatePatternSpecificity(pattern), '拡張子グループの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: ルートレベルのワイルドカード', () => {
  const pattern = '*.ts';
  const expectedSpecificity = pattern.length + 5 - 2; // 長さ + 拡張子 - ワイルドカード
  expect(calculatePatternSpecificity(pattern), 'ルートレベルワイルドカードの具体性').toBe(expectedSpecificity);
});

test('calculatePatternSpecificity: 複雑なパターン', () => {
  const pattern = 'packages/**/{mod,deps}.ts';
  const expectedSpecificity = pattern.length + 5 + 3 - 3; // 長さ + 拡張子 + グループ - ダブルワイルドカード
  expect(calculatePatternSpecificity(pattern), '複雑なパターンの具体性').toBe(expectedSpecificity);
});
