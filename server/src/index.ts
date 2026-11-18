import path from 'node:path';
import express from 'express';
import { config } from './config';
import { errorHandler } from './middleware/error';
import apiRouter from './routes';
import { failInterruptedWork } from './services/recovery';

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

// Clean up answers/uploads a previous run left half-done, then start listening.
// Cleanup runs first so it can't touch requests this run is handling. If it
// fails (e.g. the DB is unreachable), log it and start anyway.
async function start() {
  try {
    const { answers, uploads } = await failInterruptedWork();
    console.log(
      `Startup cleanup: marked ${answers} interrupted answer(s) and ${uploads} interrupted upload(s) as failed`,
    );
  } catch (err) {
    console.error('Startup cleanup failed:', err instanceof Error ? err.message : err);
  }

  app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT}`);
  });
}

start();
