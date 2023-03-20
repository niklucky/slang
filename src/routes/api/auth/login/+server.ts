import { response } from "../../../../server/lib/response";
import { login } from "../../../../server/services/auth";
import type { RequestEvent } from "./$types";

export async function POST({ request }: RequestEvent) {
  const payload = await request.json();
  const result = await login(payload.username, payload.password)
  return response(result, null)
}