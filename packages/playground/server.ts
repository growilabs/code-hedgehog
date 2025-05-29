import { crypto } from '@std/crypto';
import { type Context, Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ActionRunner } from '../action/src/runner.ts';

const app = new Hono();
const PORT = Number.parseInt(Deno.env.get('PORT') || '8000');
const HOST = Deno.env.get('HOST') || '0.0.0.0';

const isProduction = Deno.env.get('DENO_ENV') === 'production';

const generateGitHubDiffId = async (filePath: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(filePath);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const runProcessorSchema = z.object({
  githubToken: z.string(),
  owner: z.string(),
  repo: z.string(),
  number: z.string(),
});

// Chained route を使用
const route = app
  .post(
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

        Deno.env.set('GITHUB_TOKEN', githubToken);
        Deno.env.set('GITHUB_REPOSITORY', `${owner}/${repo}`);
        Deno.env.set('GITHUB_PR_NUMBER', number);

        const config = {
          processor: Deno.env.get('CODE_HEDGEHOG_PROCESSOR') || 'dify',
          filter: { exclude: ['**/dist/**', 'deno.lock'], maxChanges: 300 },
        };

        const runner = new ActionRunner(config);
        const comments = await runner.run();

        const commentsWithDiffId = await Promise.all(
          comments.map(async (comment) => {
            const diffId = await generateGitHubDiffId(comment.path);
            return { ...comment, diffId };
          }),
        );

        return c.json({
          comments: commentsWithDiffId,
        });
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  )
  .get('/api/config/owners', (c: Context) => {
    try {
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
  });

export type AppType = typeof route;

if (isProduction) {
  app.use('/*', serveStatic({ root: './dist' }));
}

Deno.serve({ port: PORT, hostname: HOST }, app.fetch);
