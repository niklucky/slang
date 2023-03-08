import type { Handle } from '@sveltejs/kit';
import { init } from "./server/server";
import { authUserByAccessToken } from './server/services/auth';

init()

export const handle = (async ({ event, resolve }) => {
  if (event.url.pathname.indexOf('/api') === 0) {
    event.locals.user = await authUserByAccessToken(event.request.headers)
  }
  const response = await resolve(event);
  return response;
}) satisfies Handle;