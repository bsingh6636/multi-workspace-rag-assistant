import { Router } from 'express';
import { listToolCalls } from '../controllers/toolCall.controller';

// Mounted at /api/workspaces/:wsId/tool-calls, after loadWorkspace.
const router = Router();

router.get('/', listToolCalls);

export default router;
