import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import './LoginPage.css'

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
      <div className="login-container login-bg-gradient">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />

        <div className="card login-card max-w-md">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            You are already signed in
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Your session is active. Continue to your dashboard to manage your profile and explore the app.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-primary btn-md mt-7 w-full"
          >
            Go to App
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container login-bg-gradient">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className="login-grid">
        {/* Form Section (sidebar removed) */}
        <section className="login-form-section login-form-centered">
          {/* Mode Toggle */}
          <div className="login-toggle">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setMessage('')
              }}
              className={`login-toggle-btn ${mode === 'signin' ? 'active' : ''}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setMessage('')
              }}
              className={`login-toggle-btn ${mode === 'signup' ? 'active' : ''}`}
            >
              Sign up
            </button>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold mt-6" style={{ color: 'var(--color-text-primary)' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {mode === 'signin'
              ? 'Sign in to continue where you left off.'
              : 'Register with email and start exploring JapanApp.'}
          </p>

          {/* Form */}
          <form className="login-form" onSubmit={onSubmit}>
            {/* Email Field */}
            <div className="login-field">
              <label htmlFor="email" className="login-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="login-input"
                placeholder="you@example.com"
              />
            </div>

            {/* Password Field */}
            <div className="login-field">
              <label htmlFor="password" className="login-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="login-input"
                placeholder="At least 6 characters"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="login-alert login-alert-error">
                {error}
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="login-alert login-alert-success">
                {message}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-secondary btn-md w-full"
              >
                {isLoading
                  ? 'Loading...'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </div>

            {/* Toggle Mode Link */}
            <div className="login-toggle-link">
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setMessage('')
                }}
                className="login-link"
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
