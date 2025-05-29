import { expect } from '@std/expect';
import { test } from '@std/testing/bdd';
import { type CommentBase, type GroupedComment, type RawComment, convertToCommentBase, groupCommentsByLocation } from './group.ts';

test('convertToCommentBase: normal case', () => {
  const input: Record<string, RawComment[]> = {
    'a.ts': [
      { message: 'm1', line_number: 1 },
      { message: 'm2', suggestion: 's2' },
    ],
    'b.ts': [{ message: 'm3', line_number: null, suggestion: 's3' }],
  };
  const result = convertToCommentBase(input);
  expect(result).toEqual([
    { filePath: 'a.ts', lineNumber: 1, message: 'm1' },
    { filePath: 'a.ts', lineNumber: null, message: 'm2', suggestion: 's2' },
    { filePath: 'b.ts', lineNumber: null, message: 'm3', suggestion: 's3' },
  ]);
});

test('convertToCommentBase: empty input', () => {
  expect(convertToCommentBase({})).toEqual([]);
});

test('convertToCommentBase: line_number=0', () => {
  const input: Record<string, RawComment[]> = {
    'foo.ts': [{ message: 'zero', line_number: 0 }],
  };
  // 0は falsy なので null になる
  expect(convertToCommentBase(input)).toEqual([{ filePath: 'foo.ts', lineNumber: null, message: 'zero' }]);
});

test('groupCommentsByLocation: group by file and line', () => {
  const comments: CommentBase[] = [
    { filePath: 'a.ts', lineNumber: 1, message: 'm1' },
    { filePath: 'a.ts', lineNumber: 1, message: 'm2', suggestion: 's2' },
    { filePath: 'a.ts', lineNumber: 2, message: 'm3' },
    { filePath: 'b.ts', lineNumber: null, message: 'm4' },
  ];
  const grouped = groupCommentsByLocation(comments);
  expect(grouped.length).toBe(3);
  expect(grouped).toContainEqual({
    filePath: 'a.ts',
    lineNumber: 1,
    comments: [
      { message: 'm1', suggestion: undefined },
      { message: 'm2', suggestion: 's2' },
    ],
  });
  expect(grouped).toContainEqual({
    filePath: 'a.ts',
    lineNumber: 2,
    comments: [{ message: 'm3', suggestion: undefined }],
  });
  expect(grouped).toContainEqual({
    filePath: 'b.ts',
    lineNumber: null,
    comments: [{ message: 'm4', suggestion: undefined }],
  });
});

test('groupCommentsByLocation: empty', () => {
  expect(groupCommentsByLocation([])).toEqual([]);
});

test('groupCommentsByLocation: all unique', () => {
  const comments: CommentBase[] = [
    { filePath: 'a.ts', lineNumber: 1, message: 'm1' },
    { filePath: 'a.ts', lineNumber: 2, message: 'm2' },
    { filePath: 'b.ts', lineNumber: 3, message: 'm3' },
  ];
  const grouped = groupCommentsByLocation(comments);
  expect(grouped.length).toBe(3);
});
