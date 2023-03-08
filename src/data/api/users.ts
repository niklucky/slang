import type { User } from "@prisma/client";
import { request, type Response } from "./request";

export async function fetchUsers() {
  return await request<Response<User[]>>(`/api/users`)
}

export async function fetchUser(id: number) {
  return await request<Response<User>>(`/api/users/${id}`)
}
export async function updateUser(user: User) {
  return await request<Response<User>>(`/api/users/${user.id}`, 'PUT')
}
export async function inviteUser(user: User) {
  return await request<Response<User>>(`/api/users/invite`, 'POST', user)
}
export async function deleteUser(id: number) {
  return await request<Response<User>>(`/api/users/${id}`, 'DELETE')
}