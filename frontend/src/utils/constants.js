// API Endpoints
export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  DASHBOARD_SUMMARY: '/dashboard/summary',
  VOCABULARY_LIST: '/vocabulary/list',
  FLASHCARDS_DUE: '/flashcards/due',
  FLASHCARDS_SUBMIT: '/flashcards/submit',
  AI_CHAT: '/ai/chat',
  AI_INLINE: '/ai/inline',
}

// Learning Levels
export const LEARNING_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
}

// Flashcard States
export const ANSWER_QUALITY = {
  FORGOT: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
}

// Deck Visibility
export const DECK_VISIBILITY = {
  PRIVATE: 'private',
  PUBLIC: 'public',
}
