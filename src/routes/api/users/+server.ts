import { response } from "../../../server/lib/response"
import { requireUser } from "../../../server/services/auth"
import { findUsers } from "../../../server/services/user"
import type { RequestEvent } from "./$types"

export async function GET({ locals }: RequestEvent) {
  const projects = await findUsers(requireUser(locals.user))
  return response(projects, null)
}