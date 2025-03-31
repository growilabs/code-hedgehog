# @octokit/core チートシート

GitHub REST API と GraphQL API を扱うための基本クライアント。

## 基本的な使い方

```typescript
import { Octokit } from "@octokit/core";

// クライアントの初期化
const octokit = new Octokit({
  auth: "YOUR_TOKEN",
});
```

## REST API

```typescript
// GET リクエスト
const { data } = await octokit.request("GET /user");

// POST リクエスト (プルリクエスト作成)
const { data } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
  owner,
  repo,
  title: "My pull request",
  base: "main",
  head: "feature"
});
```

## GraphQL API

```typescript
const response = await octokit.graphql(
  `query ($login: String!) {
    organization(login: $login) {
      repositories(privacy: PRIVATE) {
        totalCount
      }
    }
  }`,
  { login: "octokit" }
);
```

## 主要なオプション

```typescript
const octokit = new Octokit({
  // 認証情報
  auth: "token",

  // GitHub Enterprise用のベースURL
  baseUrl: "https://github.your-company.com/api/v3",

  // プレビュー機能の有効化
  previews: ["shadow-cat"],

  // リクエストのタイムアウト設定
  request: {
    timeout: 5000
  },

  // タイムゾーン設定
  timeZone: "Asia/Tokyo",

  // カスタムUserAgent
  userAgent: "my-app/v1.2.3"
});
```

## フック機能

```typescript
// リクエスト前
octokit.hook.before("request", async (options) => {
  validate(options);
});

// リクエスト後
octokit.hook.after("request", async (response, options) => {
  console.log(`${options.method} ${options.url}: ${response.status}`);
});

// エラー処理
octokit.hook.error("request", async (error, options) => {
  if (error.status === 304) {
    return findInCache(error.response.headers.etag);
  }
  throw error;
});
```

## デフォルト設定のカスタマイズ

```typescript
// デフォルト設定でカスタムOctokitクラスを作成
const MyOctokit = Octokit.defaults({
  auth: "token",
  baseUrl: "https://github.company.com/api/v3",
  userAgent: "my-app/v1.2.3"
});

// カスタムクラスのインスタンス化
const octokit1 = new MyOctokit();
```

## プラグイン

```typescript
// プラグインの定義
const myPlugin = (octokit, options = { greeting: "Hello" }) => {
  return {
    helloWorld: () => console.log(`${options.greeting}, world!`)
  };
};

// プラグインの適用
const MyOctokit = Octokit.plugin(myPlugin);
const octokit = new MyOctokit({ greeting: "Hi" });
```

## ログ機能

```typescript
// 4つのログレベル
octokit.log.debug("デバッグ情報");
octokit.log.info("情報");
octokit.log.warn("警告");
octokit.log.error("エラー");
```

## 関連リンク

- [GitHub REST API ドキュメント](https://docs.github.com/rest)
- [@octokit/request](https://github.com/octokit/request.js)
- [@octokit/graphql](https://github.com/octokit/graphql.js)