import type { User } from "@prisma/client";
import type UserProjects from "../../components/UserList/UserProjects.svelte";
import { request, type Response } from "./request";

export type UserWithProjects = User & { projects: UserProjects[] }

export async function fetchUsers() {
  return await request<Response<UserWithProjects[]>>(`/api/users`)
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