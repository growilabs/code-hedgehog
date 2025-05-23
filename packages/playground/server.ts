import express from 'express';

const app = express();
const PORT = Number.parseInt(Deno.env.get('PORT') || '8000');
const HOST = Deno.env.get('HOST') || '0.0.0.0'; // 環境変数で制御

const isProduction = Deno.env.get('DENO_ENV') === 'production';

app.get('/api/run-processor', (req, res) => {
  // TODO: processor を走らせる
  res.json({ test: 'test' });
});

if (isProduction) {
  app.use(express.static('dist'));
}

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
