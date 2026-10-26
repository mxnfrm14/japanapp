const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000'

let authHandlers = {}

export const configureAuthHandlers = (handlers) => {
  authHandlers = handlers
}

const buildHeaders = (headers = {}, token) => {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    searchParams.append(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

const request = async (path, options = {}, retried = false) => {
  const { params, auth = true, ...fetchOptions } = options
  const token = auth ? localStorage.getItem('authToken') : null
  const response = await fetch(`${API_BASE_URL}${path}${buildQueryString(params)}`, {
    ...fetchOptions,
    headers: buildHeaders(fetchOptions.headers, token),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json()
      : await response.text()

  if (!response.ok) {
    if (response.status === 401 && auth && token) {
      const currentToken = localStorage.getItem('authToken')
      // A concurrent request may already have renewed this token.
      if (!retried && currentToken && (
        currentToken !== token || await authHandlers.onUnauthorized?.()
      )) {
        return request(path, options, true)
      }
      if (retried) authHandlers.onSessionExpired?.()
    }

    const error = new Error(data?.detail || data?.message || 'Request failed')
    error.response = {
      status: response.status,
      data,
    }
    throw error
  }

  return { data, status: response.status }
}

const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
}

export default apiClient
