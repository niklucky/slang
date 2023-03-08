import { error } from "@sveltejs/kit"

export function requireParam(params: Partial<Record<string, string>>, key: string): string {
  if (!(key in params) || !params[key]) {
    throw error(400, { message: `${key}_invalid` })
  }
  return params[key] as string
}