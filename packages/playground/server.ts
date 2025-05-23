import express from 'express';
import { ActionRunner } from '../action/src/runner.ts';

const app = express();
const PORT = 8000;

const isProduction = Deno.env.get('DENO_ENV') === 'production';

app.use(express.json());

app.post('/api/run-processor', async (req, res) => {
  try {
    const { githubToken, owner, repo, number } = req.body;

    if (typeof githubToken !== 'string') throw new Error('githubToken is invalid');
    if (typeof owner !== 'string') throw new Error('owner is invalid');
    if (typeof repo !== 'string') throw new Error('repo is invalid');
    if (typeof number !== 'string') throw new Error('number is invalid');

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

    res.json({ comments });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

if (isProduction) {
  app.use(express.static('dist'));
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
