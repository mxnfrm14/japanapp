const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const buildHeaders = (headers = {}) => {
  const token = localStorage.getItem('authToken')

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

const handleUnauthorized = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authRefreshToken')
  window.location.href = '/login'
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
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
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export default apiClient
