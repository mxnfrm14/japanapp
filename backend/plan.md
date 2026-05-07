## Plan: FastAPI Backend API for JapanApp

Build the FastAPI backend as the single data-access layer for the frontend, aligned with the PRD: the frontend never talks to Supabase directly, and the backend owns auth verification, read APIs, future write APIs, and Ollama orchestration. The safest first step is to define read-focused resource endpoints for the app's core learning surfaces, while keeping the current Supabase proxy pattern and expanding it into a reusable service layer.

The schema update gives us a concrete contract to implement against. The backend can now target `vocabulary_item`, `kanji_item` with `stroke_order_gif_uri`, `kana_item`, `kanji_vocabulary_link`, `daily_word` with `carried_over` and `source_daily_word_id`, `flashcard`, `user_vocabulary_state`, `user_kana_progress`, `user_kanji_progress`, `progress_snapshot`, `study_session`, `review_record`, `ai_conversation`, and `ai_message`. That means the API plan should mirror those tables instead of inventing generic payloads.

**Steps**
1. Establish the API boundary and route layout *depends on current app structure*.
   - Keep [backend/app/main.py](backend/app/main.py) as the app entrypoint and split router registration by domain instead of leaving everything in one file.
   - Move beyond the current auth-only router in [backend/app/routes/routes.py](backend/app/routes/routes.py) by introducing resource routers for vocabulary, kanji, kana, decks, flashcards, dashboard, daily word, and AI.
   - Preserve the existing auth endpoints as the starting reference for request/response style and bearer-token handling.

2. Define backend response models and contracts *depends on step 1*.
   - Fill out [backend/app/models/models.py](backend/app/models/models.py) with Pydantic models for the frontend-facing payloads.
   - Model the schema-driven responses: dashboard summary, paginated vocabulary lists, kanji list/detail payloads, daily word, due flashcards, AI conversation summaries, and brief word-click lookup responses.
   - Include schema-specific fields where useful: `kanji_item.stroke_order_gif_uri`, `daily_word.carried_over`, `daily_word.source_daily_word_id`, `progress_snapshot.snapshot_date`, and the kanji progress `status` enum.
   - Keep response shapes consistent with the frontend hooks in [frontend/src/hooks/useApi.js](frontend/src/hooks/useApi.js) and the endpoint constants in [frontend/src/utils/constants.js](frontend/src/utils/constants.js).

3. Expand the service layer into Supabase-backed query functions *depends on step 1*.
   - Extend [backend/app/services/services.py](backend/app/services/services.py) with helpers for authenticated reads against Supabase REST using the existing httpx pattern.
   - Add dedicated functions for paginated vocabulary reads, kanji list/detail reads, kanji-to-vocabulary links, dashboard summary aggregation, daily word lookup, flashcard due queues, progress reads, and AI conversation/message retrieval.
   - Reuse the current header builders and decide where service-role access is required versus user-token access.

4. Implement the MVP read endpoints first *depends on steps 2 and 3*.
   - Add `/dashboard/summary`, `/vocabulary/list`, `/vocabulary/{id}`, `/kanji`, `/kanji/{id}`, `/kanji/{id}/vocabulary`, `/daily-word`, and `/flashcards/due` as the initial backend contract for the frontend.
   - Include pagination and constrained field selection on every unbounded list endpoint so the frontend can load progressively.
   - Make kanji detail return the learning-relevant fields from the schema: meaning, readings, stroke count, radical, JLPT level, frequency rank, components, and GIF URI.
   - Keep the word-click payload minimal, matching the PRD: translation, furigana when needed, and a short kanji explanation.

5. Add auth-aware write paths only where the MVP needs them *parallel with step 4 if scope includes mutations*.
   - If the scope includes current user actions, wire `/auth/me`, `/auth/login`, `/auth/signup`, `/auth/logout`, and the first flashcard submit endpoint.
   - Add AI conversation endpoints only if the frontend is ready to consume them now; otherwise keep them as a separate follow-up slice.
   - Keep mutation endpoints small and use the same token validation approach already present in [backend/app/routes/routes.py](backend/app/routes/routes.py).

6. Align the frontend to the backend contract *depends on step 4*.
   - Update [frontend/src/services/api.js](frontend/src/services/api.js) only if request/response shape or auth token behavior changes.
   - Update [frontend/src/hooks/useApi.js](frontend/src/hooks/useApi.js) to consume the new backend payloads directly rather than assuming placeholder contracts.
   - Verify that [frontend/src/utils/constants.js](frontend/src/utils/constants.js) matches the actual backend route paths after the backend routes are finalized.

7. Verify the backend end-to-end *depends on steps 4-6*.
   - Run FastAPI validation and the narrowest available checks for the touched backend files.
   - Confirm the frontend can fetch a vocabulary page, a kanji detail page, the daily word, and the dashboard summary through the backend without calling Supabase directly.
   - Check that read endpoints respect auth and RLS assumptions, especially for reference content versus user-owned data.

**Relevant files**
- `c:\Users\m1fro\Desktop\code\japanapp\backend\app\main.py` — app entrypoint and router registration.
- `c:\Users\m1fro\Desktop\code\japanapp\backend\app\routes\routes.py` — current auth router pattern to split and reuse.
- `c:\Users\m1fro\Desktop\code\japanapp\backend\app\services\services.py` — existing Supabase/httpx service layer to extend.
- `c:\Users\m1fro\Desktop\code\japanapp\backend\app\models\models.py` — response models for the API contract.
- `c:\Users\m1fro\Desktop\code\japanapp\backend\app\config.py` — settings and environment values for Supabase and AI.
- `c:\Users\m1fro\Desktop\code\japanapp\frontend\src\hooks\useApi.js` — frontend hook expectations for API responses.
- `c:\Users\m1fro\Desktop\code\japanapp\frontend\src\services\api.js` — fetch client and auth header behavior.
- `c:\Users\m1fro\Desktop\code\japanapp\frontend\src\utils\constants.js` — route constants that must align with backend endpoints.
- `c:\Users\m1fro\Desktop\code\japanapp\pp.md` — PRD and backend/data rules that define scope.
- `c:\Users\m1fro\Desktop\code\japanapp\supabase\migrations\init_japanapp.sql` — the schema contract driving backend payloads and joins.

**Verification**
1. Confirm route coverage against the PRD: dashboard, vocabulary browsing, kanji detail and links, daily word, flashcards, and AI endpoints.
2. Validate that backend responses match frontend hook expectations for pagination and auth shape.
3. Run backend validation on the touched files once implementation starts, then smoke-test one read endpoint per major resource.

**Decisions**
- Keep the current FastAPI-to-Supabase proxy approach for MVP rather than switching to a direct DB layer.
- Start with read-focused endpoints because the PRD makes frontend-to-backend-only data access the core boundary and the UI needs data before deeper mutation flows.
- Treat kanji detail as a first-class backend resource, not just a vocabulary side-effect, because the PRD explicitly requires kanji pages, stroke/decomposition support, and bidirectional kanji-vocabulary navigation.

**Further Considerations**
1. Should the backend expose a single aggregated home endpoint that returns daily word, due reviews, and progress together, or should the frontend compose smaller calls? I recommend a single summary endpoint for the home screen.
2. Should the kanji list include `stroke_order_gif_uri` or keep that detail-only? I recommend detail-first unless the list view actually renders the animation.
3. Should auth stay proxied through Supabase password grant as it does now, or should the backend own a more explicit session contract later? I recommend keeping the current proxy approach for this MVP slice.