import { z } from 'npm:zod';

/**
 * Schema for a review comment structure
 */
export const CommentSchema = z.object({
  message: z.string(),
  suggestion: z.string().optional(),
  line_number: z.number().optional(),
});

/**
 * Schema for triage result
 */
export const SummarizeResponseSchema = z.object({
  summary: z.string(),
  status: z.enum(['NEEDS_REVIEW', 'APPROVED']).optional(),
  reason: z.string().optional(),
});

/**
 * Schema for the file review result
 */
export const ReviewResponseSchema = z.object({
  comments: z.array(CommentSchema),
  summary: z.string(),
});

/**
 * Type for a single comment
 */
export type Comment = z.infer<typeof CommentSchema>;

/**
 * Type for the summary response
 */
export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;

/**
 * Type for the review response
 */
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
