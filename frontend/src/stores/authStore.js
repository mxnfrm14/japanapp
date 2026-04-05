import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  clearAuth: () => set({ 
    user: null, 
    isLoading: false, 
    error: null 
  }),
}))
