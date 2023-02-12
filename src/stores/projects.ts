import type { Project } from "@prisma/client"

type Response<T> = {
  data: T
  error: Error | null
}

export async function fetchProjects() {
  return await request<Response<Project[]>>('/api/projects')
}

export async function fetchProject(id: number) {
  return await request<Response<Project>>(`/api/projects/${id}`)
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