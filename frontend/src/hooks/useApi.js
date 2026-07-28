import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export const useFetchVocabularyWithFilters = ({ page = 1, limit = 20, jlpt, tag } = {}) => {
  return useQuery({
    queryKey: ['vocabulary', page, limit, jlpt ?? null, tag ?? null],
    queryFn: async () => {
      const response = await apiClient.get('/vocabulary/list', {
        params: { page, limit, jlpt, tag },
      })
      return response.data
    },
  })
}

/**
 * Paginated vocabulary for infinite scrolling.
 *
 * `order` (difficulty_level asc/desc) and `tag` are part of the query key, so
 * changing either starts a fresh fetch from page 1 instead of appending to the
 * previous ordering.
 */
export const useInfiniteVocabulary = ({ limit = 50, order, tag } = {}) => {
  return useInfiniteQuery({
    queryKey: ['vocabulary-infinite', limit, order ?? null, tag ?? null],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiClient.get('/vocabulary/list', {
        params: { page: pageParam, limit, order, tag },
      })
      return response.data
    },
    getNextPageParam: (lastPage, allPages) => (lastPage?.has_more ? allPages.length + 1 : undefined),
  })
}

export const useFetchVocabularyTags = () => {
  return useQuery({
    queryKey: ['vocabulary-tags'],
    queryFn: async () => {
      const response = await apiClient.get('/vocabulary/tags')
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
    mutationFn: async ({ messages, systemPrompt, model, temperature, maxTokens }) => {
      const response = await apiClient.post('/ai/chat', {
        messages,
        system_prompt: systemPrompt,
        model,
        temperature,
        max_tokens: maxTokens,
      })
      return response.data
    },
  })
}

export const useSearch = (query, { limit = 20 } = {}) => {
  return useQuery({
    queryKey: ['search', query],
    enabled: !!query && String(query).trim().length > 0,
    queryFn: async () => {
      try {
        const response = await apiClient.get('/search', {
          params: { q: query, limit },
        })
        if (Array.isArray(response.data)) {
          return response.data
        }

        if (Array.isArray(response.data?.items)) {
          return response.data.items
        }

        return []
      } catch (err) {
        // If the backend endpoint isn't available yet or network fails,
        // return an empty list so UI remains responsive.
        console.error('Search failed:', err)
        return []
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}
