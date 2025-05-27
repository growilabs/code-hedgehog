import { type Context, Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ActionRunner } from '../action/src/runner.ts';

const app = new Hono(); // メインアプリ
const PORT = Number.parseInt(Deno.env.get('PORT') || '8000');
const HOST = Deno.env.get('HOST') || '0.0.0.0';

const isProduction = Deno.env.get('DENO_ENV') === 'production';

const getOwnersHandler = (c: Context) => {
  try {
    // console.log('/api/config/owners called, sending fixed response'); // デバッグ用
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

const runProcessorSchema = z.object({
  githubToken: z.string(),
  owner: z.string(),
  repo: z.string(),
  number: z.string(),
});

// /api ルートグループ
const apiApp = new Hono();

// /api/config/owners ルート (直接 apiApp に定義)
apiApp.get('/config/owners', getOwnersHandler);

// /api/run-processor ルート
apiApp.post(
  '/run-processor',
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
      Deno.env.set('GITHUB_TOKEN', githubToken);
      Deno.env.set('GITHUB_REPOSITORY', `${owner}/${repo}`);
      Deno.env.set('GITHUB_PR_NUMBER', number);
      const configVal = {
        // Renamed from config to avoid conflict with configApp
        processor: Deno.env.get('CODE_HEDGEHOG_PROCESSOR') || 'dify',
        filter: { exclude: ['**/dist/**', 'deno.lock'], maxChanges: 300 },
      };
      const runner = new ActionRunner(configVal);
      const comments = await runner.run();
      return c.json({ comments });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
);

app.route('/api', apiApp); // /api プレフィックスで apiApp をメインアプリにマウント

export type AppType = typeof app; // AppType はメインアプリ全体の型

if (isProduction) {
  app.use('/*', serveStatic({ root: './dist' }));
}

Deno.serve({ port: PORT, hostname: HOST }, app.fetch);
