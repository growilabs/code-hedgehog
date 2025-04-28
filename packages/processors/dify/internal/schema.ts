import { z } from '../deps.ts';

// DifyRequestBodySchema with generic input type

// Type that allows overriding the inputs type
export type DifyRequestBody<T = Record<string, unknown>> = {
  inputs: T;
  response_mode: 'streaming' | 'blocking';
  user?: string;
};

// Dify API Response Schema
// Dify raw response schema for outputs validation
export const DifyOutputsSchema = z.object({
  data: z.object({
    outputs: z.unknown(),
  }),
});

// File type enums

// File Upload Response Schema
export const UploadResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  extension: z.string(),
  mime_type: z.string(),
  created_by: z.string(),
  created_at: z.number(),
});
