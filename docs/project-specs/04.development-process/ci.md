# Continuous Integration (CI)

## 目的

本プロジェクトでは、コードの品質維持、バグの早期発見、およびリリースプロセスの自動化を目的として、継続的インテグレーション (CI) パイプラインを導入します。CIは、コード変更がリポジトリにプッシュされるたびに自動的に実行されます。

## 使用ツール

-   **Deno**: テスト実行、リンティング、ビルドタスクの実行環境として使用します。
-   **Biome**: コードフォーマットとリンティングに使用します (`deno task lint` 経由)。
-   **GitHub Actions**: CIパイプラインの実行プラットフォームとして使用します。

## CIパイプラインのステップ

CIパイプラインは以下のステップで構成されます。これらのステップは、通常、コードがリポジトリにプッシュされた際やプルリクエストが作成された際に実行されます。

1.  **セットアップ**:
    -   リポジトリのコードをチェックアウトします。
    -   指定されたバージョンのDeno環境をセットアップします。

2.  **リンティング (`deno task lint`)**:
    -   プロジェクトルートの `deno.jsonc` で定義された `lint` タスクを実行します。
    -   Biome を使用して、プロジェクト全体のコードスタイルと静的解析を行います。
    -   コードの一貫性を保ち、潜在的な問題を早期に検出します。

3.  **テスト実行 (`deno task test`)**:
    -   プロジェクトルートの `deno.jsonc` で定義された `test` タスクを実行します。
    -   `packages` ディレクトリ以下のすべてのテストを並列実行します。
    -   コードの正当性を検証します。

4.  **テストカバレッジチェック**:
    -   `deno test -A --coverage=./cov packages` を実行してテストを実行し、カバレッジデータを `./cov` ディレクトリに生成します。
    -   `deno coverage ./cov` を実行してカバレッジレポートを出力します。
    -   レポートの `total` 行から全体のカバレッジ率を抽出し、環境変数 `COVERAGE_THRESHOLD` で定義された閾値（デフォルト: 80%）と比較します。
    -   カバレッジ率が閾値を下回る場合、CIジョブは失敗します。これにより、テストの網羅性を一定以上に保ちます。
    -   **実装例 (GitHub Actions)**:
        ```yaml
        env:
          COVERAGE_THRESHOLD: 80 # Default coverage threshold
        # ... other steps
        - name: Check Coverage Threshold
          run: |
            COVERAGE_OUTPUT=$(deno coverage ./cov)
            echo "$COVERAGE_OUTPUT"
            COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep '^total' | awk '{print $2}' | sed 's/%//')

            if ! [[ "$COVERAGE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
              echo "Error: Could not extract coverage percentage."
              exit 1
            fi

            # Use environment variable for threshold
            THRESHOLD=${COVERAGE_THRESHOLD}
            echo "Current Coverage: $COVERAGE%"
            echo "Required Threshold: $THRESHOLD%"

            if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
              echo "Error: Code coverage is below the threshold ($THRESHOLD%)."
              exit 1
            else
              echo "Code coverage meets the threshold."
            fi
        ```

5.  **GitHub Actionのビルド (`deno task -C packages/action build`)**:
    -   `packages/action` ディレクトリに移動し、`deno.jsonc` で定義された `build` タスクを実行します。
    -   GitHub Actionとして配布するために必要なビルドプロセス（例: バンドル、依存関係の解決）を実行します。

## 実行トリガー

-   `main` ブランチへのプッシュ
-   すべてのプルリクエスト

## 注意事項

-   各ステップは、前のステップが成功した場合にのみ実行されます。
-   カバレッジ閾値は、GitHub Actions ワークフローの `env.COVERAGE_THRESHOLD` で設定され、プロジェクトの成熟度に応じて調整される可能性があります。