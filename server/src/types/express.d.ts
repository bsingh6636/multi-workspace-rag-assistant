import type { Chat, Workspace } from '../db';

// Fields our middleware adds to every request.
declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth (middleware/auth.ts) on every /api route. */
      user?: { id: string; email: string | undefined };
      /** Set by loadWorkspace (middleware/workspace.ts) on every /api/workspaces/:wsId route. Ownership already checked. */
      workspace?: Workspace;
      /** Set by loadChat (middleware/chat.ts) on /chats/:chatId routes. Belongs to req.workspace. */
      chat?: Chat;
    }
  }
}

export {};
