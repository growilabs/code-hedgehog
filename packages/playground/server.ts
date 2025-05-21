import express from 'express';

const app = express();
const PORT = 8000;

const isProduction = Deno.env.get('DENO_ENV') === 'production';

app.get('/api/run-processor', (req, res) => {
  // TODO: processor を走らせる
  res.json({ test: 'test' });
});

if (isProduction) {
  app.use(express.static('dist'));
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
