import { assertEquals } from '@std/assert';
import { test } from '@std/testing/bdd';
import { assertSpyCall, spy } from '@std/testing/mock';
import type { IFileChange } from '../../core/mod.ts';
import { OpenaiProcessor } from './processor.ts';

const mockApiKey = 'test-api-key';
const mockPrInfo = {
  title: 'Test PR',
  body: 'Test PR description',
  baseBranch: 'main',
  headBranch: 'feature',
};

// OpenAI API のリクエストパラメータ型
type OpenAIRequest = {
  messages: { role: string; content: string }[];
  model: string;
  response_format: { type: string };
  temperature: number;
};

test('OpenaiProcessor processes review comments correctly', async () => {
  const processor = new OpenaiProcessor(mockApiKey);
  const mockCreate = spy((params: OpenAIRequest) =>
    Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              comments: [
                {
                  message: 'This could be improved',
                  severity: 'warning',
                  category: 'maintainability',
                  suggestion: 'Consider using const',
                  line_number: 10,
                },
              ],
              summary: 'Overall good quality',
            }),
          },
        },
      ],
    }),
  );

  // @ts-ignore: モックのため
  processor.openai = { chat: { completions: { create: mockCreate } } };

  const result = await processor.process(mockPrInfo, [
    {
      path: 'test.ts',
      patch: 'test patch',
      changes: 1,
      status: 'modified',
    },
  ]);

  assertEquals(result.comments?.length, 2); // インラインコメントとサマリー
  const inlineComment = result.comments?.find((c) => c.type === 'inline');
  const summaryComment = result.comments?.find((c) => c.type === 'pr');

  assertEquals(inlineComment?.path, 'test.ts');
  assertEquals(inlineComment?.position, 10);
  assertEquals(inlineComment?.body.includes('[MAINTAINABILITY]'), true, 'Should include category');
  assertEquals(inlineComment?.body.includes('⚠️'), true, 'Should include severity emoji');

  assertEquals(summaryComment?.body.includes('Overall good quality'), true);

  // APIリクエストの検証
  assertSpyCall(mockCreate, 0, {
    args: [
      {
        messages: [{ role: 'user', content: mockCreate.calls[0].args[0].messages[0].content }],
        model: 'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
        temperature: 0.7,
      },
    ],
  });
});

test('OpenaiProcessor handles API error gracefully', async () => {
  const processor = new OpenaiProcessor(mockApiKey);
  const mockCreate = spy((params: OpenAIRequest) => Promise.reject(new Error('API Error')));

  // @ts-ignore: モックのため
  processor.openai = { chat: { completions: { create: mockCreate } } };

  const result = await processor.process(mockPrInfo, [
    {
      path: 'test.ts',
      patch: 'test patch',
      changes: 1,
      status: 'modified',
    },
  ]);

  assertEquals(result.comments?.length, 1);
  assertEquals(result.comments?.[0].body, 'Failed to generate review due to an error.');
});

test('OpenaiProcessor handles invalid JSON response', async () => {
  const processor = new OpenaiProcessor(mockApiKey);
  const mockCreate = spy((params: OpenAIRequest) =>
    Promise.resolve({
      choices: [
        {
          message: {
            content: 'Invalid JSON',
          },
        },
      ],
    }),
  );

  // @ts-ignore: モックのため
  processor.openai = { chat: { completions: { create: mockCreate } } };

  const result = await processor.process(mockPrInfo, [
    {
      path: 'test.ts',
      patch: 'test patch',
      changes: 1,
      status: 'modified',
    },
  ]);

  assertEquals(result.comments?.length, 0);
});

test('OpenaiProcessor processes multiple files', async () => {
  const processor = new OpenaiProcessor(mockApiKey);
  const mockCreate = spy((params: OpenAIRequest) =>
    Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              comments: [
                {
                  message: 'Test comment',
                  severity: 'info',
                  category: 'testing',
                },
              ],
              summary: 'Test summary',
            }),
          },
        },
      ],
    }),
  );

  // @ts-ignore: モックのため
  processor.openai = { chat: { completions: { create: mockCreate } } };

  const files: IFileChange[] = [
    {
      path: 'test1.ts',
      patch: 'test patch 1',
      changes: 1,
      status: 'modified',
    },
    {
      path: 'test2.ts',
      patch: 'test patch 2',
      changes: 1,
      status: 'modified',
    },
  ];

  const result = await processor.process(mockPrInfo, files);

  assertEquals(result.comments?.length, 4); // 2ファイル × (インライン + サマリー)
  assertEquals(mockCreate.calls.length, 2); // 2回のAPI呼び出し

  // 各API呼び出しの検証
  for (let i = 0; i < 2; i++) {
    assertSpyCall(mockCreate, i, {
      args: [
        {
          messages: [{ role: 'user', content: mockCreate.calls[i].args[0].messages[0].content }],
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
          temperature: 0.7,
        },
      ],
    });
  }
});
