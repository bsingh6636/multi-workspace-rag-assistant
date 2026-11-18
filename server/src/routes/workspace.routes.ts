import { Router } from 'express';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceCounts,
  listWorkspaces,
  renameWorkspace,
} from '../controllers/workspace.controller';
import { loadWorkspace } from '../middleware/workspace';
import chatRoutes from './chat.routes';
import documentRoutes from './document.routes';
import taskRoutes from './task.routes';
import toolCallRoutes from './toolCall.routes';

// Mounted at /api/workspaces. Paths only; the handlers live in the controller.
const router = Router();

router.get('/', listWorkspaces);
router.post('/', createWorkspace);

// Everything below runs only after the ownership check. Handlers use
// req.workspace.id, which came from the URL and was verified for this user.
router.use('/:wsId', loadWorkspace);

router.patch('/:wsId', renameWorkspace);
router.delete('/:wsId', deleteWorkspace);
router.get('/:wsId/counts', getWorkspaceCounts);

router.use('/:wsId/documents', documentRoutes);
router.use('/:wsId/chats', chatRoutes);
router.use('/:wsId/tasks', taskRoutes);
router.use('/:wsId/tool-calls', toolCallRoutes);

export default router;
