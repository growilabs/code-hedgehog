import type { IFilterConfig } from '../types';

/**
 * Validates filter configuration
 * @param config Filter configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateFilterConfig(config: IFilterConfig): void {
  if (!Array.isArray(config.include) || config.include.length === 0) {
    throw new Error('Include patterns must be a non-empty array');
  }

  if (!Array.isArray(config.exclude)) {
    throw new Error('Exclude patterns must be an array');
  }

  if (config.maxFileSize <= 0) {
    throw new Error('Maximum file size must be greater than 0');
  }
}
