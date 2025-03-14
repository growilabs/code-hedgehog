import { spy } from 'https://deno.land/std@0.218.0/testing/mock.ts';

// スパイ関数を作成
export const debug = spy((message: string) => {
  console.log(`::debug::${message}`);
});

export const error = spy((message: string) => {
  console.log(`::error::${message}`);
});

export const warning = spy((message: string) => {
  console.log(`::warning::${message}`);
});

// スパイをリセットする関数
export function resetSpies(): void {
  debug.calls.splice(0, debug.calls.length);
  error.calls.splice(0, error.calls.length);
  warning.calls.splice(0, warning.calls.length);
}
