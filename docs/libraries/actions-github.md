# @actions/github チートシート

GitHub Actions で GitHub API を利用するための公式ライブラリです。

## インストール

```bash
npm install @actions/github
```

## 基本的な使い方

```typescript
import * as github from '@actions/github';
import * as core from '@actions/core';

async function run() {
  // GitHub トークンを取得
  const token = core.getInput('github-token');
  const octokit = github.getOctokit(token);

  // 現在のコンテキスト情報を取得
  const { context } = github;
  const { owner, repo } = context.repo;
}
```

## 主要な機能

### GitHub クライアントの作成

```typescript
const octokit = github.getOctokit(token);
```

### コンテキスト情報の取得

```typescript
const { context } = github;

// リポジトリ情報
const { owner, repo } = context.repo;

// イベント情報
const { eventName, sha, ref, workflow, action, actor } = context;

// ペイロード情報 (イベントの詳細データ)
const { pull_request, issue } = context.payload;
```

### 一般的なAPI操作

```typescript
// PRの一覧を取得
const prs = await octokit.rest.pulls.list({
  owner,
  repo,
  state: 'open'
});

// イシューにコメントを追加
await octokit.rest.issues.createComment({
  owner,
  repo,
  issue_number: issue.number,
  body: 'コメント内容'
});

// コミットステータスの設定
await octokit.rest.repos.createCommitStatus({
  owner,
  repo,
  sha: context.sha,
  state: 'success',
  description: 'テストが成功しました',
  context: 'continuous-integration/test'
});
```

## よく使うパターン

### PRの情報を取得

```typescript
async function getPullRequest(octokit, context) {
  const pr = await octokit.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number
  });
  return pr.data;
}
```

### ファイル内容の取得

```typescript
async function getFileContent(octokit, context, path) {
  const response = await octokit.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: path,
    ref: context.sha
  });
  
  // content はBase64でエンコードされている
  const content = Buffer.from(response.data.content, 'base64').toString();
  return content;
}
```

### ラベルの操作

```typescript
// ラベルの追加
await octokit.rest.issues.addLabels({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.payload.pull_request.number,
  labels: ['準備完了']
});

// ラベルの削除
await octokit.rest.issues.removeLabel({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.payload.pull_request.number,
  name: '作業中'
});
```

## エラーハンドリング

```typescript
try {
  await octokit.rest.issues.get({
    owner,
    repo,
    issue_number
  });
} catch (error) {
  if (error.status === 404) {
    core.warning('Issue not found');
  } else {
    core.setFailed(error.message);
  }
}
```

## Webhook ペイロードの型定義

```typescript
import { PushEvent } from '@octokit/webhooks-definitions/schema';

if (github.context.eventName === 'push') {
  const pushPayload = github.context.payload as PushEvent;
  core.info(`The head commit is: ${pushPayload.head_commit}`);
}
```

## GraphQL クエリの実行

```typescript
const query = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, repo: $repo) {
      issues(last: 3) {
        nodes {
          title
        }
      }
    }
  }
`;

const result = await octokit.graphql(query, {
  owner: context.repo.owner,
  repo: context.repo.repo
});
```

## Octokit インスタンスの拡張

Enterprise Server の管理者 API を使用する例：

```typescript
import { GitHub, getOctokitOptions } from '@actions/github/lib/utils';
import { enterpriseServer220Admin } from '@octokit/plugin-enterprise-server';

// プラグインを追加
const octokit = GitHub.plugin(enterpriseServer220Admin);

// カスタムオプションの設定
const myOctokit = new octokit(getOctokitOptions(token, {
  userAgent: "CustomUserAgent"
}));

// Enterprise 管理者 API の使用
await myOctokit.rest.enterpriseAdmin.createUser({
  login: "testuser",
  email: "testuser@test.com"
});
```

## 依存ライブラリ

- @actions/http-client: ^2.2.0
- @octokit/core: ^5.0.1
- @octokit/plugin-paginate-rest: ^9.0.0
- @octokit/plugin-rest-endpoint-methods: ^10.0.0

## 参考リンク

- [NPMパッケージ](https://www.npmjs.com/package/@actions/github)
- [GitHub REST API ドキュメント](https://docs.github.com/en/rest)
- [Octokit REST API リファレンス](https://octokit.github.io/rest.js/)