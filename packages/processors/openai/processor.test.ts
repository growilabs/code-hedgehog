import process from 'node:process';
import type { OpenAI } from '@openai/openai';
import { zodResponseFormat } from '@openai/openai/helpers/zod';
import { assertEquals } from '@std/assert';
import { test } from '@std/testing/bdd';
import { type Spy, spy } from '@std/testing/mock';
import type { IFileChange } from '../../core/mod.ts';
import { OpenaiProcessor } from './processor.ts';
import { ReviewResponseSchema } from './schema.ts';

// prepare API key for OpenAI
process.env.OPENAI_API_KEY = 'test-key';

const mockPrInfo = {
  title: 'Test PR',
  body: 'Test PR description',
  baseBranch: 'main',
  headBranch: 'feature',
};

function createMockSpy(): Spy<unknown, [OpenAI.Responses.ResponseCreateParams], Promise<OpenAI.Responses.Response>> {
  return spy((_params: OpenAI.Responses.ResponseCreateParams) =>
    Promise.resolve({
      id: 'mock-id',
      created_at: new Date().getTime(),
      output_text: JSON.stringify({
        comments: [
          {
            message: 'This could be improved',
            suggestion: 'Consider using const',
            line_number: 10,
          },
        ],
        summary: 'Overall good quality',
      }),
    } as OpenAI.Responses.Response),
  );
}

test('OpenaiProcessor processes review comments correctly', async () => {
  const processor = new OpenaiProcessor();
  const mockCreate = createMockSpy();
  // テスト用にprivateプロパティを上書き
  Object.defineProperty(processor, 'openai', {
    value: { responses: { create: mockCreate } },
  });

  const result = await processor.process(mockPrInfo, [
    {
      path: 'test.ts',
      patch: 'test patch',
      changes: 1,
      status: 'modified',
    },
  ]);

  assertEquals(result.comments?.length, 2); // One inline comment and one summary
  const inlineComment = result.comments?.find((c) => c.type === 'inline');
  const summaryComment = result.comments?.find((c) => c.type === 'pr');

  assertEquals(inlineComment?.path, 'test.ts');
  assertEquals(inlineComment?.position, 10);
  assertEquals(inlineComment?.body, 'This could be improved\n\n**Suggestion:**\nConsider using const');

  assertEquals(summaryComment?.body.includes('Overall good quality'), true);

  // Verify API call configuration
  assertEquals(mockCreate.calls.length, 1);
  const request = mockCreate.calls[0]?.args[0];
  if (!request) throw new Error('No request made');

  assertEquals(request.model, 'gpt-4o');
  const format = zodResponseFormat(ReviewResponseSchema, 'review_response');
  assertEquals(request.text?.format?.type, format.type);
  assertEquals(request.temperature, 0.7);
});

test('OpenaiProcessor handles API error gracefully', async () => {
  const processor = new OpenaiProcessor();
  const mockCreate = spy(() => Promise.reject(new Error('API Error')));
  // テスト用にprivateプロパティを上書き
  Object.defineProperty(processor, 'openai', {
    value: { responses: { create: mockCreate } },
  });

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
  const processor = new OpenaiProcessor();
  const mockCreate = spy(() =>
    Promise.resolve({
      id: 'mock-response',
      created_at: new Date().getTime(),
      output_text: 'Invalid JSON',
    } as OpenAI.Responses.Response),
  );
  // テスト用にprivateプロパティを上書き
  Object.defineProperty(processor, 'openai', {
    value: { responses: { create: mockCreate } },
  });

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
  const processor = new OpenaiProcessor();
  const mockCreate = spy((_request: OpenAI.Responses.ResponseCreateParams) =>
    Promise.resolve({
      id: 'mock-response',
      created_at: new Date().getTime(),
      output_text: JSON.stringify({
        comments: [
          {
            message: 'Test comment',
            suggestion: 'Test suggestion',
          },
        ],
        summary: 'Test summary',
      }),
    } as OpenAI.Responses.Response),
  );
  // テスト用にprivateプロパティを上書き
  Object.defineProperty(processor, 'openai', {
    value: { responses: { create: mockCreate } },
  });

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

  assertEquals(result.comments?.length, 4); // 2 files × (inline + summary)
  assertEquals(mockCreate.calls.length, 2); // 2 API calls

  // Verify both API calls had correct configuration
  for (const call of mockCreate.calls) {
    const request = call.args[0];
    if (!request) throw new Error('No request made');

    assertEquals(request.model, 'gpt-4o');
    const format = zodResponseFormat(ReviewResponseSchema, 'review_response');
    assertEquals(request.text?.format?.type, format.type);
    assertEquals(request.temperature, 0.7);
  }
});
