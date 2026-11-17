import path from 'node:path';
import express from 'express';
import { config } from './config';
import { errorHandler } from './middleware/error';
import apiRouter from './routes';

const app = express();

// Built React app. In production Express serves it, so there is one service and no CORS.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

app.use(express.json({ limit: '1mb' }));

// Health check for the container. No DB call, so it stays cheap and can't
// fail because of a database hiccup.
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// All /api routes (auth runs inside apiRouter, see routes/index.ts).
app.use('/api', apiRouter);

// Static client files, then a catch-all so client-side routes survive a reload.
app.use(express.static(CLIENT_DIST));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// Must be registered last so it catches errors from everything above.
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});
