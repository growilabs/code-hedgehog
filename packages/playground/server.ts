import { Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ActionRunner } from '../action/src/runner.ts';

const app = new Hono();
const PORT = 8000;

const isProduction = Deno.env.get('DENO_ENV') === 'production';

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

Deno.serve({ port: PORT, hostname: '127.0.0.1' }, app.fetch);
