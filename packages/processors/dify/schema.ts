import { z } from './deps.ts';

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
