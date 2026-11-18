import { Router } from 'express';
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  renameWorkspace,
} from '../controllers/workspace.controller';
import { loadWorkspace } from '../middleware/workspace';
import chatRoutes from './chat.routes';
import documentRoutes from './document.routes';

// Mounted at /api/workspaces. Paths only; the handlers live in the controller.
const router = Router();

router.get('/', listWorkspaces);
router.post('/', createWorkspace);

// Everything below runs only after the ownership check. Handlers use
// req.workspace.id, which came from the URL and was verified for this user.
// Later parts mount documents, chats, tasks and tool-calls under /:wsId too.
router.use('/:wsId', loadWorkspace);

router.patch('/:wsId', renameWorkspace);
router.delete('/:wsId', deleteWorkspace);

router.use('/:wsId/documents', documentRoutes);
router.use('/:wsId/chats', chatRoutes);

export default router;
