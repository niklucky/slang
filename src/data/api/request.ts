export type Response<T> = {
  data: T
  error: Error | null
}

// Implementation code where T is the returned data shape
export function request<T>(url: string, method?: string, data?: unknown): Promise<T> {
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