import type { Channel, Key, Locale, Namespace, Project, Translation } from "@prisma/client"
import type { TOption } from "../components/Form/types"

type Response<T> = {
  data: T
  error: Error | null
}

export type KeyExtended = Key & { namespaces: Namespace[], translations: Translation[] }

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
  return await request<Response<KeyExtended[]>>(`/api/projects/${input.projectId}/keys?${params.join('&')}`)
}
export async function fetchProjectKeyById(projectId: number, id: number) {
  return await request<Response<KeyExtended>>(`/api/projects/${projectId}/keys/${id}`)
}
export async function deleteProjectKeyById(projectId: number, id: number) {
  return await request<Response<boolean>>(`/api/projects/${projectId}/keys/${id}`, 'DELETE')
}
export async function createKey(key: Partial<Key>) {
  return await request<Response<Key>>(`/api/projects/${key.projectId}/keys`, 'POST', key)
}
export async function updateKey(id: number, key: Key) {
  return await request<Response<Key>>(`/api/projects/${key.projectId}/keys/${id}`, 'PUT', key)
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

// Implementation code where T is the returned data shape
function request<T>(url: string, method?: string, data?: unknown): Promise<T> {
  let body: BodyInit | undefined = undefined

  if (data) {
    body = JSON.stringify(data)
  }
  return fetch(url, { method, body })
    .then(response => {
      if (!response.ok) {
        throw new Error(response.statusText)
      }
      return response.json() as T
    })
}