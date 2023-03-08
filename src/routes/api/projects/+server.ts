import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';
import { requireUser } from '../../../server/services/auth';
import { createProject, findProjects } from '../../../server/services/project';

export async function GET({ locals }: RequestEvent) {
  const projects = await findProjects(requireUser(locals.user))
  return response(projects, null)
}

export async function POST({ request, locals }: RequestEvent) {
  const payload = await request.json();
  const project = await createProject(requireUser(locals.user), payload)
  return response(project, null)
}
