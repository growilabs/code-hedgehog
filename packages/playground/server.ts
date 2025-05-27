import express, { type Request, type Response, type RequestHandler } from 'express';
import { ActionRunner } from '../action/src/runner.ts';

const app = express();
const PORT = Number.parseInt(Deno.env.get('PORT') || '8000');
const HOST = Deno.env.get('HOST') || '0.0.0.0'; // 環境変数で制御

const isProduction = Deno.env.get('DENO_ENV') === 'production';

app.use(express.json());

// Vite environmentにおいて、`VITE_` プレフィックス付きの環境変数はビルド時にフロントエンドコードへ静的に埋め込まれます。
// 実行環境ごと（例: 開発、ステージング、本番）に異なる値を動的に設定したい場合、この方法では対応できません
// （ビルド後のイメージでは値が固定されてしまうため）。
// そのため、ここではサーバーサイド (server.ts) で実行時環境変数 (`OWNERS`) を読み込み、
// それをAPI経由でフロントエンドに提供する方式を採用しています。
// これにより、Kubernetes manifestなどで実行時に値を注入し、フロントエンドで動的に利用することが可能になります。
const getOwnersHandler: RequestHandler = (_req: Request, res: Response) => {
  try {
    // 問題切り分けのため、一時的に固定レスポンスを返す
    console.log('/api/config/owners called, sending fixed response');

    const ownersEnv = Deno.env.get('OWNERS');
    if (!ownersEnv) {
      console.warn('OWNERS environment variable is not set.');
      res.json({ owners: [] });
      return;
    }
    const owners = ownersEnv.split(',');
    res.json({ owners });
  } catch (error) {
    console.error('Error in /api/config/owners:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
};

app.get('/api/config/owners', getOwnersHandler);

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

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
