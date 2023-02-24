import { browser } from '$app/environment';
import type { User } from '@prisma/client';
import { writable } from 'svelte/store';
import { profile, setupUser } from '../data/api/auth';

const { subscribe, set } = writable<Omit<User, 'password'> | null>(null);
const { subscribe: subscribeToken, set: setToken } = writable<string | null>(null);

let accessToken: string | null = null

export const authStore = function () {
  let isInitialized = false;
  if (browser) {
    accessToken = localStorage.getItem('accessToken')
    if (!accessToken) {
      isInitialized = true;
    } else {
      profile().then(response => {
        set(response.data)
        isInitialized = true;
      })
    }
  }

  return {
    subscribe,
    subscribeToken,
    isInitialized: () => {
      return isInitialized
    },
    accessToken: () => {
      return accessToken
    },
    logout: () => { set(null), setToken(null) },
    login: async (username: string, password: string) => {
      console.log('username, password', username, password);
      // set({ id: 1, name: 'Admin' }) 
    },
    setup: async (name: string, username: string, password: string) => {
      const response = await setupUser(name, username, password)
      if (browser) {
        localStorage.setItem('accessToken', response.data.accessToken)
      }
      accessToken = response.data.accessToken
      set(response.data.user)
      setToken(accessToken)
      isInitialized = true
    },
  }
}()