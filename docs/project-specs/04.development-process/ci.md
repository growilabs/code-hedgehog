# Continuous Integration (CI)

## 目的

本プロジェクトでは、コードの品質維持、バグの早期発見、およびリリースプロセスの自動化を目的として、継続的インテグレーション (CI) パイプラインを導入します。CIは、コード変更がリポジトリにプッシュされるたびに自動的に実行されます。

## 使用ツール

-   **Deno**: テスト実行、リンティング、ビルドタスクの実行環境として使用します。
-   **Biome**: コードフォーマットとリンティングに使用します (`deno task lint` 経由)。
-   **GitHub Actions**: CIパイプラインの実行プラットフォームとして使用します。

## CIパイプラインのステップ

CIパイプラインは `test` と `build` の2つのジョブで構成されます。`build` ジョブは `test` ジョブが成功した場合にのみ実行されます。これらのジョブは、通常、コードがリポジトリにプッシュされた際やプルリクエストが作成された際に実行されます。

### `test` ジョブ

1.  **セットアップ**:
    -   リポジトリのコードをチェックアウトします (`actions/checkout`)。
    -   指定されたバージョンのDeno環境をセットアップします (ローカルの Composite Action `./.github/actions/setup-deno` を使用)。

2.  **リンティング (`deno task lint`)**:
    -   プロジェクトルートの `deno.jsonc` で定義された `lint` タスクを実行します。
    -   Biome を使用して、プロジェクト全体のコードスタイルと静的解析を行います。
    -   コードの一貫性を保ち、潜在的な問題を早期に検出します。

3.  **テスト実行とカバレッジ生成 (`deno task test:cov`)**:
    -   プロジェクトルートの `deno.jsonc` で定義された `test:cov` タスクを実行します。
    -   これにより、テストが実行され、カバレッジデータが `./cov` ディレクトリに生成されます。
    -   内部的に `deno coverage ./cov --lcov` が実行され、LCOV形式のレポート (`./cov/lcov.info`) も生成されます。
    -   コードの正当性を検証し、テストの網羅性を測定します。

4.  **テストカバレッジ閾値チェック**:
    -   `VeryGoodOpenSource/very_good_coverage` GitHub Action を使用して、生成された LCOV レポート (`./cov/lcov.info`) を基にカバレッジ率をチェックします。
    -   環境変数 `COVERAGE_THRESHOLD` で定義された閾値（デフォルト: 80%）と比較します。
    -   カバレッジ率が閾値を下回る場合、CIジョブは失敗します。これにより、テストの網羅性を一定以上に保ちます。
    -   **実装例 (GitHub Actions)**:
        ```yaml
        env:
          COVERAGE_THRESHOLD: 80 # Default coverage threshold
        # ... other steps
        - name: Run Tests with Coverage
          run: deno task test:cov # テスト実行とLCOVを含むカバレッジデータを生成

        - name: Check Coverage Threshold
          uses: VeryGoodOpenSource/very_good_coverage@v2
          with:
            path: ./cov/lcov.info # LCOVレポートのパス
            min_coverage: ${{ env.COVERAGE_THRESHOLD }} # 最小カバレッジ閾値
        ```

### `build` ジョブ (`needs: test`)

1.  **セットアップ**:
    -   `test` ジョブと同様に、リポジトリのチェックアウトと Deno のセットアップを行います。

2.  **GitHub Actionのビルド (`deno task build:action`)**:
    -   プロジェクトルートの `deno.jsonc` で定義された `build:action` タスクを実行します。
    -   GitHub Actionとして配布するために必要なビルドプロセス（例: バンドル、依存関係の解決）を実行します。

## 実行トリガー

-   `main` ブランチへのプッシュ
-   すべてのプルリクエスト

## 注意事項

-   各ステップは、前のステップが成功した場合にのみ実行されます。
-   カバレッジ閾値は、GitHub Actions ワークフローの `env.COVERAGE_THRESHOLD` で設定され、プロジェクトの成熟度に応じて調整される可能性があります。