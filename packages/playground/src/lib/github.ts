import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

export type Repository = Endpoints['GET /orgs/{org}/repos']['response']['data'][number];
export type PullRequestFromList = Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][number];
export type PullRequestDetail = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
export type SearchedPullRequestItem = Endpoints['GET /search/issues']['response']['data']['items'][number];

export interface DisplayablePullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  } | null;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  html_url: string;
  merged_at: string | null | undefined;
  closed_at: string | null | undefined;
  repository_url?: string;
}

interface PaginationResult<T> {
  pullRequests: T[];
  maxPage: number;
}

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 10;

// Octokitインスタンスの再利用のためのキャッシュ
const octokitCache = new Map<string, Octokit>();

const getOctokit = (accessToken: string): Octokit => {
  const cached = octokitCache.get(accessToken);
  if (cached) {
    return cached;
  }

  const newOctokit = new Octokit({ auth: accessToken });
  octokitCache.set(accessToken, newOctokit);
  return newOctokit;
};

// 共通のページング処理関数
const extractMaxPageFromHeaders = (linkHeader?: string | null): number => {
  if (!linkHeader) return 1;
  const match = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : 1;
};

// PR状態の判定を統一
const determinePRState = (pr: { merged_at?: string | null; state: string }): 'open' | 'closed' | 'merged' => {
  if (pr.merged_at) return 'merged';
  return pr.state === 'open' ? 'open' : 'closed';
};

// SearchedPullRequestItemからDisplayablePullRequestへの変換
const mapSearchedPRToDisplayable = (item: SearchedPullRequestItem): DisplayablePullRequest => ({
  id: item.id,
  number: item.number,
  title: item.title,
  user: item.user
    ? {
        login: item.user.login,
        avatar_url: item.user.avatar_url,
        html_url: item.user.html_url,
      }
    : null,
  state: determinePRState({
    merged_at: item.pull_request?.merged_at,
    state: item.state,
  }),
  created_at: item.created_at,
  updated_at: item.updated_at,
  html_url: item.html_url,
  merged_at: item.pull_request?.merged_at || null,
  closed_at: item.closed_at,
  repository_url: item.repository_url,
});

// PullRequestFromListからDisplayablePullRequestへの変換
const mapListPRToDisplayable = (pr: PullRequestFromList): DisplayablePullRequest => ({
  id: pr.id,
  number: pr.number,
  title: pr.title,
  user: pr.user
    ? {
        login: pr.user.login,
        avatar_url: pr.user.avatar_url,
        html_url: pr.user.html_url,
      }
    : null,
  state: determinePRState(pr),
  created_at: pr.created_at,
  updated_at: pr.updated_at,
  html_url: pr.html_url,
  merged_at: pr.merged_at,
  closed_at: pr.closed_at,
});

/**
 * 組織のリポジトリ一覧を取得
 */
export const getRepositories = async (accessToken: string, org: string): Promise<Repository[]> => {
  const octokit = getOctokit(accessToken);
  const repositories: Repository[] = [];

  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, { org, sort: 'pushed', per_page: MAX_PER_PAGE })) {
    repositories.push(...data);
  }
  return repositories;
};

/**
 * キーワードでPRを検索
 */
const searchPRsByKeyword = async (
  octokit: Octokit,
  org: string,
  repo: string,
  keyword: string,
  page: number,
  perPage: number = DEFAULT_PER_PAGE,
): Promise<PaginationResult<DisplayablePullRequest>> => {
  const query = `repo:${org}/${repo} ${keyword.trim()} is:pr`;
  const response = await octokit.request('GET /search/issues', {
    q: query,
    per_page: perPage,
    page,
  });

  return {
    pullRequests: response.data.items.map(mapSearchedPRToDisplayable),
    maxPage: extractMaxPageFromHeaders(response.headers.link),
  };
};

/**
 * 全てのPRを取得
 */
const getAllPRs = async (
  octokit: Octokit,
  org: string,
  repo: string,
  page: number,
  perPage: number = DEFAULT_PER_PAGE,
): Promise<PaginationResult<DisplayablePullRequest>> => {
  const response = await octokit.rest.pulls.list({
    owner: org,
    repo,
    state: 'all',
    per_page: perPage,
    page,
  });

  return {
    pullRequests: response.data.map(mapListPRToDisplayable),
    maxPage: extractMaxPageFromHeaders(response.headers.link),
  };
};

/**
 * PR一覧をページング付きで取得（キーワード検索対応）
 */
export const getPullRequestsWithMaxPage = async (
  accessToken: string,
  org: string,
  repo: string,
  page: number,
  keyword?: string,
): Promise<PaginationResult<DisplayablePullRequest>> => {
  const octokit = getOctokit(accessToken);

  return keyword?.trim() ? await searchPRsByKeyword(octokit, org, repo, keyword, page) : await getAllPRs(octokit, org, repo, page);
};

/**
 * 特定のPRの詳細を取得
 */
export const getPullRequest = async (accessToken: string, owner: string, repo: string, pull_number: number): Promise<PullRequestDetail> => {
  const octokit = getOctokit(accessToken);
  const response = await octokit.rest.pulls.get({ owner, repo, pull_number });
  return response.data;
};
