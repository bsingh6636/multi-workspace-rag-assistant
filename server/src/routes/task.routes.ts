import { Router } from 'express';
import { listTasks } from '../controllers/task.controller';

// Mounted at /api/workspaces/:wsId/tasks, after loadWorkspace.
const router = Router();

router.get('/', listTasks);

export default router;
