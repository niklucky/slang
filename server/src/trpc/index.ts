import { authRouter } from './routers/auth.js';
import { invitationsRouter } from './routers/invitations.js';
import { localesRouter } from './routers/locales.js';
import { projectsRouter } from './routers/projects.js';
import { usersRouter } from './routers/users.js';
import { wordsRouter } from './routers/words.js';
import { router } from './init.js';

export const appRouter = router({
  auth: authRouter,
  projects: projectsRouter,
  locales: localesRouter,
  words: wordsRouter,
  invitations: invitationsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;

export { createContext, type Context, type SessionUser } from './context.js';
export type { MemberPermissions, ProjectMember } from '../services/members.js';
export type { PendingInvitationView, ProjectInvitation } from '../services/invitations.js';
