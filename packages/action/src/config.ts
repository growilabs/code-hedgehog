import * as core from '@actions/core';

export interface ActionConfig {
  /**
   * Selected processor name
   */
  processor: string;

  /**
   * Processor options
   */
  processorOptions?: {
    [key: string]: unknown;
  };

  /**
   * File filtering configuration
   */
  filter: {
    include?: string[];
    exclude?: string[];
    maxChanges?: number;
  };
}

export function getConfig(): ActionConfig {
  // Parse include/exclude patterns
  const includeInput = core.getInput('include');
  const excludeInput = core.getInput('exclude');
  const include = includeInput ? JSON.parse(includeInput) : undefined;
  const exclude = excludeInput ? JSON.parse(excludeInput) : undefined;

  // Parse max changes
  const maxChangesInput = core.getInput('max-changes');
  const maxChanges = maxChangesInput ? Number.parseInt(maxChangesInput, 10) : undefined;

  return {
    processor: core.getInput('processor', { required: true }),
    filter: {
      include,
      exclude,
      maxChanges,
    },
  };
}
