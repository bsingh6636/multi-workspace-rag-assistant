import { Router } from 'express';
import { deleteTask, listTasks, updateTask } from '../controllers/task.controller';

// Mounted at /api/workspaces/:wsId/tasks, after loadWorkspace.
const router = Router();

router.get('/', listTasks);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

export default router;
