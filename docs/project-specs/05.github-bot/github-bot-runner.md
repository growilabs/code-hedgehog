# GitHub Bot Runner 仕様

## 1. 目的

このドキュメントは、GitHub Actions 上で動作する **GitHub Bot Runner** (以下、Runner) の仕様を定義します。Runner は、GitHub プラットフォームと Code Hedgehog のコアレビューシステム (Processor) との間の **インターフェース** として機能し、GitHub 上でのシームレスな自動コードレビュー体験を実現することを目的とします。

## 2. 責務範囲

Runner は、GitHub との連携処理に特化した**インテグレーションレイヤー**としての役割を担います。主な責務は以下の通りです。

-   **GitHub イベントの受信と処理:** Pull Request の作成・更新やコメント投稿などの GitHub イベントをトリガーとして、レビュープロセスを開始またはインタラクションに応答します。
-   **必要なコンテキスト情報の収集と整形:** レビューに必要な情報 (PR情報, コード差分, 設定ファイル, 既存のコメント履歴など) を GitHub API 等を通じて収集し、Processor が解釈できる形式 (`ProcessInput`, `InteractionInput`) に整形します。これにより、Processor はレビューロジックに集中できます。
-   **Processor の選択と呼び出し:** 設定に基づいて適切な Processor (例: OpenAI, Dify) を選択し、整形したコンテキスト情報を渡してレビュー実行 (`process`) やインタラクション処理 (`handleInteraction`) を依頼します。
-   **Processor からの結果の受け取りと GitHub への投稿:** Processor から返されたレビューコメントやサマリー、応答メッセージを受け取り、GitHub のプルリクエストコメントや Checks API を通じてユーザーにフィードバックします。
-   **レビュー状態の管理とフィードバック:** GitHub Checks API を利用してレビューの進行状況 (実行中、完了、失敗など) を表示したり、GitHub の "Resolve conversation" 機能と連携して未解決の指摘数を表示したりすることで、レビュープロセス全体の可視性を高めます。
-   **ユーザーインタラクション (`@bot`) の受付と Processor への転送:** ユーザーがコメントで `@bot` をメンションした場合、その指示内容と関連情報を Processor に転送し、対話的なレビュープロセスを実現します。

## 3. トリガー

Runner の実行は、以下の GitHub Actions イベントによってトリガーされます。

-   **3.1. GitHub Actions イベント (必須)**
    -   `pull_request`: `opened`, `synchronize` (コード変更時) - 通常のレビュープロセスを開始します。
    -   `issue_comment`: `created` - コメント投稿時にトリガーされ、特に `@bot` メンションが含まれる場合にインタラクション処理を開始します。
-   **3.2. 手動トリガー (オプション)**
    -   特定のラベル (`review-request` など) の付与/削除。
    -   特定のコメント (`/review`, `/skip-review` など) の投稿。
    -   これらの手動トリガーは、必要に応じてワークフロー設定で追加できます。

## 4. コンテキスト収集と整形

Runner は、Processor がレビューや応答生成に必要な情報を収集し、適切な形式に整形します。

-   **4.1. 基本情報:** トリガーとなったイベントペイロードから、PR 番号、リポジトリ情報 (オーナー、リポジトリ名)、コミット SHA、コメント情報 (ID, 本文, 投稿者) などを抽出します。
-   **4.2. 差分情報 (`IFileChange[]`) の取得:** `VCS Client` (GitHub API ラッパー) を使用して、レビュー対象となるコードの差分情報を取得します。これには、ファイルパス、変更の種類、具体的な差分 (patch) が含まれます。
-   **4.3. 設定ファイルの読み込みとマージ:** リポジトリ内の設定ファイル (`.codehedgehog/review.yaml` など) と Action の入力設定 (`action.yml` 経由) を読み込み、マージします。これにより、プロジェクトごとや実行ごとのレビュー設定を適用します。詳細は [パスベース設定システム仕様](../02.core/path-based-config.md) を参照してください。
-   **4.4. コメント履歴 (`CommentInfo[]`) の取得:** `VCS Client` を使用して、現在のプルリクエストに存在する既存のレビューコメント (`pull_request_review_comment`) と PR コメント (`issue_comment`) を取得します。これには、コメント ID, 本文, 投稿者, 投稿日時, 関連ファイルパス, 行番号, スレッドの親子関係 (`in_reply_to_id`) などの情報が含まれ、Processor が過去の議論の文脈を理解するために重要です。
-   **4.5. Processor 向け入力形式への整形:** 上記で収集した情報を、Processor のインターフェース (`IPullRequestProcessor`) が要求する入力形式 (`ProcessInput` または `InteractionInput`) にまとめます。
    -   `ProcessInput`: 通常レビュー用。PR情報, ファイル差分リスト, マージ済み設定, コメント履歴リストを含みます。
    -   `InteractionInput`: インタラクション用。`ProcessInput` の情報に加え、ユーザーの指示内容、対象となったコメント情報などを含みます。

## 5. Processor 連携

Runner は、収集・整形したコンテキスト情報を Processor に渡し、実際のレビュー処理や応答生成を依頼します。

-   **5.1. `process` メソッド呼び出し (通常レビュー):** `pull_request` イベントでトリガーされた場合、`ProcessInput` を引数として Processor の `process` メソッドを呼び出します。Processor はこの情報をもとにコードレビューを実行し、結果 (`ProcessOutput`) を返します。
-   **5.2. `handleInteraction` メソッド呼び出し (インタラクション):** `issue_comment` イベントで `@bot` メンションが検出された場合、`InteractionInput` を引数として Processor の `handleInteraction` メソッドを呼び出します (Processor がこのメソッドを実装している場合)。Processor はユーザーの指示を解釈し、応答 (`InteractionOutput`) を生成します。

## 6. 結果の処理と投稿

Runner は、Processor から返された結果を GitHub 上でユーザーに分かりやすく表示します。

-   **6.1. Processor からの出力 (`ProcessOutput`, `InteractionOutput`) の受信:** レビューコメントのリスト、PR全体のサマリー、またはインタラクションへの応答メッセージを受け取ります。
-   **6.2. レビューコメントの投稿:** `VCS Client` を介して GitHub API を呼び出し、レビューコメントを投稿します。
    -   **新規指摘 (`ProcessOutput.comments`):** Processor が生成した新しい指摘は、該当するコード行に対する**新しいレビューコメント**として投稿されます。
    -   **応答 (`InteractionOutput.reply`):** `@bot` への応答は、ユーザーの元のコメントに対する**返信 (Reply)** として投稿され、GitHub のスレッド機能を活用します。
-   **6.3. Checks API の更新:** GitHub Checks API を利用して、レビュープロセスの状態をユーザーにフィードバックします。
    -   **実行ステータス:** レビュー開始時に `in_progress`、完了時に `completed` (成功/失敗/スキップ) を設定します。
    -   **サマリー:** Processor から返された PR 全体のサマリー (`ProcessOutput.summary`) や、後述する未解決の指摘数を表示します。
    -   **Conclusion:** エラー発生時や設定に応じて `failure` や `skipped` を設定します。

## 7. 状態管理とフィードバック

Runner は、レビュープロセス全体の状況を追跡し、ユーザーに進捗や結果を可視化します。

-   **7.1. レビュー状況表示 (Checks API):** 上記 6.3 の通り、Checks API を用いてリアルタイムな実行状況を提供します。
-   **7.2. 指摘解決追跡 (Resolve Conversation 連携):** GitHub の "Resolve conversation" 機能と連携し、Bot が投稿した指摘の解決状況を追跡します。
    -   **未解決スレッド数のカウント:** 定期実行や Webhook (将来的な可能性) をトリガーに、`VCS Client` を介して Bot が起点となった未解決のレビューコメントスレッド数をカウントします。
    -   **Checks API サマリーへの反映:** カウントした未解決数を Check Run のサマリーに表示します (例: "Code Review: 3 unresolved issues remaining.")。
    -   **Conclusion 制御 (オプション):** 設定ファイルにより、未解決の指摘がある場合に Check Run の `conclusion` を `failure` に設定することも可能です。これにより、レビュー完了の基準を強制できます。

## 8. インタラクション処理 (`@bot`)

ユーザーがレビューコメントに対して `@bot` をメンションすることで、対話的なレビュープロセスを実現します。

-   **8.1. `issue_comment` トリガーによる起動:** ユーザーが `@bot` を含むコメントを投稿すると、専用の GitHub Action ワークフローが起動します。
-   **8.2. コメント内容の解析:** Runner はコメント本文を解析し、ユーザーの指示内容 (例: "explain", "suggest") と、どのコメントに対する指示なのか (対象コメント ID) を特定します。
-   **8.3. 関連コンテキスト収集:** 指示内容と対象コメントに関連する情報 (PR情報, コード差分, 周辺のコメント履歴など) を収集します。
-   **8.4. `handleInteraction` 呼び出しと応答の返信投稿:** 収集した情報と指示内容を `InteractionInput` としてまとめ、Processor の `handleInteraction` メソッドを呼び出します。Processor から返された応答メッセージを、元のコメントへの返信として投稿します。

## 9. アーキテクチャと処理フロー (Runner 視点)

(overview.md から関連図を移管・調整 - このセクションは図の移管後に内容を記述)
*ここにアーキテクチャ図と処理フロー図を Mermaid 形式で記述*

## 10. 実装詳細 (参考)

本仕様の主要な実装は `packages/action/src/runner.ts` 内で行われます。各機能がどの部分で実装されているか、または実装される予定かを示します (例: コンテキスト収集は `run` メソッド内、Processor 呼び出しは `createProcessor` と `run` メソッド内など)。