import * as core from '@actions/core';

export interface ActionConfig {
  /**
   * GitHub token for API access
   */
  githubToken: string;

  /**
   * Selected processor name
   */
  processor: string;

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
  const maxChanges = maxChangesInput
    ? Number.parseInt(maxChangesInput, 10)
    : undefined;

  return {
    githubToken: core.getInput('github-token', { required: true }),
    processor: core.getInput('processor', { required: true }),
    filter: {
      include,
      exclude,
      maxChanges,
    },
  };
}
