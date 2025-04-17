# コンテキスト管理の仕様

## 1. 概要

code-hedgehogのコンテキスト管理システムは、高品質なコードレビューを実現するための基盤となるシステムです。
レビューの文脈を理解・管理し、より深い洞察と効率的なレビュープロセスを実現します。

### 1.1 背景と意図

コンテキスト管理システムは、以下の課題認識から設計されました：

1. **部分的な理解の限界**
   - 個々のファイルの変更だけを見ても、その意図や影響範囲を正確に理解することは困難
   - 関連する変更やシステム全体への影響を把握する必要がある
   - レビュー時に必要な背景情報を効率的に収集・活用したい

2. **一貫性のある判断の必要性**
   - 同様の変更に対して一貫したレビューコメントを提供したい
   - レビュー基準をコンテキストに応じて適切に調整したい
   - 重複や矛盾する指摘を防止したい

3. **リソースの効率的な活用**
   - すべての変更を同じ深さでレビューすることは非効率
   - 変更の重要度や影響度に応じて、リソース（トークン、処理時間）を適切に配分したい
   - インクリメンタルな処理で効率を向上させたい

### 1.2 設計思想

コンテキスト管理は、以下の原則に基づいて設計されています：

1. **階層化された理解**
   - PR全体、ファイル単位、変更単位という3つの層でコンテキストを管理
   - 各層で適切な粒度の情報を収集・分析
   - 層間の関係性を明確に定義

2. **インクリメンタルな処理**
   - 軽量な分析から開始し、必要に応じて詳細な分析を実施
   - 前回のレビュー結果を活用して重複を防止
   - バッチ処理による効率的な文脈理解

3. **拡張可能なアーキテクチャ**
   - プロセッサーによる独自のコンテキスト管理の実装
   - パスベースの柔軟な設定
   - 外部システムとの連携ポイントの提供

## 2. コンテキストの階層構造

### 2.1 PRレベルのコンテキスト [実装済]

PRレベルのコンテキストは、変更全体を理解するための情報を管理します。

```typescript
interface IPullRequestInfo {
  title: string;        // PRのタイトル
  description: string;  // PRの説明文
  author: string;      // 作成者
  // 他の基本情報
}

interface OverallSummary {
  description: string;   // 変更の全体像
  aspectMappings: Array<{
    aspect: {
      key: string;         // アスペクトの識別子
      description: string; // アスペクトの説明
      impact: 'high' | 'medium' | 'low';  // 影響度
    };
    files: string[];     // 関連するファイル
  }>;
  crossCuttingConcerns?: string[];  // 横断的な懸念事項
}
```

このレベルでは以下の情報を管理します：

1. **PR基本情報**
   - 変更の目的と概要
   - 作成者の意図
   - 関連するイシューやタスク
   
   これらの情報は、レビューの文脈を理解する起点となります。変更がなぜ必要なのか、どのような問題を解決しようとしているのかを把握することで、適切なレビュー基準を設定できます。

2. **変更の全体像**
   - 主要な変更点の特定
   - アスペクトごとの影響度評価
   - クロスカッティングな問題の把握
   
   全体像の理解により、個々の変更をより広い文脈で評価できます。例えば、パフォーマンス改善のためのリファクタリングなのか、新機能の追加なのかによって、レビューの観点や深度を調整します。

3. **マルチパス分析**
   ```typescript
   // 2パスでの分析実装例
   const BATCH_SIZE = 2;  // バッチサイズ
   const PASSES = 2;      // 分析パス数
   
   // 水平方向の分析（1パス目）
   const horizontalBatches = createHorizontalBatches(entries, BATCH_SIZE);
   
   // 垂直方向の分析（2パス目）
   const verticalBatches = createVerticalBatches(entries, BATCH_SIZE);
   ```
   
   異なる視点からの分析により、より深い理解と関連性の発見を可能にします。

### 2.2 ファイルレベルのコンテキスト

ファイルレベルでは、個々のファイルの変更を文脈化します。

1. **パス設定** [実装済]
   ```typescript
   interface PathInstruction {
     path: string;        // Globパターン
     instructions: string; // レビュー指示
   }
   ```
   
   パスベースの設定により：
   - ファイルの種類に応じたレビュー基準の適用
   - 重要度に基づく注目ポイントの指定
   - カスタマイズ可能なレビュー指示

2. **アスペクト管理** [実装済]
   ```typescript
   interface SummarizeResult {
     needsReview: boolean;   // 詳細レビューの要否
     reason: string;         // 判断理由
     aspects: Array<{        // 関連するアスペクト
       key: string;
       description: string;
       impact: 'high' | 'medium' | 'low';
     }>;
   }
   ```
   
   アスペクトベースの分析により：
   - 変更の性質を分類
   - 関連するコンポーネントや機能の特定
   - 影響度の評価

3. **変更の分類** [実装済]
   ```typescript
   class BaseProcessor {
     protected isSimpleChange(patch: string): boolean {
       // コメントや整形のみの変更を判定
     }
     
     protected shouldPerformDetailedReview(
       file: IFileChange,
       tokenConfig: TokenConfig
     ): Promise<SummarizeResult>;
   }
   ```
   
   変更の性質に基づく分類により：
   - リソースの効率的な配分
   - 重要な変更への注力
   - 軽微な変更の効率的な処理

### 2.3 変更レベルのコンテキスト [実装済]

最も詳細なレベルで、個々の変更の意味を理解します。

1. **トークン管理**
   ```typescript
   interface TokenConfig {
     margin: number;    // 余裕分
     maxTokens: number; // 上限
   }
   ```
   
   トークンベースの制御により：
   - API制限内での効率的な処理
   - 大規模な変更の適切な分割
   - コストの最適化

2. **バッチ処理**
   - 関連する変更のグループ化
   - 段階的な分析の実現
   - 結果の統合と最適化

## 3. コンテキスト処理フロー

### 3.1 3フェーズレビュー [実装済]

コンテキスト管理は3つのフェーズで実行されます：

1. **Summarize フェーズ**
   ```typescript
   abstract summarize(
     prInfo: IPullRequestInfo,
     files: IFileChange[],
     config?: ReviewConfig
   ): Promise<Map<string, SummarizeResult>>;
   ```
   
   このフェーズでは：
   - 軽量な初期分析を実行
   - レビューの必要性を判断
   - リソースの効率的な配分を決定

2. **Overall Summary フェーズ**
   ```typescript
   protected abstract generateOverallSummary(
     prInfo: IPullRequestInfo,
     files: IFileChange[],
     summarizeResults: Map<string, SummarizeResult>
   ): Promise<OverallSummary | undefined>;
   ```
   
   このフェーズでは：
   - PR全体の文脈を理解
   - アスペクト間の関連を分析
   - クロスカッティングな問題を特定

3. **Review フェーズ**
   ```typescript
   abstract review(
     prInfo: IPullRequestInfo,
     files: IFileChange[],
     summarizeResults: Map<string, SummarizeResult>,
     config?: ReviewConfig,
     overallSummary?: OverallSummary
   ): Promise<IPullRequestProcessedResult>;
   ```
   
   このフェーズでは：
   - 文脈を考慮した詳細レビュー
   - 関連する指摘の集約
   - 一貫性のある指摘の生成

### 3.2 インクリメンタル処理 [実装済]

効率的な処理のために、以下の最適化を実装：

1. **バッチ処理**
   ```typescript
   // 水平方向のバッチ処理
   function createHorizontalBatches<T>(
     items: T[],
     batchSize: number
   ): T[][] {
     // 関連する項目をグループ化
   }
   
   // 垂直方向のバッチ処理
   function createVerticalBatches<T>(
     items: T[],
     batchSize: number
   ): T[][] {
     // 異なる視点での再グループ化
   }
   ```

2. **結果の統合**
   ```typescript
   function mergeOverallSummaries(
     summaries: OverallSummary[]
   ): OverallSummary {
     // バッチ処理結果の統合
     // アスペクトの結合
     // 影響度の調整
   }
   ```

## 4. 拡張ポイント

### 4.1 カスタム分析 [実装済]

プロセッサーは以下の方法で独自の分析を実装できます：

1. **アスペクト定義**
   ```typescript
   interface CustomAspect {
     key: string;
     description: string;
     impact: 'high' | 'medium' | 'low';
     customFields?: Record<string, unknown>;
   }
   ```

2. **分析ロジック**
   ```typescript
   class CustomProcessor extends BaseProcessor {
     protected override async generateOverallSummary(
       // カスタムな文脈理解の実装
     }
   }
   ```

### 4.2 将来の拡張計画 [検討中]

1. **コメントチェーン管理**
   ```typescript
   interface CommentChain {
     parent: {
       id: string;
       body: string;
       path: string;
       position: number;
     };
     replies: Array<{
       id: string;
       body: string;
       in_reply_to: string;
     }>;
     meta: {
       status: 'open' | 'resolved';
       context: ReviewContext;
     };
   }
   ```

   期待される効果：
   - 議論の文脈の保持と追跡
   - レビュー状態の明確な管理
   - 関連コメントの整理と集約

   実装の主なポイント：
   - コメントの階層構造の管理
   - 状態遷移の追跡
   - 関連性の維持

2. **垂直的コンテキスト分析**
   ```typescript
   interface VerticalContext {
     definitions: {
       functions: FunctionDefinition[];
       classes: ClassDefinition[];
     };
     dependencies: {
       internal: string[];  // ファイル内の依存
       external: string[];  // 外部への依存
     };
     impactAnalysis: {
       direct: string[];   // 直接的な影響
       indirect: string[]; // 間接的な影響
     };
   }
   ```

   期待される効果：
   - コードの構造的理解の深化
   - 影響範囲の正確な把握
   - 結合度の評価

   実装の主なポイント：
   - AST解析との連携
   - 依存関係の追跡
   - 影響分析のアルゴリズム

3. **リソース最適化**
   ```typescript
   interface CacheStrategy {
     storage: {
       type: 'memory' | 'persistent';
       ttl: number;
     };
     policies: {
       maxSize: number;
       evictionPolicy: 'lru' | 'fifo';
     };
     monitoring: {
       hitRate: number;
       size: number;
     };
   }
   ```

   期待される効果：
   - レスポンス時間の改善
   - リソース使用の効率化
   - API制限の遵守

   実装の主なポイント：
   - キャッシュ戦略の実装
   - メモリ管理の最適化
   - モニタリングの実装

4. **外部システム連携**
   ```typescript
   interface ExternalIntegration {
     ci: {
       buildStatus: string;
       testResults: TestResult[];
     };
     notifications: {
       channels: string[];
       rules: NotificationRule[];
     };
   }
   ```

   期待される効果：
   - 開発プロセスとの統合
   - 情報の集約と活用
   - 自動化の促進

   実装の主なポイント：
   - APIインテグレーション
   - イベント管理
   - エラー処理

5. **履歴分析の強化**
   ```typescript
   interface HistoricalAnalysis {
     patterns: {
       common: Pattern[];
       emerging: Pattern[];
     };
     trends: {
       improvements: Trend[];
       regressions: Trend[];
     };
   }
   ```

   期待される効果：
   - パターンの発見と活用
   - 品質の継続的改善
   - 問題の早期発見

   実装の主なポイント：
   - データ収集と分析
   - パターン認識
   - トレンド分析

これらの拡張は、以下の優先順位で実装を検討します：

1. コメントチェーン管理（短期）
   - レビュープロセスの透明性向上
   - 議論の追跡性改善
   - コミュニケーションの効率化

2. 垂直的コンテキスト分析（中期）
   - より深い技術的理解の促進
   - 影響範囲の正確な把握
   - リファクタリングの支援

3. リソース最適化（中期）
   - システム全体の応答性向上
   - コスト効率の改善
   - スケーラビリティの確保

4. 外部システム連携（長期）
   - 開発プロセス全体との統合
   - 自動化の促進
   - 情報共有の効率化

5. 履歴分析（長期）
   - 長期的な品質向上
   - 知識の蓄積と活用
   - プロアクティブな問題解決

## 5. 制限事項

### 5.1 現在の制限 [実装済]

1. **トークン制限**
   - 1ファイルあたりの最大トークン数: 4000
   - 必要なマージン: 100トークン
   - 分割処理の必要性

2. **処理制約**
   - バッチサイズの制限
   - 並行処理数の制限
   - タイムアウト設定

### 5.2 最適化のポイント [実装済]

1. **トークン使用の最適化**
   ```typescript
   function isWithinLimit(
     content: string,
     config: TokenConfig
   ): boolean {
     // トークン数の見積もり
     // 制限のチェック
   }
   ```

2. **バッチ処理の調整**
   - バッチサイズの動的調整
   - 処理順序の最適化
   - キャッシュの活用

## 6. 実装ガイドライン

### 6.1 プロセッサーの実装 [実装済]

プロセッサーを実装する際は：

1. **基本構造**
   ```typescript
   class YourProcessor extends BaseProcessor {
     constructor(config: YourConfig) {
       super();
       // 初期化処理
     }
     
     // 必須メソッドの実装
     override async summarize(...) { }
     protected override async generateOverallSummary(...) { }
     override async review(...) { }
   }
   ```

2. **エラー処理**
   - APIエラーの適切な処理
   - リトライロジックの実装
   - エラー状態の管理

### 6.2 設定と調整 [実装済]

1. **パス設定**
   ```typescript
   const config: ReviewConfig = {
     path_instructions: [
       {
         path: "src/**/*.ts",
         instructions: "TypeScriptファイルのレビュー基準..."
       }
     ],
     skipSimpleChanges: true
   };
   ```

2. **トークン設定**
   ```typescript
   const tokenConfig = {
     margin: 100,
     maxTokens: 4000
   };
   ```

この仕様書で定義されたコンテキスト管理システムにより、code-hedgehogは効率的で高品質なコードレビューを実現します。
システムの各コンポーネントは明確な責務を持ち、拡張性と保守性を確保しながら、実用的なレビュー支援を提供します。