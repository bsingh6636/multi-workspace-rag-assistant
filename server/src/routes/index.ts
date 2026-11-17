import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import profileRoutes from './profile.routes';
import workspaceRoutes from './workspace.routes';

// Every API route lives on this router, mounted at /api in index.ts.
// requireAuth runs first for all of them, so a new route file can't forget it.
// It's on this router (not app-wide) so /health and the React files stay public.
const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.use('/profile', profileRoutes);
apiRouter.use('/workspaces', workspaceRoutes);

// Unknown API paths get a JSON 404 instead of falling through to index.html.
apiRouter.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default apiRouter;
