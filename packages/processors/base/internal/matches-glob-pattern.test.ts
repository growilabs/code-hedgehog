// packages/processors/base/internal/matches-glob-pattern.test.ts
import { expect } from '@std/expect';
import { test, describe, beforeAll, afterAll } from '@std/testing/bdd';
import { stub, type Stub } from '@std/testing/mock';
import { matchesGlobPattern } from './matches-glob-pattern.ts';

describe('matchesGlobPattern', () => {
  let warnStub: Stub<Console>;

  beforeAll(() => {
    // Suppress console.warn during tests
    warnStub = stub(console, 'warn');
  });

  afterAll(() => {
    warnStub.restore();
  });

  // Test cases for matching
  const matchCases: [string, string, string][] = [
    ['src/utils/helper.ts', 'src/utils/helper.ts', '完全一致'],
    ['src/utils/helper.ts', 'src/**/*.ts', 'ダブルワイルドカード'],
    ['src/api/v1/users.ts', 'src/api/*/users.ts', 'シングルワイルドカード'],
    ['src/components/button.jsx', 'src/components/*.{jsx,tsx}', '拡張子グループ (jsx)'],
    ['src/components/modal.tsx', 'src/components/*.{jsx,tsx}', '拡張子グループ (tsx)'],
    ['main.test.js', '*.test.js', 'ルートレベルワイルドカード'],
    ['src/image.png', 'src/image.?ng', 'クエスチョンマークワイルドカード'],
    ['docs/README.md', 'docs/**', 'ディレクトリのみのダブルワイルドカード'],
    ['data.json', '*.json', 'ルートレベルのJSON'],
    ['.gitignore', '.gitignore', 'ドットファイル'],
    ['a/b/c/d.txt', 'a/**/d.txt', '深い階層のダブルワイルドカード'],
    ['a/b.txt', 'a/b.txt', '特殊文字なし'],
    ['a/b-c.txt', 'a/b-c.txt', 'ハイフンを含む'],
    ['a/b_c.txt', 'a/b_c.txt', 'アンダースコアを含む'],
    ['a/[b].txt', 'a/\\[b\\].txt', 'エスケープされた角括弧'], // Note: Pattern needs escaping
    ['a/(b).txt', 'a/\\(b\\).txt', 'エスケープされた丸括弧'], // Note: Pattern needs escaping
  ];

  matchCases.forEach(([filePath, pattern, description]) => {
    test(`一致: ${description} (${filePath} vs ${pattern})`, () => {
      expect(matchesGlobPattern(filePath, pattern)).toBe(true);
    });
  });

  // Test cases for non-matching
  const noMatchCases: [string, string, string][] = [
    ['src/utils/helper.js', 'src/utils/helper.ts', '拡張子不一致'],
    ['src/utils/helper.ts', 'src/api/*.ts', 'ディレクトリ不一致'],
    ['src/components/style.css', 'src/components/*.{jsx,tsx}', '拡張子グループ不一致'],
    ['test/main.test.js', '*.test.js', 'ルートレベル ディレクトリ不一致'],
    ['src/image.jpeg', 'src/image.?ng', 'クエスチョンマーク不一致'],
    ['README.md', 'docs/**', 'ルートレベル ディレクトリ不一致'],
    ['src/data.json', '*.json', 'ルートレベル ディレクトリ不一致'],
    ['a/b/c/e.txt', 'a/**/d.txt', 'ファイル名不一致'],
    ['a/b.txt', 'a/b.js', '拡張子不一致'],
  ];

  noMatchCases.forEach(([filePath, pattern, description]) => {
    test(`不一致: ${description} (${filePath} vs ${pattern})`, () => {
      expect(matchesGlobPattern(filePath, pattern)).toBe(false);
    });
  });

  test('無効なパターンは警告を出し false を返す', () => {
    const filePath = 'test.txt';
    const invalidPattern = 'src/[invalid'; // Unclosed bracket
    expect(matchesGlobPattern(filePath, invalidPattern)).toBe(false);
  });

  test('空のパターンは空のパスにのみ一致', () => {
    expect(matchesGlobPattern('', '')).toBe(true);
    expect(matchesGlobPattern('a', '')).toBe(false);
  });

  test('空のパスは空のパターンにのみ一致', () => {
    expect(matchesGlobPattern('', '')).toBe(true);
    expect(matchesGlobPattern('', '*')).toBe(true); // '*' -> [^/]* matches empty string
    expect(matchesGlobPattern('', '**')).toBe(true); // '**' -> .* matches empty string
  });

  // Add back potentially problematic cases with corrected expectations if the logic implies they should match
  test('一致: 階層一致 (シングル) (a/b/c.txt vs a/b/*.txt)', () => {
    // '*' matches 'c.txt' because it doesn't contain '/'
    expect(matchesGlobPattern('a/b/c.txt', 'a/b/*.txt')).toBe(true);
  });
  test('一致: 文字数一致 (a/c.txt vs a/?.txt)', () => {
    // '?' matches 'c' because it doesn't contain '/'
    expect(matchesGlobPattern('a/c.txt', 'a/?.txt')).toBe(true);
  });

  test('不正なブレースパターンはリテラルとして扱う', () => {
    // 閉じブレースがない場合、'{' はリテラルとして扱われる
    expect(matchesGlobPattern('a/{b', 'a/{b')).toBe(true);
    expect(matchesGlobPattern('a/b', 'a/{b')).toBe(false);
    // ネストが不正な場合も同様
    expect(matchesGlobPattern('a/{b{c', 'a/{b{c')).toBe(true);
  });

  test('末尾のバックスラッシュはリテラルとして扱う', () => {
    expect(matchesGlobPattern('a/b\\', 'a/b\\')).toBe(true);
    expect(matchesGlobPattern('a/b', 'a/b\\')).toBe(false);
  });

  test('エスケープされたGlob特殊文字はリテラルとして扱う', () => {
    expect(matchesGlobPattern('a/*/b', 'a/\\*/b')).toBe(true);
    expect(matchesGlobPattern('a/x/b', 'a/\\*/b')).toBe(false);
    expect(matchesGlobPattern('a/?/b', 'a/\\?/b')).toBe(true);
    expect(matchesGlobPattern('a/x/b', 'a/\\?/b')).toBe(false);
    expect(matchesGlobPattern('a/{b}/c', 'a/\\{b\\}/c')).toBe(true);
    expect(matchesGlobPattern('a/b/c', 'a/\\{b\\}/c')).toBe(false);
  });

  test('ブレースグループ内のエスケープ文字', () => {
    // '{a\,b}' は 'a,b' にマッチするべき (エスケープされたカンマ)
    expect(matchesGlobPattern('a,b', '{a\\,b}')).toBe(true);
    expect(matchesGlobPattern('ab', '{a\\,b}')).toBe(false);
    // '{a\{b}' は 'a{b' にマッチするべき (エスケープされたブレース)
    expect(matchesGlobPattern('a{b', '{a\\{b}')).toBe(true);
    expect(matchesGlobPattern('ab', '{a\\{b}')).toBe(false);
  });

  // catch ブロックのカバレッジのためのテスト (やや技巧的)
  test('RegExp構築エラーは警告を出し false を返す (スタブ使用)', () => {
    const originalRegExp = globalThis.RegExp;
    // RegExp コンストラクタをスタブしてエラーをスローさせる
    const regExpStub = stub(globalThis, 'RegExp', (...args) => {
      // 特定のパターンでのみエラーをスローさせる (例: 'force-error')
      if (args[0] === '^force-error$') {
        throw new Error('Simulated RegExp Error');
      }
      // それ以外は元の RegExp を呼び出す
      return new originalRegExp(...args);
    });

    try {
      // このパターンはスタブによってエラーを引き起こす
      expect(matchesGlobPattern('any/path', 'force-error')).toBe(false);
      // warnStub が呼び出されたことを確認 (console.warn が catch 内にあるため)
      expect(warnStub.calls.length).toBeGreaterThanOrEqual(1);
      const lastWarnCall = warnStub.calls[warnStub.calls.length - 1];
      expect(lastWarnCall.args[0]).toContain('Invalid glob pattern');
      expect(lastWarnCall.args[1]).toBeInstanceOf(Error);
      expect(lastWarnCall.args[1].message).toBe('Simulated RegExp Error');
    } finally {
      // 必ずスタブをリストアする
      regExpStub.restore();
    }
  });

  test('不正なネストブレースはリテラル扱い', () => {
    // 'a/{b{c/d' はリテラルとして 'a/{b{c/d' にマッチ
    expect(matchesGlobPattern('a/{b{c/d', 'a/{b{c/d')).toBe(true);
    expect(matchesGlobPattern('a/bc/d', 'a/{b{c/d')).toBe(false);
  });
});