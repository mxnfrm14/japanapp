import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../services/api'

export const useFetchDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/summary')
      return response.data
    },
  })
}

export const useFetchVocabulary = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['vocabulary', page, limit],
    queryFn: async () => {
      const response = await apiClient.get('/vocabulary/list', {
        params: { page, limit }
      })
      return response.data
    },
  })
}

export const useFetchDueFlashcards = () => {
  return useQuery({
    queryKey: ['flashcards-due'],
    queryFn: async () => {
      const response = await apiClient.get('/flashcards/due')
      return response.data
    },
  })
}

export const useSubmitFlashcardAnswer = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/flashcards/submit', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards-due'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useAIChat = () => {
  return useMutation({
    mutationFn: async ({ conversationId, message }) => {
      const response = await apiClient.post('/ai/chat', {
        conversation_id: conversationId,
        message,
      })
      return response.data
    },
  })
}
