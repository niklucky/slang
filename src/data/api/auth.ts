import type { User } from "@prisma/client";
import { request, type Response } from "./request";

export type Auth = {
  user: User
  accessToken: string
}

export async function setupUser(name: string, username: string, password: string) {
  return await request<Response<Auth>>(`/api/auth/setup`, 'POST', { name, username, password })
}

export async function profile() {
  return await request<Response<User>>(`/api/auth/profile`)
}