import { useInfiniteQuery, useMutation, useMutationState, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../services/api'
import { useAuthStore } from '../stores/authStore'

const BATCH_SIZE = 100
const favoriteKey = (type, id) => `${type}:${id}`

// Move the old word-of-the-day bookmarks to the account once. Failed batches
// keep the original browser data; the import is safe to retry.
function useLegacyFavoritesImport() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['favorites', userId, 'legacy-import'],
    enabled: !!userId,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const key = `japanapp.dailyWord.bookmarks.v1.${userId}`
      let bookmarks
      try {
        bookmarks = JSON.parse(localStorage.getItem(key) || '[]')
      } catch {
        return true
      }
      const ids = [...new Set((Array.isArray(bookmarks) ? bookmarks : [])
        .map((item) => item?.id)
        .filter((id) => typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))]
      for (let start = 0; start < ids.length; start += BATCH_SIZE) {
        if (useAuthStore.getState().user?.id !== userId) throw new Error('Account changed during favorites import')
        await apiClient.post('/favorites/import', { item_ids: ids.slice(start, start + BATCH_SIZE) })
      }
      if (ids.length) {
        queryClient.invalidateQueries({ queryKey: ['favorites', userId, 'list'] })
        queryClient.invalidateQueries({ queryKey: ['favorites', userId, 'status'] })
      }
      try {
        localStorage.removeItem(key)
      } catch {
        // A repeated import remains idempotent when browser storage is disabled.
      }
      return true
    },
  })
}

export function useFavoriteMutation() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  const mutationKey = ['favorite-toggle', userId]
  const pending = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) => favoriteKey(mutation.state.variables.itemType, mutation.state.variables.itemId),
  })
  const mutation = useMutation({
    mutationKey,
    mutationFn: async ({ itemType, itemId, saved }) => {
      const path = `/favorites/${itemType}/${itemId}`
      if (saved) await apiClient.delete(path)
      else await apiClient.put(path, {})
    },
    onSuccess: async (_, { itemType, itemId, saved }) => {
      const prefix = ['favorites', userId, 'status', itemType]
      await queryClient.cancelQueries({ queryKey: prefix })
      for (const query of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
        if (!query.queryKey[4].includes(itemId)) continue
        queryClient.setQueryData(query.queryKey, (data) => {
          if (!data) return data
          return { item_ids: saved
            ? data.item_ids.filter((id) => id !== itemId)
            : [...new Set([...data.item_ids, itemId])] }
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites', userId, 'status'] }),
        queryClient.invalidateQueries({ queryKey: ['favorites', userId, 'list'] }),
      ])
    },
  })

  return {
    error: mutation.error,
    retry: () => mutation.mutate(mutation.variables),
    forItem: (itemType, itemId, saved, disabled = false) => ({
      saved,
      disabled: disabled || !userId || pending.includes(favoriteKey(itemType, itemId)),
      onToggle: () => mutation.mutate({ itemType, itemId, saved }),
    }),
  }
}

export function useFavoriteItems(itemType, itemIds) {
  const userId = useAuthStore((state) => state.user?.id)
  const migration = useLegacyFavoritesImport()
  const mutation = useFavoriteMutation()
  const ids = [...new Set(itemIds.filter(Boolean))].sort()
  const batches = []
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    batches.push(ids.slice(start, start + BATCH_SIZE))
  }
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: ['favorites', userId, 'status', itemType, batch],
      enabled: !!userId && migration.isSuccess,
      queryFn: async () => (await apiClient.post('/favorites/status', {
        item_type: itemType, item_ids: batch,
      })).data,
      staleTime: 0,
      refetchOnWindowFocus: true,
      retry: 1,
    })),
  })
  const savedIds = new Set(queries.flatMap((query) => query.data?.item_ids ?? []))
  const failedQuery = queries.find((query) => query.isError)

  return {
    error: migration.error || failedQuery?.error || mutation.error,
    retry: () => {
      if (migration.isError) migration.refetch()
      else if (failedQuery) failedQuery.refetch()
      else mutation.retry()
    },
    forItem: (id) => {
      const index = batches.findIndex((batch) => batch.includes(id))
      return mutation.forItem(itemType, id, savedIds.has(id), !migration.isSuccess || !queries[index]?.isSuccess)
    },
  }
}

export function useFavoritesList(itemType) {
  const userId = useAuthStore((state) => state.user?.id)
  const migration = useLegacyFavoritesImport()
  const query = useInfiniteQuery({
    queryKey: ['favorites', userId, 'list', itemType ?? null],
    enabled: !!userId && migration.isSuccess,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await apiClient.get('/favorites', {
      params: { page: pageParam, limit: 20, item_type: itemType },
    })).data,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  return {
    ...query,
    error: migration.error || query.error,
    retry: () => migration.isError ? migration.refetch() : query.refetch(),
  }
}
