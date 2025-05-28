import { expect } from '@std/expect';
import { test } from '@std/testing/bdd';
import { sortByFilePath, sortByFilePathAndLine, sortByLineNumber } from './sort.ts';

type Item = { filePath: string; lineNumber?: number | null };

test('sortByFilePath: normal case', () => {
  const arr: Item[] = [{ filePath: 'b.ts' }, { filePath: 'a.ts' }, { filePath: 'c.ts' }];
  const sorted = sortByFilePath([...arr]);
  expect(sorted.map((i) => i.filePath)).toEqual(['a.ts', 'b.ts', 'c.ts']);
});

test('sortByFilePath: already sorted', () => {
  const arr: Item[] = [{ filePath: 'a.ts' }, { filePath: 'b.ts' }];
  expect(sortByFilePath([...arr])).toEqual(arr);
});

test('sortByFilePath: empty array', () => {
  expect(sortByFilePath([])).toEqual([]);
});

test('sortByLineNumber: normal case', () => {
  const arr = [{ lineNumber: 3 }, { lineNumber: 1 }, { lineNumber: 2 }, { lineNumber: null }];
  const sorted = sortByLineNumber([...arr]);
  expect(sorted.map((i) => i.lineNumber)).toEqual([null, 1, 2, 3]);
});

test('sortByLineNumber: all null', () => {
  const arr = [{ lineNumber: null }, { lineNumber: null }];
  expect(sortByLineNumber([...arr])).toEqual(arr);
});

test('sortByLineNumber: empty array', () => {
  expect(sortByLineNumber([])).toEqual([]);
});

test('sortByFilePathAndLine: normal case', () => {
  const arr = [
    { filePath: 'b.ts', lineNumber: 2 },
    { filePath: 'a.ts', lineNumber: 3 },
    { filePath: 'a.ts', lineNumber: 1 },
    { filePath: 'b.ts', lineNumber: null },
  ];
  const sorted = sortByFilePathAndLine([...arr]);
  expect(sorted).toEqual([
    { filePath: 'a.ts', lineNumber: 1 },
    { filePath: 'a.ts', lineNumber: 3 },
    { filePath: 'b.ts', lineNumber: null },
    { filePath: 'b.ts', lineNumber: 2 },
  ]);
});

test('sortByFilePathAndLine: all same filePath', () => {
  const arr = [
    { filePath: 'a.ts', lineNumber: 2 },
    { filePath: 'a.ts', lineNumber: null },
    { filePath: 'a.ts', lineNumber: 1 },
  ];
  const sorted = sortByFilePathAndLine([...arr]);
  expect(sorted).toEqual([
    { filePath: 'a.ts', lineNumber: null },
    { filePath: 'a.ts', lineNumber: 1 },
    { filePath: 'a.ts', lineNumber: 2 },
  ]);
});

test('sortByFilePathAndLine: empty array', () => {
  expect(sortByFilePathAndLine([])).toEqual([]);
});
