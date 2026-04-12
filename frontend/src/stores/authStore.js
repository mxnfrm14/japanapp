import { create } from 'zustand'
import apiClient from '../services/api'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  initializeAuth: async () => {
    set({ isLoading: true, error: null })

    const token = localStorage.getItem('authToken')
    if (!token) {
      set({ user: null, session: null, isLoading: false })
      return
    }

    try {
      const response = await apiClient.get('/auth/me')
      set({
        user: response.data.user,
        session: { access_token: token },
        isLoading: false,
      })
    } catch (error) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authRefreshToken')
      set({ user: null, session: null, error: error.response?.data?.detail ?? 'Session expired', isLoading: false })
    }
  },

  signInWithEmail: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await apiClient.post('/auth/login', { email, password })

      if (!data?.session?.access_token) {
        const loginError = new Error('Login failed')
        set({ error: loginError.message })
        return { error: loginError }
      }

      localStorage.setItem('authToken', data.session.access_token)
      if (data.session.refresh_token) {
        localStorage.setItem('authRefreshToken', data.session.refresh_token)
      }

      set({ user: data.user, session: data.session })
      return { error: null }
    } catch (error) {
      set({ error: error.message ?? 'Login failed' })
      return { error }
    } finally {
      set({ isLoading: false })
    }
  },

  signUpWithEmail: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await apiClient.post('/auth/signup', { email, password })

      if (data?.session?.access_token) {
        localStorage.setItem('authToken', data.session.access_token)
        if (data.session.refresh_token) {
          localStorage.setItem('authRefreshToken', data.session.refresh_token)
        }
        set({ user: data.user, session: data.session })
      }

      return { error: null, data }
    } catch (error) {
      set({ error: error.message ?? 'Sign-up failed' })
      return { error }
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authRefreshToken')
      await apiClient.post('/auth/logout').catch(() => null)

      set({ user: null, session: null })
      return { error: null }
    } finally {
      set({ isLoading: false })
    }
  },

  clearAuth: () => set({ 
    user: null, 
    session: null,
    isLoading: false, 
    error: null 
  }),
}))
