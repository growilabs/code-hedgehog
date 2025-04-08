import { z } from './deps.ts';
import { ImpactLevel } from './deps.ts';

/**
 * Response schema for triage phase
 */
export const SummarizeResponseSchema = z.object({
  summary: z.string(),
  needsReview: z.boolean(),
  reason: z.string().optional(),
});

type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;

/**
 * Schema for changes grouped by aspects
 */
export const GroupingResponseSchema = z.object({
  description: z.string(),
  aspects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    files: z.array(z.string()),
    impact: z.nativeEnum(ImpactLevel),
  })),
  crossCuttingConcerns: z.array(z.string()),
});

export type GroupingResponse = z.infer<typeof GroupingResponseSchema>;

/**
 * Response schema for review phase
 */
export interface Comment {
  message: string;
  suggestion?: string;
  line_number?: number;
}

export const ReviewResponseSchema = z.object({
  comments: z.array(z.object({
    message: z.string(),
    suggestion: z.string().optional(),
    line_number: z.number().optional(),
  })),
  summary: z.string().optional(),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
