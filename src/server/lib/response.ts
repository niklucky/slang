import { json } from "@sveltejs/kit";

export function response<T>(data: T, error: Error | null | undefined) {
  return json({
    data,
    error: error || null
  })
}