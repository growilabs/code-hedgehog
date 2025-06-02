import { crypto } from '@std/crypto';
import { type Context, Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ActionRunner } from '../action/src/runner.ts';
import type { ActionConfig } from '../action/src/config.ts';
import { loadBaseConfig, DEFAULT_CONFIG } from '../processors/base/mod.ts';

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
        return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
      }
      return parsed.data;
    }),
    async (c) => {
      try {
        const validatedData = await c.req.valid('json');
        // If validation failed, the validator middleware would have already sent a response.
        // However, to satisfy TypeScript, we check if validatedData is undefined,
        // though in practice with Hono's validator, this path shouldn't be hit if validation fails.
        if (!validatedData) {
          // This case should ideally not be reached if validator is set up correctly
          return c.json({ error: 'Validation failed unexpectedly.' }, 500);
        }
        const { githubToken, owner, repo, number } = validatedData;

        Deno.env.set('GITHUB_TOKEN', githubToken);
        Deno.env.set('GITHUB_REPOSITORY', `${owner}/${repo}`);
        Deno.env.set('GITHUB_PR_NUMBER', number);

        // Load configuration from .coderabbitai.yaml
        const loadedReviewConfig = await loadBaseConfig(); // Uses default path '.coderabbitai.yaml'

        const actionRunnerConfig: ActionConfig = {
          processor: Deno.env.get('CODE_HEDGEHOG_PROCESSOR') || 'dify',
          filter: {
            exclude: loadedReviewConfig.file_filter?.exclude ?? DEFAULT_CONFIG.file_filter.exclude,
            maxChanges: loadedReviewConfig.file_filter?.max_changes ?? DEFAULT_CONFIG.file_filter.max_changes,
            // include is not part of ReviewConfig, so it remains undefined or could be sourced differently if needed.
          },
        };

        const runner = new ActionRunner(actionRunnerConfig);
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
