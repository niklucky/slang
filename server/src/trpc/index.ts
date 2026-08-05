import { authRouter } from './routers/auth.js';
import { localesRouter } from './routers/locales.js';
import { projectsRouter } from './routers/projects.js';
import { wordsRouter } from './routers/words.js';
import { router } from './init.js';

export const appRouter = router({
  auth: authRouter,
  projects: projectsRouter,
  locales: localesRouter,
  words: wordsRouter,
});

export type AppRouter = typeof appRouter;

export { createContext, type Context, type SessionUser } from './context.js';
