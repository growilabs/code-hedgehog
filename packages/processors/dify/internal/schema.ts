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

// File type enums
export const FileTypeEnum = z.enum([
  'document',
  'image',
  'audio',
  'video',
  'custom'
]);

export const DocumentExtensionEnum = z.enum([
  'txt', 'md', 'markdown', 'pdf', 'html',
  'xlsx', 'xls', 'docx', 'csv', 'eml',
  'msg', 'pptx', 'ppt', 'xml', 'epub'
]);

export const ImageExtensionEnum = z.enum([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'
]);

export const AudioExtensionEnum = z.enum([
  'mp3', 'm4a', 'wav', 'webm', 'amr'
]);

export const VideoExtensionEnum = z.enum([
  'mp4', 'mov', 'mpeg', 'mpga'
]);

// Export types for enums
export type FileType = z.infer<typeof FileTypeEnum>;
export type DocumentExtension = z.infer<typeof DocumentExtensionEnum>;
export type ImageExtension = z.infer<typeof ImageExtensionEnum>;
export type AudioExtension = z.infer<typeof AudioExtensionEnum>;
export type VideoExtension = z.infer<typeof VideoExtensionEnum>;

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

export type UploadResponse = z.infer<typeof UploadResponseSchema>;
