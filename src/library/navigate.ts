import { goto } from '$app/navigation';

export function navigate(route: string, replaceState = false) {
  goto(route, { replaceState })
}