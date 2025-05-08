# GitHub Bot 仕様概要

## 1. 目的

このドキュメントは、Code Hedgehog プロジェクトにおける **GitHub Bot** の全体的な仕様とアーキテクチャの概要を示します。GitHub Bot は、GitHub プラットフォームと Code Hedgehog のコアレビューシステム (Processor) との間の **インターフェース** として機能し、開発者が使い慣れた GitHub 上でシームレスな自動コードレビュー体験を提供することを目的としています。具体的には、GitHub 上でのイベント検知、レビューに必要な情報の収集、Processor への処理依頼、そして結果のフィードバックといった一連の流れを担当します。

## 2. 主要機能 (概要と詳細リンク)

GitHub Bot は、内部的に **GitHub Bot Runner** (インテグレーションレイヤー) と **Processor** (エンジンレイヤー) に役割が分担されており、これらが連携して以下の主要機能を提供します。各機能の詳細については、それぞれの仕様ドキュメントを参照してください。

-   **2.1. イベントトリガー:** GitHub Actions を介して、Pull Request の作成・更新 (`pull_request`) やコメント投稿 (`issue_comment`) といった GitHub イベントを検知し、レビュープロセスやインタラクションを開始します。オプションで手動トリガーも設定可能です。
    -   [詳細: Runner 仕様](./github-bot-runner.md#3-トリガー)
-   **2.2. コンテキスト収集と整形:** レビューに必要な情報 (PR情報, コード差分, プロジェクト設定, 既存のコメント履歴など) を GitHub API 等を通じて収集し、Processor が解釈しやすい形式に整形します。
    -   [詳細: Runner 仕様](./github-bot-runner.md#4-コンテキスト収集と整形)
-   **2.3. Processor 連携:** 整形されたコンテキスト情報を適切な Processor に渡し、実際のコードレビュー実行 (`process`) やユーザーからの指示への応答生成 (`handleInteraction`) を依頼します。
    -   [詳細: Runner 仕様](./github-bot-runner.md#5-processor-連携)
-   **2.4. 結果の処理と投稿:** Processor から返されたレビューコメントやサマリー、応答メッセージを受け取り、GitHub のプルリクエストコメントや Checks API を通じて開発者にフィードバックします。
    -   [詳細: Runner 仕様](./github-bot-runner.md#6-結果の処理と投稿)
-   **2.5. 状態管理とフィードバック:** GitHub Checks API を利用してレビュープロセスの進行状況 (実行中、完了、失敗など) を表示したり、GitHub の "Resolve conversation" 機能と連携して未解決の指摘数を表示したりすることで、レビュープロセス全体の可視性を高めます。
    -   [詳細: Runner 仕様](./github-bot-runner.md#7-状態管理とフィードバック)
-   **2.6. インタラクティブ機能 (`@bot`):** ユーザーがレビューコメントに対して `@bot` をメンションすることで、指摘内容の説明を求めたり、代替案を提案させたりといった対話的な操作を可能にします。Runner がこれを検知し、Processor に処理を依頼します。
    -   [詳細: Runner 仕様](./github-bot-runner.md#8-インタラクション処理-bot)
-   **2.7. コメント関連機能の活用:** Processor は、Runner から提供された過去のコメント履歴を分析・活用することで、議論の文脈を踏まえた、より的確で一貫性のあるレビューや応答を生成します。
    -   [詳細: Processor 仕様](./comment-chain-features.md)

## 3. 役割分担

GitHub Bot の機能は、以下の2つの主要コンポーネントによって分担されます。

-   **3.1. GitHub Bot (Action Runner)**
    -   **責務:** GitHub プラットフォームとの直接的なやり取りを担当する**インテグレーションレイヤー**です。イベントの受信、API を介した情報収集、Processor の呼び出し、結果の GitHub への投稿、Checks API による状態表示、インタラクションの受付・中継などを行います。
    -   **詳細:** [GitHub Bot Runner 仕様](./github-bot-runner.md)
-   **3.2. Processor (`IPullRequestProcessor`)**
    -   **責務:** 実際のレビューロジックや AI モデルとの連携を担当する**エンジン部分**です。Runner から受け取った情報 (コード差分、コメント履歴、ユーザー指示など) を解釈し、レビューコメントの生成やインタラクションへの応答生成を行います。
    -   **詳細:** [Processor: コメント関連機能の活用](./comment-chain-features.md), [プロセッサ基盤仕様](../03.processors/base-processor.md) など

この明確な役割分担により、Runner は GitHub との連携という複雑な処理に専念でき、Processor はレビュー品質を高めるためのコアロジックや AI 連携の改善に集中できます。

## 4. アーキテクチャ概要

以下の図は、GitHub Bot の主要コンポーネントとその連携を示しています。

```mermaid
graph TD
    A[GitHub Actions Event (PR, Comment)] --> B[Action Runner (Bot)];
    B --> C[VCS Client (GitHub API)];
    B --> D[File Manager];
    B --> E[Processor Interface (IPullRequestProcessor)];
    C -- Fetches PR Info, Diff, Comments, Posts Comments, Updates Checks --> G[GitHub API];
    D -- Uses VCS Client --> C;
    D -- Collects Files --> B;
    E -- Executes Review/Interaction --> B;

    subgraph "GitHub"
        A
        G
    end

    subgraph "GitHub Action Runner Environment"
        B["Action Runner (Bot)<br/>[github-bot-runner.md]"]
        C["VCS Client (GitHub API)<br/>[@code-hedgehog/core]"]
        D["File Manager<br/>[@code-hedgehog/core]"]
        E["Processor Interface<br/>[@code-hedgehog/core]"]
    end

    subgraph "Code Hedgehog Core/Processors"
        E --> H["Processor Implementation<br/>[comment-chain-features.md]<br/>[../03.processors/*]"];
    end
```

-   **Action Runner (Bot):** GitHub Actions 環境で動作するメインプロセス (`packages/action/src/runner.ts` ベース)。イベントを起点に、他のコンポーネントを協調させて処理を進めます。詳細は [GitHub Bot Runner 仕様](./github-bot-runner.md) を参照。
-   **VCS Client (GitHub API):** GitHub API との通信を抽象化するクライアント (`@code-hedgehog/core` の `createVCS` で生成)。差分取得、コメント投稿、Checks API 操作などを担当します。
-   **File Manager:** レビュー対象となる変更ファイルの収集やフィルタリングを行います (`@code-hedgehog/core` の `FileManager`)。
-   **Processor (`IPullRequestProcessor`):** レビュー実行やインタラクション応答生成のコアロジックを実装したモジュール (`packages/processors/*`)。詳細は [Processor: コメント関連機能の活用](./comment-chain-features.md) や各プロセッサ仕様を参照。

## 5. 処理フロー概要

GitHub Bot の代表的な処理フローの概要です。詳細なステップは Runner の仕様ドキュメントを参照してください。

-   **5.1. 通常レビュー (Runner 視点):** `pull_request` イベントをトリガーに、Runner が情報収集、Processor 呼び出し、結果投稿、Checks API 更新を行います。
    -   詳細は [GitHub Bot Runner 仕様](./github-bot-runner.md#9-アーキテクチャと処理フロー-runner-視点) を参照してください。
-   **5.2. インタラクション (Runner 視点):** `issue_comment` イベント (`@bot` メンション) をトリガーに、Runner がコメント解析、コンテキスト収集、Processor の `handleInteraction` 呼び出し、応答投稿を行います。
    -   詳細は [GitHub Bot Runner 仕様](./github-bot-runner.md#9-アーキテクチャと処理フロー-runner-視点) を参照してください。

## 6. 将来的な拡張性 (オプション)

### 6.1. GitLab への対応

現状の Code Hedgehog Bot は GitHub プラットフォーム向けに設計されていますが、アーキテクチャの分離 (Runner と Processor) および VCS 連携部分の抽象化 (`@code-hedgehog/core` の `IVCSConfig`, `createVCS`) により、将来的には GitLab などの他のバージョン管理プラットフォームへの対応も視野に入れています。

GitLab へ対応するためには、主に以下の開発・検討が必要となります。

-   **GitLab 用 VCS Client の実装:**
    -   GitLab API と連携するための新しい `GitLabVCSClient` を `@code-hedgehog/core` 内に実装します。
    -   これには、Merge Request 情報取得、差分取得、コメント投稿 (ディスカッション、スレッド機能)、CI/CD パイプラインステータス更新などの GitLab API ラッパーが含まれます。
-   **GitLab Runner (アダプター) の開発:**
    -   GitLab CI/CD パイプライン上で動作する新しい `GitLab Bot Runner` を開発します。
    -   この Runner は、GitLab のイベント (Merge Request 作成・更新、コメント投稿など) をトリガーとし、`GitLabVCSClient` を使用して GitLab と通信し、収集した情報を Processor に渡します。
-   **イベントトリガーの対応:**
    -   GitLab CI/CD の `rules` や `workflow` を使用して、GitHub Actions と同等のイベントトリガーを設定します。
-   **API と機能の差異吸収:**
    -   GitLab API のエンドポイント、認証方法、リクエスト/レスポンス形式に対応します。
    -   GitHub の "Checks API" や "Resolve conversation" に相当する GitLab の機能 (例: Merge Request のパイプラインステータス、ディスカッションの解決機能) との連携方法を設計・実装します。
-   **設定ファイルの管理:**
    -   GitLab リポジトリ内での設定ファイルの配置場所や読み込み方法を定義します。
-   **インタラクション (`@bot`) の実現:**
    -   GitLab のコメントシステムで `@bot` メンションを検知し、同様のインタラクションフローを実現する方法を検討します。

`Processor` 自体は VCS プラットフォームに依存しない設計であるため、`Runner` が適切な情報を提供できれば、GitLab 環境でも共通して利用できる見込みです。GitLab への正式対応は将来的な課題となりますが、設計段階から拡張性を考慮しています。