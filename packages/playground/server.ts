import { Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { ActionRunner } from '../action/src/runner.ts';

const app = new Hono();
const PORT = 8000;

const isProduction = Deno.env.get('DENO_ENV') === 'production';

app.post('/api/run-processor', async (c) => {
  try {
    const { token, owner, repo, number } = await c.req.json();

    if (typeof token !== 'string') throw new Error('token is invalid');
    if (typeof owner !== 'string') throw new Error('owner is invalid');
    if (typeof repo !== 'string') throw new Error('repo is invalid');
    if (typeof number !== 'string') throw new Error('number is invalid');

    // Use in @code-hedgehog/action
    Deno.env.set('GITHUB_TOKEN', token);
    Deno.env.set('GITHUB_REPOSITORY', `${owner}/${repo}`);
    Deno.env.set('GITHUB_PR_NUMBER', number);

    const config = {
      processor: Deno.env.get('CODE_HEDGEHOG_PROCESSOR') || 'dify',
      filter: { exclude: ['**/dist/**', 'deno.lock'], maxChanges: 300 },
    };

    const runner = new ActionRunner(config);
    const comments = await runner.run();

    c.json({ comments });
  } catch (error) {
    c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

if (isProduction) {
  app.use('/*', serveStatic({ root: './dist' }));
}

Deno.serve({ port: PORT, hostname: '127.0.0.1' }, app.fetch);
