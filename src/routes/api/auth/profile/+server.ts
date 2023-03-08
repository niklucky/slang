import { response } from "../../../../server/lib/response";
import { authUserByAccessToken } from "../../../../server/services/auth";
import type { RequestEvent } from "./$types";

export async function GET({ request }: RequestEvent) {
  const user = await authUserByAccessToken(request.headers)
  return response(user, null)
}