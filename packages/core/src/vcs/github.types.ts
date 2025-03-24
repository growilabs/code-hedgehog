/**
 * GitHub API Types
 * Minimal type definitions for GitHub API interaction
 */
import { Octokit } from '@octokit/core';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';

const GitHub = Octokit.plugin(restEndpointMethods, paginateRest).defaults({});

export type IGitHubAPI = InstanceType<typeof GitHub>;
export type CreateGitHubAPI = (token: string) => IGitHubAPI;
