import 'dotenv/config';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Built React app. In production Express serves it, so there is one service and no CORS.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

app.use(express.json({ limit: '1mb' }));

// Keep-alive target for the cron ping. No DB call, so it stays cheap and can't
// fail because of a database hiccup.
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// API routes are added here from Part 1 onwards.

// Unknown API routes get a JSON 404 instead of falling through to index.html.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Static client files, then a catch-all so client-side routes survive a reload.
app.use(express.static(CLIENT_DIST));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// Last-resort error handler: log the message, never send stack traces or env values.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
