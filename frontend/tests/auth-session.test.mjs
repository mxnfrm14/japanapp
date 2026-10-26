import assert from 'node:assert/strict'
import { beforeEach, afterEach, mock, test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import apiClient from '../src/services/api.js'
import { useAuthStore } from '../src/stores/authStore.js'
import { getTokenExpiry, saveSession } from '../src/services/session.js'

const storage = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
})

const auth = () => useAuthStore.getState()
const token = (exp) => `header.${btoa(JSON.stringify({ exp }))}.signature`
const oldToken = token(1)
const newToken = token(Math.floor(Date.now() / 1000) + 3600)
const user = { id: 'test-user', email: 'test@example.com' }
const renewed = { user, session: { access_token: newToken, refresh_token: 'rotated-refresh', expires_in: 3600 } }
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const waitForPrompt = async () => {
  for (let i = 0; i < 20 && !auth().isRenewalPending; i++) await setImmediate()
  assert.equal(auth().isRenewalPending, true)
}
const seedSession = () => {
  const session = saveSession({ access_token: oldToken, refresh_token: 'original-refresh' })
  useAuthStore.setState({ user, session })
}

beforeEach(() => {
  auth().clearAuth()
  storage.clear()
})
afterEach(() => {
  auth().clearAuth()
  mock.restoreAll()
})

test('expired startup shares initialization and keeps the renewed session', async () => {
  seedSession()
  useAuthStore.setState({ user: null, session: null })
  let refreshes = 0
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++
      assert.equal(options.headers.Authorization, undefined)
      assert.deepEqual(JSON.parse(options.body), { refresh_token: 'original-refresh' })
      return json(renewed)
    }
    return options.headers.Authorization === `Bearer ${newToken}`
      ? json({ user: { ...user, display_name: 'Test profile' } }) : json({}, 401)
  })

  const first = auth().initializeAuth()
  assert.equal(first, auth().initializeAuth())
  await waitForPrompt()
  assert.equal(refreshes, 0, 'renewal waits for consent')
  await auth().extendSession()
  await first
  assert.equal(refreshes, 1)
  assert.equal(auth().user.display_name, 'Test profile')
  assert.equal(auth().session.access_token, newToken)
  assert.equal(auth().session.refresh_token, 'rotated-refresh')
  assert.equal(auth().session.expires_at * 1000, getTokenExpiry(newToken))
  assert.equal(auth().isLoading, false)
})

test('a valid session initializes without asking for renewal', async () => {
  saveSession({ access_token: newToken, refresh_token: 'valid-refresh' })
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.endsWith('/auth/me'), true)
    assert.equal(options.headers.Authorization, `Bearer ${newToken}`)
    return json({ user })
  })
  await auth().initializeAuth()
  assert.deepEqual(auth().user, user)
  assert.equal(auth().session.refresh_token, 'valid-refresh')
  assert.equal(auth().isRenewalPending, false)
})

test('startup 401 renews and never restores the old access token', async () => {
  localStorage.setItem('authToken', 'token-without-local-expiry')
  localStorage.setItem('authRefreshToken', 'original-refresh')
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/auth/refresh')) return json(renewed)
    return options.headers.Authorization === `Bearer ${newToken}`
      ? json({ user }) : json({}, 401)
  })
  const initialization = auth().initializeAuth()
  await waitForPrompt()
  await auth().extendSession()
  await initialization
  assert.equal(auth().session.access_token, newToken)
  assert.equal(auth().session.refresh_token, 'rotated-refresh')
})

test('concurrent 401s and late responses use one prompt and one refresh', async () => {
  seedSession()
  let releaseLateResponse
  let refreshes = 0
  let prompts = 0
  const unsubscribe = useAuthStore.subscribe((state, previous) => {
    if (state.isRenewalPending && !previous.isRenewalPending) prompts++
  })
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++
      return json(renewed)
    }
    if (options.headers.Authorization === `Bearer ${oldToken}`) {
      if (url.endsWith('/late')) {
        return new Promise((resolve) => { releaseLateResponse = () => resolve(json({}, 401)) })
      }
      return json({}, 401)
    }
    if (url.includes('/save')) {
      assert.equal(url.endsWith('/save?draft=1'), true)
      assert.equal(options.method, 'POST')
      assert.deepEqual(JSON.parse(options.body), { text: 'Keep this draft' })
    }
    return json({ success: true })
  })

  try {
    const requests = [apiClient.get('/one'), apiClient.post('/save', { text: 'Keep this draft' }, { params: { draft: 1 } }), apiClient.get('/late')]
    await waitForPrompt()
    await Promise.all([auth().extendSession(), auth().extendSession()])
    releaseLateResponse()
    const responses = await Promise.all(requests)
    assert.equal(responses.every(({ status }) => status === 200), true)
    assert.equal(refreshes, 1)
    assert.equal(prompts, 1)
    assert.equal(localStorage.getItem('authRefreshToken'), 'rotated-refresh')
  } finally {
    unsubscribe()
  }
})

test('declining signs out and releases every waiting request', async () => {
  seedSession()
  const paths = []
  mock.method(globalThis, 'fetch', async (url) => {
    paths.push(url)
    return url.endsWith('/auth/logout') ? json({ success: true }) : json({}, 401)
  })
  const result = Promise.allSettled([apiClient.get('/one'), apiClient.get('/two')])
  await waitForPrompt()
  await auth().signOut()
  assert.equal((await result).every(({ status }) => status === 'rejected'), true)
  assert.equal(paths.some((path) => path.endsWith('/auth/refresh')), false)
  assert.equal(storage.size, 0)
  assert.equal(auth().user, null)
  assert.equal(auth().isRenewalPending, false)
})

for (const failure of ['invalid-refresh', 'network', 'invalid-response']) {
  test(`renewal failure (${failure}) clears the session without retry loops`, async () => {
    seedSession()
    let refreshes = 0
    mock.method(globalThis, 'fetch', async (url) => {
      if (!url.endsWith('/auth/refresh')) return json({}, 401)
      refreshes++
      if (failure === 'network') throw new TypeError('Failed to fetch')
      return failure === 'invalid-response' ? json({ session: {} }) : json({}, 401)
    })
    const result = Promise.allSettled([apiClient.get('/protected')])
    await waitForPrompt()
    await auth().extendSession()
    assert.equal((await result)[0].status, 'rejected')
    assert.equal(refreshes, 1)
    assert.equal(storage.size, 0)
    assert.equal(auth().user, null)
    assert.match(auth().error, /sign in again/)
  })
}

test('missing refresh token signs out without proposing an impossible renewal', async () => {
  seedSession()
  localStorage.removeItem('authRefreshToken')
  mock.method(globalThis, 'fetch', async () => json({}, 401))
  await assert.rejects(apiClient.get('/protected'))
  assert.equal(auth().isRenewalPending, false)
  assert.equal(auth().user, null)
  assert.equal(storage.size, 0)
})

test('a retried request still returning 401 signs out after one retry', async () => {
  seedSession()
  let attempts = 0
  mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/auth/refresh')) return json(renewed)
    attempts++
    return json({}, 401)
  })
  const result = Promise.allSettled([apiClient.get('/protected')])
  await waitForPrompt()
  await auth().extendSession()
  assert.equal((await result)[0].status, 'rejected')
  assert.equal(attempts, 2)
  assert.equal(storage.size, 0)
  assert.equal(auth().isRenewalPending, false)
})

test('invalid login credentials show an error without starting session renewal', async () => {
  seedSession()
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined)
    return json({ detail: 'Invalid credentials' }, 401)
  })
  const result = await auth().signInWithEmail({ email: user.email, password: 'incorrect' })
  assert.equal(result.error.message, 'Invalid credentials')
  assert.equal(auth().isRenewalPending, false)
})

test('signing out during refresh cannot restore the session', async () => {
  seedSession()
  let finishRefresh
  mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/auth/refresh')) {
      return new Promise((resolve) => { finishRefresh = () => resolve(json(renewed)) })
    }
    return json({ success: true })
  })
  const pending = auth().requestSessionExtension()
  const refresh = auth().extendSession()
  await auth().signOut()
  finishRefresh()
  await refresh
  assert.equal(await pending, false)
  assert.equal(auth().user, null)
  assert.equal(storage.size, 0)
})
