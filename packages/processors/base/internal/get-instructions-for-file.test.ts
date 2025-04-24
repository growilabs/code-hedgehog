import { assertEquals } from "@std/assert";
import { test } from "@std/testing/bdd";
import type { ReviewConfig } from '../deps.ts';
import { DEFAULT_CONFIG } from '../deps.ts';
import { matchesGlobPattern } from './matches-glob-pattern.ts';
import { getInstructionsForFile } from './get-instructions-for-file.ts';

test("空の設定の場合、空文字列を返すこと", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [],
  };
  assertEquals(getInstructionsForFile("test.ts", config), "");
});

test("設定がundefinedの場合、空文字列を返すこと", () => {
  assertEquals(getInstructionsForFile("test.ts", undefined), "");
});

test("パターンにマッチしないファイルの場合、空文字列を返すこと", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [
      { path: "*.js", instructions: "Check JavaScript" },
    ],
  };
  assertEquals(getInstructionsForFile("test.ts", config), "");
});

test("単一パターンにマッチする場合、対応する指示を返すこと", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [
      { path: "*.ts", instructions: "Check TypeScript" },
    ],
  };
  assertEquals(getInstructionsForFile("test.ts", config), "Check TypeScript");
});

test("複数パターンにマッチする場合、具体性の高い順に指示を結合すること", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [
      { path: "*.ts", instructions: "Check TypeScript" },
      { path: "src/*.ts", instructions: "Check source TypeScript" },
      { path: "src/test.ts", instructions: "Check specific file" },
    ],
  };
  const expected = "Check specific file\n\nCheck source TypeScript\n\nCheck TypeScript";
  assertEquals(getInstructionsForFile("src/test.ts", config), expected);
});

test("同じ具体性の場合、設定ファイル内の順序を維持すること", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [
      { path: "src/*.ts", instructions: "First instruction" },
      { path: "src/*.ts", instructions: "Second instruction" },
    ],
  };
  const expected = "First instruction\n\nSecond instruction";
  assertEquals(getInstructionsForFile("src/test.ts", config), expected);
});

test("エラーが発生した場合、空文字列を返すこと", () => {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    file_path_instructions: [
      { path: "*", instructions: "Test" },
    ],
  };
  
  // matchesGlobPattern をモックしてエラーを発生させる
  const originalMatchFn = matchesGlobPattern;
  try {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).__testMatchesGlobPattern = () => {
      throw new Error("Test error");
    };
    assertEquals(getInstructionsForFile("test.ts", config), "");
  } finally {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).__testMatchesGlobPattern = originalMatchFn;
  }
});