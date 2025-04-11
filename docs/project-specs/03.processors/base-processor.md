# BaseProcessor 実装仕様

## トリアージロジック

BaseProcessorは以下の条件でレビューの要否を判断します：

1. パッチが存在しない場合は常にスキップ
2. トークン制限を超える場合はスキップ
3. シンプルな変更の場合はスキップ

### シンプルな変更の定義

以下のみからなる変更は「シンプル」とみなされます：
- 空行の変更
- コメントの追加・修正（`//`, `/*`, `*`で始まる行）
- インデント等の整形のみ

## アスペクトベース分析

ファイル変更は「アスペクト」という概念で分類されます：

1. アスペクトはOverallSummaryから生成
2. 一つのファイルは複数のアスペクトに属する可能性あり
3. アスペクトの関連付けは重複を自動的に排除

## 必須の実装メソッド

実装者は以下の3つの抽象メソッドを必ず実装する必要があります：

### 1. summarize

```typescript
abstract summarize(
  prInfo: IPullRequestInfo,
  files: IFileChange[],
  config?: ReviewConfig
): Promise<Map<string, SummarizeResult>>;
```

- 各ファイルの初期トリアージを実施
- レビュー要否とその理由を判定
- ファイルごとの初期アスペクトを特定

### 2. generateOverallSummary

```typescript
abstract generateOverallSummary(
  prInfo: IPullRequestInfo,
  files: IFileChange[],
  summarizeResults: Map<string, SummarizeResult>
): Promise<OverallSummary | undefined>;
```

- プルリクエスト全体のコンテキストを分析
- ファイル間の関連性を特定
- アスペクトによる分類を生成

### 3. review

```typescript
abstract review(
  prInfo: IPullRequestInfo,
  files: IFileChange[],
  summarizeResults: Map<string, SummarizeResult>,
  config?: ReviewConfig,
  overallSummary?: OverallSummary
): Promise<IPullRequestProcessedResult>;
```

- レビュー対象と判定されたファイルのみを処理
- アスペクトに基づいたレビューを実施
- レビューコメントとPR更新情報を生成