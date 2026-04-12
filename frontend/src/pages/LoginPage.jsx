import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

function LoginPage() {
  const navigate = useNavigate()
  const { signInWithEmail, signUpWithEmail, isLoading, error, user } = useAuthStore()

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    const action = mode === 'signin' ? signInWithEmail : signUpWithEmail
    const result = await action({ email, password })

    if (!result.error) {
      if (mode === 'signin') {
        navigate('/')
        return
      }

      setMessage('Sign-up successful. Check your email for a confirmation link if required.')
    }
  }

  if (user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f2ea] px-4 py-10">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#f4b47a]/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-[#d84a30]/25 blur-3xl" />

        <div className="relative w-full max-w-lg rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_-28px_rgba(98,46,34,0.45)] backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight text-[#2f1b16]">You are already signed in</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#7a5e54]">Your session is active. Continue to your dashboard to manage your profile and explore the app.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-7 w-full rounded-xl bg-[#20262f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#111822] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20262f]"
          >
            Go to App
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f2ea] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,108,66,0.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(240,180,122,0.25),transparent_38%),radial-gradient(circle_at_85%_85%,rgba(85,120,141,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full border border-[#b66b47]/20" />
      <div className="pointer-events-none absolute -right-16 -top-14 h-64 w-64 rounded-full border border-[#6f8b9d]/25" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white/75 shadow-[0_30px_80px_-25px_rgba(98,46,34,0.42)] backdrop-blur lg:grid-cols-[1.1fr_1fr]">
        <aside className="relative flex flex-col justify-between bg-[#1f3543] px-7 py-8 text-[#fef6ec] sm:px-10 sm:py-10">
          <div>
            <p className="inline-flex rounded-full border border-[#f8c78f]/40 bg-[#f8c78f]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffd8ad]">
              JapanApp
            </p>
            <h1 className="mt-6 max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Plan, learn, and travel with confidence.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#d0dee6]">
              Access your personalized tools and continue your journey from language practice to itinerary building.
            </p>
          </div>

          <div className="mt-8 flex gap-3 text-xs text-[#d0dee6] sm:text-sm">
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">Fast secure auth</div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">Email confirmation</div>
          </div>
        </aside>

        <section className="bg-white/95 px-6 py-8 sm:px-10 sm:py-10">
          <div className="inline-flex rounded-xl bg-[#f6eee6] p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setMessage('')
              }}
              className={`rounded-lg px-4 py-2 font-medium transition ${
                mode === 'signin'
                  ? 'bg-white text-[#2f1b16] shadow'
                  : 'text-[#7a5e54] hover:text-[#2f1b16]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setMessage('')
              }}
              className={`rounded-lg px-4 py-2 font-medium transition ${
                mode === 'signup'
                  ? 'bg-white text-[#2f1b16] shadow'
                  : 'text-[#7a5e54] hover:text-[#2f1b16]'
              }`}
            >
              Sign up
            </button>
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-[#2f1b16]">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#7a5e54]">
            {mode === 'signin'
              ? 'Sign in to continue where you left off.'
              : 'Register with email and start exploring JapanApp.'}
          </p>

          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#5d3f35]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-[#ddcdbf] bg-[#fffcf8] px-4 py-3 text-sm text-[#2f1b16] outline-none transition placeholder:text-[#b49a8d] focus:border-[#d46c42] focus:ring-2 focus:ring-[#d46c42]/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#5d3f35]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-[#ddcdbf] bg-[#fffcf8] px-4 py-3 text-sm text-[#2f1b16] outline-none transition placeholder:text-[#b49a8d] focus:border-[#d46c42] focus:ring-2 focus:ring-[#d46c42]/20"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-[#d24f2f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#be3f21] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d24f2f] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isLoading
                  ? 'Loading...'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </div>

            <div className="pt-1 text-center text-sm text-[#8d7368]">
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setMessage('')
                }}
                className="font-semibold text-[#1f3543] underline-offset-2 hover:underline"
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default LoginPage
