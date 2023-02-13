import type { Channel, Key, Locale, Namespace, Project } from "@prisma/client"

type Response<T> = {
  data: T
  error: Error | null
}

export type KeyExtended = Key & { namespaces: Namespace[] }

export type ProjectExtended = Project & { locales: Locale[], channels: Channel[] }

export async function fetchProjectKeys(projectId: number) {
  return await request<Response<KeyExtended[]>>(`/api/projects/${projectId}/keys`)
}
export async function fetchProjectKeyById(projectId: number, id: number) {
  return await request<Response<KeyExtended>>(`/api/projects/${projectId}/keys/${id}`)
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