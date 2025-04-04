# OpenAI Responses API チートシート

## 基本概念

Responses APIは、OpenAIのモデルを使用してさまざまな形式の入力から応答を生成するためのインターフェースです。

## 主な機能

### リクエスト生成

```typescript
import OpenAI from "@openai/openai";

const openai = new OpenAI();

// 非ストリーミングレスポンス
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [
    { 
      role: "user", 
      content: "Hello!",
      type: "message"
    }
  ]
});

// ストリーミングレスポンス
const stream = await openai.responses.create({
  model: "gpt-4o",
  input: [
    { 
      role: "user", 
      content: "Hello!",
      type: "message"
    }
  ],
  stream: true
});
```

## レスポンス形式

### プレーンテキスト出力

```typescript
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [
    { 
      role: "user", 
      content: "Hello!",
      type: "message"
    }
  ],
  text: { 
    format: { 
      type: "text" 
    } 
  }
});
```

### 構造化出力 (JSON)

```typescript
import { zodResponseFormat } from "@openai/openai/helpers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number()
});

const responseFormat = zodResponseFormat(schema, 'user_info');

const response = await openai.responses.create({
  model: "gpt-4o",
  input: [{ 
    role: "user", 
    content: "Get user info",
    type: "message"
  }],
  text: {
    format: {
      name: responseFormat.json_schema.name,
      type: responseFormat.type,
      schema: responseFormat.json_schema.schema
    }
  }
});

// レスポンスの解析
try {
  const parsedData = schema.parse(JSON.parse(response.output_text));
  console.log("検証済みデータ:", parsedData);
} catch (error) {
  console.error("データの検証に失敗:", error);
}
```

### レスポンス形式の型定義

```typescript
interface ResponseTextConfig {
  /**
   * テキスト出力のフォーマット設定。以下のオプションがあります：
   * - プレーンテキスト: { type: "text" }
   * - JSON Schema: { type: "json_schema", name: string, schema: object }
   */
  format: ResponseFormatText | ResponseFormatJSONSchema;
}

interface ResponseFormatText {
  type: "text";
}

interface ResponseFormatJSONSchema {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
}
```

## レスポンス処理

### レスポンス型の構造

```typescript
interface Response {
  id: string;
  created_at: number;
  model: string;
  // 生成されたテキスト
  output_text: string;
  // 詳細な出力内容
  output: Array<ResponseOutputItem>;
  // レスポンスのステータス
  status: "completed" | "failed" | "in_progress" | "incomplete";
  // エラー情報（存在する場合）
  error: ResponseError | null;
}

// レスポンス処理の例
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [{ 
    role: "user", 
    content: "Hello!",
    type: "message"
  }]
});

// ステータスチェックとエラー処理
if (response.status === "completed") {
  console.log(response.output_text);
} else if (response.error) {
  console.error("エラー:", response.error);
} else if (response.status === "incomplete") {
  console.warn("不完全なレスポンス");
}
```

### ストリーミングレスポンスのイベント処理

```typescript
const stream = await openai.responses.create({
  model: "gpt-4o",
  input: [{ 
    role: "user", 
    content: "Hello!",
    type: "message"
  }],
  stream: true
});

for await (const chunk of stream) {
  switch (chunk.type) {
    case "response.text.delta":
      // テキストの部分更新
      console.log("テキスト更新:", chunk.delta);
      break;
    case "response.text.done":
      // テキスト生成完了
      console.log("生成完了");
      break;
    case "response.error":
      // エラー発生
      console.error("エラー:", chunk.error);
      break;
  }
}
```

### ツールの利用

```typescript
// 関数呼び出し
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [
    { 
      role: "user", 
      content: "What's the weather?",
      type: "message"
    }
  ],
  tools: [{
    type: "function",
    name: "get_weather",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" }
      }
    },
    strict: true
  }]
});

// ファイル検索
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [
    { 
      role: "user", 
      content: "Find relevant documents",
      type: "message"
    }
  ],
  tools: [{
    type: "file_search",
    vector_store_ids: ["store-id"]
  }]
});
```

## 主要なインターフェース

### ResponseInputItem

メッセージ入力の基本形式:

```typescript
interface ResponseInputItem {
  role: "user" | "assistant" | "system" | "developer";
  content: string | ResponseInputMessageContentList;
  type: "message";
}
```

### レスポンス設定オプション

```typescript
interface ResponseCreateParams {
  model: string;
  input: ResponseInputItem[];
  temperature?: number;
  max_output_tokens?: number;
  tool_choice?: ToolChoiceOptions | ToolChoiceTypes | ToolChoiceFunction;
  tools?: Tool[];
  text?: ResponseTextConfig;
  stream?: boolean;
}
```

### Tool型

利用可能なツール:

```typescript
type Tool = 
  | FileSearchTool    // ファイル検索
  | FunctionTool     // カスタム関数実行
  | ComputerTool     // 仮想コンピュータ制御
  | WebSearchTool    // Web検索
```

## 詳細情報

- [OpenAI Responses APIドキュメント](https://platform.openai.com/docs/api-reference/responses)
- [構造化出力ガイド](https://platform.openai.com/docs/guides/structured-outputs)
- [ツール使用ガイド](https://platform.openai.com/docs/guides/tools)