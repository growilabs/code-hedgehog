# BaseProcessor: コンテキストの利用と責務範囲

**重要:** このドキュメントは、現在の Code Hedgehog アーキテクチャにおける `BaseProcessor` (およびその派生クラス) が、どのようにコンテキスト情報を扱い、利用するかの基本方針を説明するものです。初期設計段階で検討された、プロセッサが Bot 内部のコンテキスト管理システムに直接アクセスするような古い構想とは異なり、現在の設計ではコンテキストは `Action Runner` から一方向的に提供されます。

関連ドキュメント:
-   [GitHub Bot 仕様](../../project-specs/05.github-bot/overview.md) (Botによるコンテキスト収集)
-   [レビューシステムの基本方針と非採用事項](../02.core/review-system/context.md) (Botとプロセッサの役割分担)
-   [コアタイプ: プロセッサ](../../project-specs/01.core-types/processor.md) (`IPullRequestProcessor`, `ProcessInput` 等の定義)

---

## 1. 基本方針: プロセッサへのコンテキスト提供

`BaseProcessor` およびそれを継承する具体的なプロセッサ（例: `OpenaiProcessor`）は、レビュー処理やインタラクション処理の実行に必要な全てのコンテキスト情報を、`Action Runner` から提供されるデータ構造を通じて受け取ります。

-   **レビュー処理 (`process` メソッド):**
    -   `Action Runner` は、収集したプルリクエスト情報 (`IPullRequestInfo`)、変更されたファイルの情報 (`IFileChange[]`)、関連するコメント履歴 (`CommentInfo[]`)、および適用される設定 (`ReviewConfig`) などを `ProcessInput` オブジェクトにまとめて、プロセッサの `process` メソッドに渡します。
-   **インタラクション処理 (`handleInteraction` メソッド):**
    -   同様に、ユーザーとのインタラクションを処理する際には、必要な情報が `InteractionInput` オブジェクトとして `handleInteraction` メソッドに渡されます。

`BaseProcessor` は、これらの入力オブジェクトに含まれる情報を利用して、後述する内部処理ステップを実行します。

## 2. プロセッサ内部でのコンテキスト活用

`BaseProcessor` は、`process` メソッドの内部で、一般的に以下の3つの主要なステップを順次実行することでレビュー処理を行います。各ステップでは、`Action Runner` から提供されたコンテキスト情報が活用されます。

1.  **`summarize(prInfo, files, config)`:**
    -   **目的:** 個々のファイル変更に対する初期分析、トリアージ、軽量なサマリー生成。
    -   **利用コンテキスト:**
        -   `prInfo`: PRのタイトルや説明など、全体的な文脈を把握するために利用。
        -   `files`: 各ファイルの差分情報 (`patch`) を基に分析。
        -   `config`: パスベースの指示 (`path_instructions`) や、このステップで使用するAIモデル、プロンプトテンプレートなどの設定。
    -   **出力:** 各ファイルパスをキーとし、分析結果 (`SummarizeResult`) を値とするマップ。`SummarizeResult` には、レビュー要否の判断、簡単な要約、関連する可能性のある「アスペクト」の初期情報などが含まれ得ます。

2.  **`generateOverallSummary(prInfo, files, config, summarizeResults)`:**
    -   **目的:** `summarize` ステップの結果を統合し、プルリクエスト全体の変更に関する集約的な概要、主要な変更点、ファイル間の関連性、潜在的なリスクなどを把握・生成。
    -   **利用コンテキスト:**
        -   `prInfo`, `files`, `config`: `summarize` と同様。
        -   `summarizeResults`: 前ステップで生成された各ファイルの分析結果。
    -   **出力:** PR全体の概要情報 (`OverallSummary`)。これには、PRの目的、主要な変更コンポーネント、影響範囲、注意すべき点などが含まれ得ます。

3.  **`review(prInfo, files, config, summarizeResults, overallSummary)`:**
    -   **目的:** 詳細なレビューコメントの生成。
    -   **利用コンテキスト:**
        -   `prInfo`, `files`, `config`: `summarize` と同様。
        -   `summarizeResults`: 各ファイルの初期分析結果。特定のファイルに対するレビューの深さや観点を調整するために利用。
        -   `overallSummary`: PR全体の概要。個々の指摘がPR全体の文脈の中でどのような意味を持つかを示すために利用。
        -   `commentHistory` (主に `ProcessInput` 経由で間接的に利用可能): 既存のコメント履歴を参照し、重複した指摘を避けるなどの目的で利用。
    -   **出力:** レビューコメントのリスト (`IReviewComment[]`) を含む `IPullRequestProcessedResult`。

これらのメソッドは `BaseProcessor` で抽象メソッドまたは基本的な実装として提供され、具体的なプロセッサ (例: `OpenaiProcessor`) がそれぞれのAIモデルやプロンプト戦略に合わせてオーバーライドします。

## 3. BaseProcessor (および派生クラス) が行わないコンテキスト管理

現在のアーキテクチャにおいて、`BaseProcessor` は以下のコンテキスト管理関連の操作を**行いません**。

-   **Bot 内部のコンテキストデータベースへの直接アクセス・操作:**
    -   プロセッサが Bot 側に存在する可能性のある独自のデータベース（レビュー履歴DB、コメントチェーンDBなど）に直接クエリを発行したり、データを書き込んだりすることはありません。
-   **Bot 側の `ContextProvider` モジュールの利用:**
    -   旧設計案で想定されていたような、Bot 内部のコンテキスト管理モジュール (`ContextProvider`) をプロセッサが呼び出してコンテキストを取得・操作する仕組みは存在しません。
-   **Bot へのコンテキスト更新要求の送信:**
    -   プロセッサはレビュー結果 (`ProcessOutput` や `InteractionOutput`) を `Action Runner` に返すのみであり、Bot が管理する永続的なコンテキスト情報を能動的に更新するような要求は行いません。コメントの投稿などは `Action Runner` が結果を受けて行います。
-   **Bot レベルのコンテキスト状態の直接的な変更:**
    -   プロセッサは提供されたコンテキストを読み取り専用として扱い、その処理結果を返します。Bot 側の状態を直接変更するような副作用は持ちません。

## 4. 設定ファイルによるコンテキスト利用の制御

`BaseProcessor` およびその派生クラスは、`.coderabbitai.yaml` などの設定ファイルから読み込まれる `ReviewConfig` を利用します。この設定は、プロセッサがコンテキスト情報をどのように解釈し、利用するかに影響を与えます。

-   **パスベースの指示 (`path_instructions`):** 特定のファイルパスやパターンに対して、レビューの深さ、無視するルール、特定の観点などを指示できます。
-   **プロンプトパラメータ:** プロセッサがAIモデルに送信するプロンプトの内容を調整するためのパラメータ（例: レビューの厳しさ、重点項目など）。
-   **モデル選択:** `summarize`, `generateOverallSummary`, `review` の各ステップで使用するAIモデルの指定。
-   **トークン管理設定:** AIモデルのトークン制限を考慮した処理を行うための設定。

これらの設定を通じて、プロジェクトやレビューの目的に応じて、プロセッサによるコンテキストの活用方法をカスタマイズできます。

## 結論

`BaseProcessor` は、`Action Runner` から提供されるコンテキスト情報を入力とし、設定に基づいて内部的な処理ステップ (主に `summarize`, `generateOverallSummary`, `review`) を実行することで、レビュー結果を生成する責務を担います。Bot 内部の永続的なコンテキスト管理には関与せず、提供された情報を元に自律的に処理を行います。この明確な役割分担により、システムの関心事が分離され、各コンポーネントの独立性と保守性が高められています。
