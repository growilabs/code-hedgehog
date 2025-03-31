import type { IVCSConfig, IVersionControlSystem } from '../types/mod.ts';
import { GitHubVCS } from './github.ts';

/**
 * Create a VCS instance based on configuration
 */
export function createVCS(config: IVCSConfig): IVersionControlSystem {
  switch (config.type) {
    case 'github':
      return new GitHubVCS(config);
    case 'gitlab':
      throw new Error('GitLab support not implemented yet');
    default:
      throw new Error(`Unsupported VCS type: ${(config as IVCSConfig).type}`);
  }
}

export type { IVCSConfig, IVersionControlSystem } from '../types/mod.ts';
