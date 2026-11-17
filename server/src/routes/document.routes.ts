import { Router } from 'express';
import { deleteDocument, listDocuments, uploadDocument } from '../controllers/document.controller';
import { uploadSingleFile } from '../middleware/upload';

// Mounted at /api/workspaces/:wsId/documents, after loadWorkspace has checked
// that the caller owns the workspace. Paths only; handlers are in the controller.
const router = Router();

router.get('/', listDocuments);
router.post('/', uploadSingleFile, uploadDocument);
router.delete('/:docId', deleteDocument);

export default router;
