import express from 'express';

const app = express();
const PORT = 3001;

app.get('/api/run-processor', (req, res) => {
  // TODO: processor を走らせる
  res.json({ test: 'test' });
});

app.use(express.static('dist'));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
