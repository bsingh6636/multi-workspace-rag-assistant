import { Router } from 'express';
import { createChat, listChats, listMessages, retryMessage, sendMessage } from '../controllers/chat.controller';
import { loadChat } from '../middleware/chat';

// Mounted at /api/workspaces/:wsId/chats, after loadWorkspace has checked that
// the caller owns the workspace. Paths only; handlers are in the controller.
const router = Router();

router.get('/', listChats);
router.post('/', createChat);

// Below here the chat must belong to this workspace (404 otherwise).
router.use('/:chatId', loadChat);

router.get('/:chatId/messages', listMessages);
router.post('/:chatId/messages', sendMessage);
router.post('/:chatId/messages/:messageId/retry', retryMessage);

export default router;
