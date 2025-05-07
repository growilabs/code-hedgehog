# GitHub Bot Runner - ステップ1 詳細開発計画: Runner主要機能強化 (コメント履歴 & Checks API)

このステップでは、以下の2つの主要機能を実装します。
1.  **コメント履歴の収集と連携:** Runner がプルリクエストの既存コメントを取得し、Processor がレビュー時にその情報を活用できるようにします。
2.  **Checks API 連携の実装:** Runner がレビュープロセスの状態 (開始、進行中、完了、結果) を GitHub Checks API を通じてユーザーにフィードバックできるようにします。

## 1. コメント履歴の収集と連携

**目的:** Processor が過去の議論の文脈を理解し、より的確で一貫性のあるレビューを行えるようにする。

**関連仕様:**
*   `docs/project-specs/05.github-bot/github-bot-runner.md` (セクション 4.4)
*   `docs/project-specs/05.github-bot/comment-chain-features.md` (セクション 2)

**タスク:**

*   **1.1. `CommentInfo` データ構造の定義/確認 (`@code-hedgehog/core`)**
    *   **内容:** `comment-chain-features.md` に記載のある `CommentInfo` のプロパティ (ID, 本文, 投稿者, 日時, ファイルパス, 行番号, `in_reply_to_id` 等) を型定義として `packages/core/src/types/review.ts` (または `vcs.ts`) に定義、または既存の型を確認・拡充します。
    *   **成果物:** `CommentInfo` 型定義。
*   **1.2. `IVCS` インターフェースへのメソッド追加 (`@code-hedgehog/core`)**
    *   **内容:** `packages/core/src/types/vcs.ts` の `IVCS` インターフェースに、コメント履歴を取得するためのメソッドシグネチャを追加します。
        ```typescript
        // packages/core/src/types/vcs.ts
        export interface IVCS {
          // ... existing methods
          getComments(pullRequestId: number): Promise<CommentInfo[]>;
        }
        ```
    *   **成果物:** 更新された `IVCS` インターフェース。
*   **1.3. `GitHubVCSClient` へのメソッド実装 (`@code-hedgehog/core`)**
    *   **内容:** `packages/core/src/vcs/github.ts` の `GitHubVCSClient` クラスに `getComments` メソッドを実装します。GitHub API (例: `octokit.pulls.listReviewComments`, `octokit.issues.listComments`) を使用し、取得した情報を `CommentInfo[]` 形式に整形します。
    *   **成果物:** `getComments` メソッドの実装。
*   **1.4. `ActionRunner` でのコメント履歴取得と `ProcessInput` への追加 (`packages/action`)**
    *   **内容:** `packages/action/src/runner.ts` の `run` メソッド内で、`vcsClient.getComments()` を呼び出し、取得したコメント履歴を `ProcessInput` に含めます。
    *   `packages/core/src/types/processor.ts` の `ProcessInput` 型に `commentHistory?: CommentInfo[]` プロパティを追加します。
    *   **成果物:** `runner.ts` の改修、`ProcessInput` 型の更新。
*   **1.5. `IPullRequestProcessor` 及び各 Processor でのコメント履歴受け入れ準備 (`@code-hedgehog/core`, `packages/processors/*`)**
    *   **内容:** `IPullRequestProcessor` インターフェース (`packages/core/src/types/processor.ts`) の `process` メソッドの引数 `ProcessInput` がコメント履歴を含むようにします。各 Processor (`BaseProcessor`, `OpenaiProcessor` 等) がこの情報を受け取れるようにします (具体的な活用は後続タスク)。
    *   **成果物:** 更新された `IPullRequestProcessor` インターフェース、各 Processor の `process` メソッドシグネチャ更新。

## 2. Checks API 連携の実装

**目的:** レビュープロセスの透明性を高め、ユーザーにリアルタイムなフィードバックを提供する。

**関連仕様:**
*   `docs/project-specs/05.github-bot/github-bot-runner.md` (セクション 6.3, 7.1)

**タスク:**

*   **2.1. Checks API 操作用データ構造の定義/確認 (`@code-hedgehog/core`)**
    *   **内容:** GitHub Checks API の `Create Check Run` や `Update Check Run` エンドポイントに必要なパラメータ (name, head_sha, status, conclusion, output (title, summary, text), started_at, completed_at 等) に基づく型定義を `packages/core/src/types/vcs.ts` に追加します。
    *   **成果物:** Checks API 関連の型定義 (例: `CheckRunStatus`, `CheckRunConclusion`, `CheckRunOutput`, `CreateCheckRunParams`, `UpdateCheckRunParams`)。
*   **2.2. `IVCS` インターフェースへのメソッド追加 (`@code-hedgehog/core`)**
    *   **内容:** `packages/core/src/types/vcs.ts` の `IVCS` インターフェースに、Check Run を作成・更新するためのメソッドシグネチャを追加します。
        ```typescript
        // packages/core/src/types/vcs.ts
        export interface IVCS {
          // ... existing methods
          createCheckRun(params: CreateCheckRunParams): Promise<number>; // Returns Check Run ID
          updateCheckRun(checkRunId: number, params: UpdateCheckRunParams): Promise<void>;
        }
        ```
        (既存のCheck Runを名前で検索し、あれば更新、なければ作成する単一メソッド `createOrUpdateCheckRun` も検討可能です。)
    *   **成果物:** 更新された `IVCS` インターフェース。
*   **2.3. `GitHubVCSClient` へのメソッド実装 (`@code-hedgehog/core`)**
    *   **内容:** `packages/core/src/vcs/github.ts` の `GitHubVCSClient` クラスに `createCheckRun` 及び `updateCheckRun` (または `createOrUpdateCheckRun`) メソッドを実装します。GitHub API (`octokit.checks.create`, `octokit.checks.update`) を使用します。
    *   **成果物:** Checks API 操作メソッドの実装。
*   **2.4. `ActionRunner` での Checks API 更新処理 (`packages/action`)**
    *   **内容:** `packages/action/src/runner.ts` の `run` メソッド内で、以下のタイミングで `vcsClient` の Checks API 操作メソッドを呼び出します。
        *   レビュープロセス開始直後: `createCheckRun` で `status: 'in_progress'`, `started_at` を設定。
        *   レビュー成功時: `updateCheckRun` で `status: 'completed'`, `conclusion: 'success'`, `completed_at`、及び `ProcessOutput.summary` を `output` に設定。
        *   レビュー失敗時 (エラー発生時): `updateCheckRun` で `status: 'completed'`, `conclusion: 'failure'`, `completed_at`、及びエラー情報を `output` に設定。
    *   Check Run の `name` は固定値 (例: `"Code Hedgehog Review"`) とします。`head_sha` は `prInfo` から取得します。
    *   **成果物:** `runner.ts` の改修。

## 提案する図 (Mermaid)

```mermaid
graph TD
    subgraph "1. コメント履歴連携"
        direction LR
        T1_1["1.1: CommentInfo型定義<br/>(@code-hedgehog/core)"] --> T1_2["1.2: IVCS.getComments追加<br/>(@code-hedgehog/core)"];
        T1_2 --> T1_3["1.3: GitHubVCSClient.getComments実装<br/>(@code-hedgehog/core)"];
        T1_3 --> T1_4["1.4: Runnerで履歴取得 & ProcessInputへ追加<br/>(packages/action)"];
        T1_4 --> T1_5["1.5: Processorで履歴受け入れ準備<br/>(@code-hedgehog/core, packages/processors)"];
    end

    subgraph "2. Checks API連携"
        direction LR
        T2_1["2.1: Checks API型定義<br/>(@code-hedgehog/core)"] --> T2_2["2.2: IVCS.create/updateCheckRun追加<br/>(@code-hedgehog/core)"];
        T2_2 --> T2_3["2.3: GitHubVCSClient.create/updateCheckRun実装<br/>(@code-hedgehog/core)"];
        T2_3 --> T2_4["2.4: RunnerでChecks API更新<br/>(packages/action)"];
    end