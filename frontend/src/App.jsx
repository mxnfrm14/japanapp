import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import Home from './pages/Home'
import Kana from './pages/Kana'
import Kanji from './pages/Kanji'
import KanjiDetail from './pages/KanjiDetail'
import Vocabulary from './pages/Vocabulary'
import VocabularyDetail from './pages/VocabularyDetail'
import Flashcards from './pages/Flashcards'
import AIChat from './pages/AIChat'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import { ThemeProvider } from './contexts/ThemeContext'

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg">
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={(
              <ProtectedRoute>
                <Layout>
                  <Home />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/kana" element={(
              <ProtectedRoute>
                <Layout>
                  <Kana />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/kanji" element={(
              <ProtectedRoute>
                <Layout>
                  <Kanji />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/kanji/:kanjiId" element={(
              <ProtectedRoute>
                <Layout>
                  <KanjiDetail />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/vocabulary" element={(
              <ProtectedRoute>
                <Layout>
                  <Vocabulary />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/vocabulary/:vocabularyId" element={(
              <ProtectedRoute>
                <Layout>
                  <VocabularyDetail />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/flashcards" element={(
              <ProtectedRoute>
                <Layout>
                  <Flashcards />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/ai" element={(
              <ProtectedRoute>
                <Layout>
                  <AIChat />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="/settings" element={(
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            )}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
