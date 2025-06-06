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
}
