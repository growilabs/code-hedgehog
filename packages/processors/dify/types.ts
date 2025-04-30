import type { ReviewConfig as BaseReviewConfig } from '../base/types.ts';

/**
 * Dify specific configuration fields
 */
export interface DifyLocalReviewConfig {
  dify_base_url?: string;
  dify_user?: string;
  dify_api_key_summarize?: string;
  dify_api_key_grouping?: string;
  dify_api_key_review?: string;
}

/**
 * Combined review configuration for Dify processor
 */
export interface DifyReviewConfig extends BaseReviewConfig, DifyLocalReviewConfig {}