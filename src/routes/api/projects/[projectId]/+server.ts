import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../server/lib/response";
import { requireParam } from "../../../../server/lib/validation";
import { requireUser } from "../../../../server/services/auth";
import { deleteProject, findProjectById, updateProject } from "../../../../server/services/project";

export async function GET({ locals, params }: RequestEvent) {
  const id = parseInt(requireParam(params, 'projectId'))
  const project = await findProjectById(requireUser(locals.user), id)
  return response(project, null)
}

export async function PUT({ request, params, locals }: RequestEvent) {
  const id = parseInt(requireParam(params, 'projectId'))
  const payload = await request.json()
  const project = await updateProject(requireUser(locals.user), id, payload)
  return response(project, null)
}

export async function DELETE({ params, locals }: RequestEvent) {
  const id = parseInt(requireParam(params, 'projectId'))
  const project = await deleteProject(requireUser(locals.user), id)
  return response(project, null)
}