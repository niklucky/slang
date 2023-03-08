import type { Channel, Locale, Namespace, Project, Translation, Word } from "@prisma/client"
import type { TOption } from "../../components/Form/types"
import { request } from "./request"

type Response<T> = {
  data: T
  error: Error | null
}

export type WordExtended = Word & { namespaces: Namespace[], translations: Translation[] }

export type ProjectExtended = Project & { locales: Locale[], channels: Channel[], namespaces: Namespace[] }
export type TranslationExtended = Translation & { locale: Locale, channel: Channel }

export type ProjectKeysInput = {
  projectId: number
  namespaces?: TOption[]
  locales?: TOption[]
  search?: string
}

export async function fetchProjectKeys(input: ProjectKeysInput) {
  const params: string[] = []
  if (input.namespaces) {
    params.push(`namespaces=${input.namespaces.map(ns => ns.id).join(',')}`)
  }
  if (input.locales) {
    params.push(`locales=${input.locales.map(ns => ns.id).join(',')}`)
  }
  if (input.search) {
    params.push(`search=${input.search}`)
  }
  return await request<Response<WordExtended[]>>(`/api/projects/${input.projectId}/words?${params.join('&')}`)
}
export async function fetchProjectKeyById(projectId: number, id: number) {
  return await request<Response<WordExtended>>(`/api/projects/${projectId}/words/${id}`)
}
export async function deleteProjectKeyById(projectId: number, id: number) {
  return await request<Response<boolean>>(`/api/projects/${projectId}/words/${id}`, 'DELETE')
}
export async function createKey(key: Partial<Word>) {
  return await request<Response<Word>>(`/api/projects/${key.projectId}/words`, 'POST', key)
}
export async function updateKey(id: number, key: Word) {
  return await request<Response<Word>>(`/api/projects/${key.projectId}/words/${id}`, 'PUT', key)
}

export async function fetchProjects() {
  return await request<Response<Project[]>>('/api/projects')
}

export async function fetchProject(id: number) {
  return await request<Response<ProjectExtended>>(`/api/projects/${id}`)
}

export async function createProject(project: Partial<Project>) {
  return await request<Response<Project>>('/api/projects', 'POST', project)
}
export async function updateProject(id: number, project: Partial<Project>) {
  return await request<Response<Project>>(`/api/projects/${id}`, 'PUT', project)
}
export async function deleteProject(id: number) {
  return await request<Response<Project>>(`/api/projects/${id}`, 'DELETE')
}

export async function fetchLocales() {
  return await request<Response<Locale[]>>('/api/locales')
}
export async function addLocaleToProject(projectId: number, localeId: number) {
  return await request<Response<Locale>>(`/api/projects/${projectId}/locales`, 'POST', { localeId })
}
export async function deleteLocaleFromProject(projectId: number, localeId: number) {
  return await request<Response<Locale>>(`/api/projects/${projectId}/locales`, 'DELETE', { localeId })
}
export async function updateLocaleInProject(projectId: number, fromLocaleId: number, toLocaleId: number) {
  return await request<Response<Locale>>(`/api/projects/${projectId}/locales`, 'PUT', { fromLocaleId, toLocaleId })
}
export async function createProjectNamespace(ns: Namespace) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/namespaces`, 'POST', ns)
}
export async function updateProjectNamespace(ns: Namespace) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/namespaces/${ns.id}`, 'PUT', ns)
}
export async function deleteProjectNamespace(ns: Namespace) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/namespaces/${ns.id}`, 'DELETE')
}
export async function createProjectChannel(ns: Channel) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/channels`, 'POST', ns)
}
export async function updateProjectChannel(ns: Channel) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/channels/${ns.id}`, 'PUT', ns)
}
export async function deleteProjectChannel(ns: Channel) {
  return await request<Response<Locale>>(`/api/projects/${ns.projectId}/channels/${ns.id}`, 'DELETE')
}
