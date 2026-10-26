import { create } from 'zustand'
import apiClient, { configureAuthHandlers } from '../services/api.js'
import { readSession, saveSession } from '../services/session.js'

let initialization = null
let renewal = null

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  isRenewalPending: false,
  isRefreshing: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  initializeAuth: () => {
    // StrictMode and concurrent callers must share the same initialization.
    if (initialization) return initialization

    initialization = (async () => {
      set({ isLoading: true, error: null })
      const session = readSession()
      if (!session) {
        get().clearAuth()
        return
      }

      try {
        if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
          const extended = await get().requestSessionExtension()
          if (!extended) return
        }
        const response = await apiClient.get('/auth/me')
        const currentSession = readSession()
        if (!currentSession) return
        set({
          user: response.data.user,
          session: get().session?.access_token === currentSession.access_token
            ? get().session : currentSession,
        })
      } catch (error) {
        if (error.response?.status === 401) {
          get().clearAuth('Session expired. Please sign in again.')
        } else {
          set({ error: error.message || 'Unable to load session' })
        }
      } finally {
        set({ isLoading: false })
      }
    })().finally(() => { initialization = null })

    return initialization
  },

  signInWithEmail: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await apiClient.post('/auth/login', { email, password }, { auth: false })
      if (!data?.session?.access_token) throw new Error('Login failed')

      const session = saveSession(data.session)
      set({ user: data.user, session })
      return { error: null }
    } catch (error) {
      set({ error: error.message || 'Login failed' })
      return { error }
    } finally {
      set({ isLoading: false })
    }
  },

  signUpWithEmail: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await apiClient.post('/auth/signup', { email, password }, { auth: false })
      if (data?.session?.access_token) {
        const session = saveSession(data.session)
        set({ user: data.user, session })
      }
      return { error: null, data }
    } catch (error) {
      set({ error: error.message || 'Sign-up failed' })
      return { error }
    } finally {
      set({ isLoading: false })
    }
  },

  requestSessionExtension: () => {
    if (renewal) return renewal.promise
    if (!localStorage.getItem('authToken') || !localStorage.getItem('authRefreshToken')) {
      get().clearAuth('Session expired. Please sign in again.')
      return Promise.resolve(false)
    }

    let resolve
    const promise = new Promise((done) => { resolve = done })
    renewal = { promise, resolve }
    set({ isRenewalPending: true, isRefreshing: false })
    return promise
  },

  extendSession: async () => {
    if (!renewal || get().isRefreshing) return
    const pending = renewal
    const refreshToken = localStorage.getItem('authRefreshToken')
    set({ isRefreshing: true })

    try {
      const { data } = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      }, { auth: false })

      // Signing out while a refresh is in flight must not restore the session.
      if (renewal !== pending) return
      if (!data?.session?.access_token || !data.session.refresh_token) {
        throw new Error('Invalid session renewal')
      }

      const session = saveSession(data.session)
      renewal = null
      set({
        user: { ...get().user, ...data.user },
        session,
        isRenewalPending: false,
        isRefreshing: false,
        error: null,
      })
      pending.resolve(true)
    } catch {
      if (renewal === pending) {
        get().clearAuth('Unable to extend your session. Please sign in again.')
      }
    }
  },

  signOut: async () => {
    get().clearAuth()
    await apiClient.post('/auth/logout', undefined, { auth: false }).catch(() => null)
    return { error: null }
  },

  clearAuth: (error = null) => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authRefreshToken')
    const pending = renewal
    renewal = null
    set({
      user: null,
      session: null,
      isLoading: false,
      error,
      isRenewalPending: false,
      isRefreshing: false,
    })
    pending?.resolve(false)
  },
}))

configureAuthHandlers({
  onUnauthorized: () => useAuthStore.getState().requestSessionExtension(),
  onSessionExpired: () => useAuthStore.getState().clearAuth('Session expired. Please sign in again.'),
})
