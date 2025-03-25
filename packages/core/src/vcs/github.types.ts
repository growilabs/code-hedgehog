/**
 * GitHub API Types
 *
 * This module provides minimal type definitions for GitHub API interaction
 * using @actions/github's Octokit implementation.
 */

import type { getOctokit } from '@actions/github';

// Export the type that getOctokit returns
export type IGitHubAPI = ReturnType<typeof getOctokit>;

// Factory type for creating GitHub API clients
export type CreateGitHubAPI = (token: string) => IGitHubAPI;
