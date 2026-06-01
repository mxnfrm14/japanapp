const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const buildHeaders = (headers = {}) => {
  const token = localStorage.getItem('authToken')

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

const handleUnauthorized = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authRefreshToken')
  window.location.href = '/login'
}

const request = async (path, options = {}) => {
  const { params, ...fetchOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: buildHeaders(fetchOptions.headers),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized()
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
  get: (path, options = {}) => {
    const { params, ...requestOptions } = options
    return request(`${path}${buildQueryString(params)}`, { ...requestOptions, method: 'GET' })
  },
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export default apiClient
