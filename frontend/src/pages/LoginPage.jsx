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
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4 bg-bg">
        <div className="absolute rounded-full pointer-events-none w-[288px] h-[288px] top-[33%] left-[-96px] bg-secondary opacity-[0.15]" />
        <div className="absolute rounded-full pointer-events-none w-[256px] h-[256px] -top-[56px] right-[-64px] border border-primary opacity-[0.2]" />

        <div className="max-w-md w-full bg-surface rounded-xl border border-gray-300 dark:border-gray-600 shadow-lg p-6">
          <h1 className="text-3xl font-bold text-text-primary">You are already signed in</h1>
          <p className="mt-3 text-sm text-text-secondary">Your session is active. Continue to your dashboard to manage your profile and explore the app.</p>
          <button type="button" onClick={() => navigate('/')} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-white font-medium h-10 px-4 mt-7 tracking-wide transition-all duration-200 shadow-[0_6px_18px_rgba(143,0,32,0.20)] hover:bg-primary-hover hover:-translate-y-[1px] hover:shadow-md active:bg-primary-pressed active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed">Go to App</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4 bg-bg">
      <div className="absolute rounded-full pointer-events-none w-[288px] h-[288px] top-[33%] left-[-96px] bg-secondary opacity-[0.15]" />
      <div className="absolute rounded-full pointer-events-none w-[256px] h-[256px] -top-[56px] right-[-64px] border border-primary opacity-[0.2]" />

      <div className="w-full max-w-[980px] mx-auto flex justify-center">
        <section className="w-full max-w-[540px] rounded-xl border border-gray-300 dark:border-gray-600 shadow-lg bg-surface p-8">
          {/* Mode Toggle */}
          <div className="inline-flex rounded-sm bg-surface-raised p-1">
            <button type="button" onClick={() => { setMode('signin'); setMessage('') }} className={`px-4 py-2 rounded-sm font-medium ${mode === 'signin' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'}`}>Sign in</button>
            <button type="button" onClick={() => { setMode('signup'); setMessage('') }} className={`px-4 py-2 rounded-sm font-medium ${mode === 'signup' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'}`}>Sign up</button>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold mt-6 text-text-primary">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-2 text-sm text-text-secondary">{mode === 'signin' ? 'Sign in to continue where you left off.' : 'Register with email and start exploring JapanApp.'}</p>

          <form className="mt-7 flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col">
              <label htmlFor="email" className="mb-2 text-sm font-medium text-text-secondary">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" className="w-full transition-all duration-200 ease-in-out font-sans text-base px-4 py-3 border border-border rounded-md bg-surface text-text-primary placeholder:text-text-disabled focus:outline-2 focus:outline-primary focus:outline-offset-0 focus:border-primary focus:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>

            <div className="flex flex-col">
              <label htmlFor="password" className="mb-2 text-sm font-medium text-text-secondary">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" className="w-full transition-all duration-200 ease-in-out font-sans text-base px-4 py-3 border border-border rounded-md bg-surface text-text-primary placeholder:text-text-disabled focus:outline-2 focus:outline-primary focus:outline-offset-0 focus:border-primary focus:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>

            {error && <div className="rounded-md border px-4 py-3 text-sm text-text-error bg-text-error-subtle">{error}</div>}
            {message && <div className="rounded-md border px-4 py-3 text-sm text-text-success bg-text-success-subtle">{message}</div>}

            <div className="pt-2">
              <button type="submit" disabled={isLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary text-white font-medium h-10 px-4 tracking-wide transition-all duration-200 shadow-[0_6px_18px_rgba(143,0,32,0.20)] hover:bg-primary-hover hover:-translate-y-[1px] hover:shadow-md active:bg-primary-pressed active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed">{isLoading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
            </div>

            <div className="pt-4 text-center text-sm text-text-secondary">
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }} className="text-primary font-semibold">{mode === 'signin' ? 'Create one' : 'Sign in'}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default LoginPage
