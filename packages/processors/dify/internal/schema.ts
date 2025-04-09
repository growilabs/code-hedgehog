import { z } from '../deps.ts';

// DifyRequestBodySchema with generic input type
export const DifyRequestBodySchema = z.object({
  inputs: z.record(z.unknown()),
  response_mode: z.enum(['streaming', 'blocking']),
  user: z.string().optional(),
});

// Type that allows overriding the inputs type
export type DifyRequestBody<T = Record<string, unknown>> = {
  inputs: T;
  response_mode: 'streaming' | 'blocking';
  user?: string;
};

// Dify API Response Schema
export const DifyResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ),
});

export type DifyResponse = z.infer<typeof DifyResponseSchema>;
