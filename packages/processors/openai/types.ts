import type { ReviewConfig as BaseReviewConfig } from '../base/types.ts';

/**
 * OpenAI specific configuration fields
 */
export interface OpenaiLocalReviewConfig {
  openai_api_key?: string;
}

/**
 * Combined review configuration for OpenAI processor
 */
export interface OpenaiReviewConfig extends BaseReviewConfig, OpenaiLocalReviewConfig {}
