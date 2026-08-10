# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: `frontend/` — the React app. This is the only part of the repo edited from this machine; the
backend lives on a separate server (see the root `CLAUDE.md`).

## Commands

```bash
pnpm install
pnpm dev      # Vite on :5173
pnpm lint     # must pass — CI gate
pnpm build    # must pass — CI gate
pnpm preview
```

`VITE_API_BASE_URL` selects the backend (defaults to `http://localhost:8000`). Since the real backend runs
on a server, point this at that host rather than expecting a local FastAPI process.

Lint note: `no-unused-vars` is an **error**, with `varsIgnorePattern: '^[A-Z_]'`. An unused lowercase
import or variable fails CI.

## Data access

`src/services/api.js` is a hand-rolled `fetch` wrapper — **not axios**, despite what the root README says.
It exposes only `apiClient.get(path, { params })` and `apiClient.post(path, body)`. There is no `put`,
`patch`, or `delete`; add them to this module rather than calling `fetch` from a component.

It handles three things centrally: JSON headers, `Authorization: Bearer <localStorage.authToken>`, and
401 → clear tokens + `window.location.href = '/login'`. Thrown errors carry `error.response = { status, data }`.

Two fetching patterns coexist:
- **React Query** (`QueryClientProvider` is wired in `main.jsx`) via hooks in `src/hooks/useApi.js`.
  Currently only `useSearch` is actually consumed (by `components/Search.jsx`).
- **Direct `apiClient` calls inside `useEffect`** with a local `isActive` cancellation flag — this is what
  the pages do today (`Vocabulary.jsx`, `KanjiDetail.jsx`, …).

Prefer React Query for new data fetching, and check `src/hooks/useApi.js` before writing a new hook —
several vocabulary/tag hooks already exist there unused.

Several hooks in `useApi.js` target endpoints the backend doesn't implement yet (dashboard, flashcards).
Verify against the endpoint table in the root `CLAUDE.md` before building UI on top of one.

## Routing & layout

`src/App.jsx` declares every route explicitly, each manually wrapped in `<ProtectedRoute><Layout>`. Adding
a page means adding that full wrapper — there is no shared layout route.

`ProtectedRoute` reads `useAuthStore()`; auth state is bootstrapped once by `initializeAuth()` in `App`.

`components/Layout.jsx` does more than layout:
- It **clones its child element and injects an `aiPrompt` prop**. Pages that want the "Ask AI about
  selection" text must accept `aiPrompt` in their props signature.
- It tracks text selection globally and renders a floating "Ask AI about selection" button.
- On desktop, non-home/settings/ai pages get a side AI chat panel that shrinks content to `w-3/4`. Wide page
  layouts must survive that.
- Mobile (`<768px`) swaps the sidebar for `BottomNav`.

## Styling

Tailwind **v4**. All design tokens live in the `@theme` block at the top of `src/index.css`; `tailwind.config.js`
only carries content paths and `darkMode: 'class'`. daisyUI is loaded as a Tailwind plugin, so `btn`,
`btn-primary`, `badge` etc. are available and used.

Use the semantic token utilities, never raw hex or arbitrary colors:

| Purpose | Classes |
|---|---|
| Surfaces | `bg-bg`, `bg-bg-card`, `bg-surface` |
| Text | `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-inverse` |
| Accent | `text-primary`, `bg-primary`, `border-primary` (deep Japanese red) |
| Fonts | `font-display` (headings), `font-ui`, `font-cjk` / `font-display` for Japanese glyphs |

Dark mode is a `.dark` class on `<html>`, toggled by `contexts/ThemeContext.jsx` (persisted to
`localStorage.theme`, defaults to `prefers-color-scheme`). Pair every custom border/background with a
`dark:` variant — e.g. `border-gray-200 dark:border-gray-700`, the pattern used throughout the pages.

`Guidelines.md` in this folder is the design-intent document (color meaning, spacing scale, touch targets,
Japanese typography rules, mobile-first breakpoints). Follow its *intent*, but note its code samples are
stale: they show `.tsx` files and inline `style={{ color: 'var(--accent-red)' }}`, whereas the real code is
`.jsx` using the Tailwind token classes above. When they conflict, match the existing `.jsx` pages.

Japanese text should be visually larger than Latin text and always rendered with a font stack that includes
Noto Sans JP (`font-display`/`font-cjk` both do).

## Conventions in existing pages

- Components are default-exported function components; small presentational subcomponents (cards, rows) live
  in the same file as the page that uses them.
- Navigation to a detail page passes the already-loaded record through router state as a render hint:
  `navigate(\`/vocabulary/${item.id}\`, { state: { item } })` — the detail page still refetches.
- Loading / error / empty are rendered as three explicit branches in the page body, not via a shared component.
- Icons come from `@phosphor-icons/react`.
