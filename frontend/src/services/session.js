export const getTokenExpiry = (token) => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload))
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

export const readSession = () => {
  const access_token = localStorage.getItem('authToken')
  if (!access_token) return null

  return {
    access_token,
    refresh_token: localStorage.getItem('authRefreshToken'),
    expires_at: getTokenExpiry(access_token) / 1000 || null,
  }
}

export const saveSession = (session) => {
  localStorage.setItem('authToken', session.access_token)
  if (session.refresh_token) {
    localStorage.setItem('authRefreshToken', session.refresh_token)
  } else {
    localStorage.removeItem('authRefreshToken')
  }

  return {
    ...session,
    expires_at: getTokenExpiry(session.access_token) / 1000
      || session.expires_at
      || (session.expires_in ? Date.now() / 1000 + session.expires_in : null),
  }
}
