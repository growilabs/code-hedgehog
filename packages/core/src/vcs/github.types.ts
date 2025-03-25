/**
 * GitHub API Types
 *
 * This module uses only the type definitions provided by @actions/github.
 * Instead of defining custom types, we directly use the return type of getOctokit
 * to ensure the implementation stays in sync with API changes.
 */
import type { getOctokit } from '@actions/github';

/**
 * GitHub API interface
 * By using the return type of getOctokit directly, we automatically
 * track any changes in the Octokit implementation.
 */
export type IGitHubAPI = ReturnType<typeof getOctokit>;

/**
 * Factory type for creating GitHub API clients
 * This abstraction allows for dependency injection during testing,
 * making it easier to provide mock implementations.
 */
export type CreateGitHubAPI = (token: string) => IGitHubAPI;
