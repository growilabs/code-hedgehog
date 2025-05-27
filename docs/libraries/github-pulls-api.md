# GitHub Pull Request API

GitHub の Pull Request を操作するための REST API のチートシートです。

公式ドキュメント: [GitHub REST API documentation for Pull Requests](https://docs.github.com/en/rest/pulls)
検索に関するドキュメント: [Searching issues and pull requests](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests), [REST API endpoints for search](https://docs.github.com/en/rest/search/search)

## Pull Request 一覧取得

リポジトリ内の Pull Request の一覧を取得します。

**エンドポイント:**

`GET /repos/{owner}/{repo}/pulls`

**パスパラメータ:**

*   `owner` (string, required): リポジトリの所有者名。
*   `repo` (string, required): リポジトリ名。

**クエリパラメータ (一部抜粋):**

*   `state` (string): Pull Request の状態。
    *   `open`: オープンな Pull Request (デフォルト)
    *   `closed`: クローズされた Pull Request
    *   `all`: 全ての Pull Request
*   `head` (string): `USER:BRANCH` 形式で指定し、特定のブランチから作成された Pull Request をフィルタリングします。
*   `base` (string): Pull Request のマージ先となるブランチ名でフィルタリングします。
*   `sort` (string): ソートする基準。
    *   `created`: 作成日時 (デフォルト)
    *   `updated`: 更新日時
    *   `popularity`: コメント数
    *   `long-running`: 作成日からの経過時間
*   `direction` (string): ソートの方向。
    *   `asc`: 昇順
    *   `desc`: 降順 (sort パラメータが指定されている場合のデフォルト)
*   `per_page` (integer): 1ページあたりのアイテム数。デフォルトは30、最大100。
*   `page` (integer): 取得するページ番号。デフォルトは1。

**レスポンス (主要なフィールド):**

レスポンスは Pull Request オブジェクトの配列です。各オブジェクトには以下のような情報が含まれます。

*   `id` (integer): Pull Request の ID。
*   `number` (integer): Pull Request の番号。
*   `state` (string): Pull Request の状態 (`open`, `closed`)。
*   `title` (string): Pull Request のタイトル。
*   `user` (object): Pull Request を作成したユーザーの情報。
    *   `login` (string): ユーザー名
    *   `id` (integer): ユーザーID
    *   `avatar_url` (string): アバター画像のURL
*   `body` (string): Pull Request の本文。
*   `created_at` (string): 作成日時 (ISO 8601 形式)。
*   `updated_at` (string): 更新日時 (ISO 8601 形式)。
*   `closed_at` (string, nullable): クローズ日時 (ISO 8601 形式)。
*   `merged_at` (string, nullable): マージ日時 (ISO 8601 形式)。
*   `html_url` (string): Pull Request の HTML URL。
*   `head` (object): Pull Request の head ブランチの情報。
    *   `label` (string): `USER:BRANCH`
    *   `ref` (string): ブランチ名
    *   `sha` (string): コミットSHA
    *   `repo` (object): リポジトリ情報
*   `base` (object): Pull Request の base ブランチの情報。
    *   `label` (string): `USER:BRANCH`
    *   `ref` (string): ブランチ名
    *   `sha` (string): コミットSHA
    *   `repo` (object): リポジトリ情報
*   `_links` (object): 関連するリソースへのリンク。
    *   `self` (object): この Pull Request API へのリンク
    *   `html` (object): HTML ページへのリンク
    *   `issue` (object): Issue API へのリンク
    *   `comments` (object): Issue コメント API へのリンク
    *   `review_comments` (object): Pull Request レビューコメント API へのリンク
    *   `review_comment` (object): Pull Request レビューコメント API (特定のコメント) へのリンク
    *   `commits` (object): Pull Request コミット API へのリンク
    *   `statuses` (object): ステータス API へのリンク

**サンプルリクエスト (curl):**

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/octocat/Hello-World/pulls?state=open&sort=created&direction=desc&per_page=10&page=1"
```

**注意点:**

*   **認証:** 通常、Personal Access Token (PAT) を `Authorization` ヘッダーに含めて認証します。
*   **API バージョン:** `X-GitHub-Api-Version` ヘッダーで API バージョンを指定することが推奨されます (例: `2022-11-28`)。
*   **レート制限:** GitHub API にはレート制限があります。大量のリクエストを行う場合は注意が必要です。レスポンスヘッダーで現在のレート制限状況を確認できます。
*   **ページネーション:** 結果が複数ページにわたる場合は、`Link` ヘッダーやクエリパラメータ (`page`, `per_page`) を使用してページネーションを処理する必要があります。

## Pull Request のキーワード検索

Pull Request をキーワードで検索するには、Search API (`GET /search/issues`) を使用します。
この API は Issue と Pull Request の両方を検索対象とし、`q` パラメータ内で検索クエリを指定します。

**エンドポイント:**

`GET /search/issues`

**クエリパラメータ:**

*   `q` (string, required): 検索クエリ。以下の要素を組み合わせて使用します。
    *   **キーワード:** 検索したい単語やフレーズ。
    *   **`type:pr`**: Pull Request のみを対象とします。
    *   **`repo:{owner}/{repo}`**: 特定のリポジトリを対象とします。
    *   **`state:{open|closed}`**: Pull Request の状態でフィルタリングします。
    *   **`author:{username}`**: 特定の作成者でフィルタリングします。
    *   **`mentions:{username}`**: 特定のユーザーがメンションされているものでフィルタリングします。
    *   **`in:{title|body|comments}`**: 検索対象の範囲を指定します (タイトル、本文、コメント)。複数指定可能。
    *   その他、多数の修飾子が利用可能です。詳細は公式ドキュメントを参照してください。
*   `sort` (string): ソートする基準。
    *   `comments`: コメント数
    *   `reactions`: リアクション数
    *   `reactions-+1`: +1 リアクション数
    *   `reactions--1`: -1 リアクション数
    *   `reactions-smile`: 😄 リアクション数
    *   `reactions-thinking_face`: 🤔 リアクション数
    *   `reactions-heart`: ❤️ リアクション数
    *   `reactions-tada`: 🎉 リアクション数
    *   `interactions`: インタラクション数 (コメントとリアクションの合計)
    *   `created`: 作成日時
    *   `updated`: 更新日時
    *   デフォルトは `best match` (関連性の高い順)。
*   `order` (string): ソートの方向。`asc` または `desc`。デフォルトは `desc`。
*   `per_page` (integer): 1ページあたりのアイテム数。デフォルトは30、最大100。
*   `page` (integer): 取得するページ番号。デフォルトは1。

**レスポンス (主要なフィールド):**

レスポンスは検索結果のオブジェクトで、`items` プロパティに Pull Request (または Issue) オブジェクトの配列が含まれます。
各アイテムの構造は、Pull Request 一覧取得 API のレスポンスと類似しています。

*   `total_count` (integer): 検索にヒットした総数。
*   `incomplete_results` (boolean): 検索がタイムアウトし、全ての結果を取得できなかったかどうか。
*   `items` (array): 検索結果の Pull Request (または Issue) オブジェクトの配列。

**サンプルリクエスト (curl):**

特定のリポジトリ (`octocat/Hello-World`) で、タイトルまたは本文に "bug fix" というキーワードが含まれるオープンな Pull Request を検索する場合:

```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/search/issues?q=bug+fix+in:title,body+repo:octocat/Hello-World+type:pr+state:open&sort=created&order=desc"
```

**注意点:**

*   Search API は Pull Request 一覧取得 API とは異なるレート制限が適用される場合があります。
*   複雑なクエリや広範囲な検索は時間がかかることがあります。

## その他の Pull Request API

Pull Request には一覧取得以外にも様々な操作を行う API が提供されています。

*   **Pull Request の作成:** `POST /repos/{owner}/{repo}/pulls`
*   **Pull Request の取得:** `GET /repos/{owner}/{repo}/pulls/{pull_number}`
*   **Pull Request の更新:** `PATCH /repos/{owner}/{repo}/pulls/{pull_number}`
*   **Pull Request のマージ:** `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`
*   **Pull Request のファイル一覧取得:** `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
*   **Pull Request のコミット一覧取得:** `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`

詳細は公式ドキュメントを参照してください。