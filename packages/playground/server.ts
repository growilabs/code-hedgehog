import { type Context, Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ActionRunner } from '../action/src/runner.ts';

const app = new Hono();
const PORT = Number.parseInt(Deno.env.get('PORT') || '8000');
const HOST = Deno.env.get('HOST') || '0.0.0.0'; // 環境変数で制御

const isProduction = Deno.env.get('DENO_ENV') === 'production';

// Vite environmentにおいて、`VITE_` プレフィックス付きの環境変数はビルド時にフロントエンドコードへ静的に埋め込まれます。
// 実行環境ごと（例: 開発、ステージング、本番）に異なる値を動的に設定したい場合、この方法では対応できません
// （ビルド後のイメージでは値が固定されてしまうため）。
// そのため、ここではサーバーサイド (server.ts) で実行時環境変数 (`OWNERS`) を読み込み、
// それをAPI経由でフロントエンドに提供する方式を採用しています。
// これにより、Kubernetes manifestなどで実行時に値を注入し、フロントエンドで動的に利用することが可能になります。
const getOwnersHandler = (c: Context) => {
  try {
    // 問題切り分けのため、一時的に固定レスポンスを返す
    console.log('/api/config/owners called, sending fixed response');

    const ownersEnv = Deno.env.get('OWNERS');
    if (!ownersEnv) {
      console.warn('OWNERS environment variable is not set.');
      return c.json({ owners: [] });
    }
    const owners = ownersEnv.split(',');
    return c.json({ owners });
  } catch (error) {
    console.error('Error in /api/config/owners:', error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

app.get('/api/config/owners', getOwnersHandler);

const runProcessorSchema = z.object({
  githubToken: z.string(),
  owner: z.string(),
  repo: z.string(),
  number: z.string(),
});

const route = app.post(
  '/api/run-processor',
  validator('json', (value, c) => {
    const parsed = runProcessorSchema.safeParse(value);
    if (!parsed.success) {
      return c.text('Invalid!', 401);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const { githubToken, owner, repo, number } = await c.req.valid('json');

      // Use in @code-hedgehog/action
      Deno.env.set('GITHUB_TOKEN', githubToken);
      Deno.env.set('GITHUB_REPOSITORY', `${owner}/${repo}`);
      Deno.env.set('GITHUB_PR_NUMBER', number);

      const config = {
        processor: Deno.env.get('CODE_HEDGEHOG_PROCESSOR') || 'dify',
        filter: { exclude: ['**/dist/**', 'deno.lock'], maxChanges: 300 },
      };

      const runner = new ActionRunner(config);
      const comments = await runner.run();

      return c.json({ comments });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
);

export type AppType = typeof route;

if (isProduction) {
  app.use('/*', serveStatic({ root: './dist' }));
}

Deno.serve({ port: PORT, hostname: HOST }, app.fetch);
