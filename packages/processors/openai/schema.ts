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
 * Type for the review response
 */
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
