# JapanApp CI/CD Plan

## Goal

Set up a small, reliable pipeline that catches issues before merge and makes production releases repeatable.

The current repo is split into a FastAPI backend and a Vite frontend, so the pipeline should validate both halves independently and only deploy when both pass.

## Recommended Shape

Use GitHub Actions for CI and a simple first deployment target for CD.

Recommended default:
- CI on every pull request
- CD on merges to `main`
- Separate backend and frontend jobs so failures are easy to isolate

If the deployment target is not decided yet, keep the CD workflow disabled until the hosting destination is chosen.

## CI Plan

### Backend checks

Run these from `backend/`:
- install Python dependencies from `requirements.txt`
- validate Python syntax for the app package
- run the backend test suite

Suggested minimum commands:
- `python -m compileall app`
- `pytest`

If `pytest` is not yet installed in the backend environment, add it before wiring the workflow.

### Frontend checks

Run these from `frontend/`:
- install dependencies with `pnpm`
- lint the app
- build the production bundle

Suggested minimum commands:
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm build`

### CI gates

Block merge unless all of the following pass:
- backend syntax check
- backend tests
- frontend lint
- frontend build

## CD Plan

### Option A: Docker-based deploy

Best fit if you want one packaging path for local development and production.

Pipeline shape:
- build backend container
- tag the image with the commit SHA and `latest` on `main`
- push to a container registry
- deploy the new image to the target host or platform

This is the cleanest long-term route because the README already documents Docker for backend production runs.

### Option B: Simple host deploy

Best fit if the first production target is a VPS or home server.

Pipeline shape:
- build backend and frontend artifacts
- copy the new files to the host
- restart the backend service
- publish the frontend build output

This is faster to stand up, but it is less portable than container-based deploys.

## Environment And Secrets

Store these in GitHub Actions secrets or the deployment platform secret store:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not inject backend service secrets into the frontend build unless the value is explicitly public.

## Files To Add Next

1. `.github/workflows/ci.yml` for PR validation.
2. `.github/workflows/deploy.yml` for `main` deployments.
3. `backend/Dockerfile` if Docker is the chosen deploy path.
4. Frontend build or hosting configuration if the frontend is hosted separately.

## Suggested Implementation Order

1. Add CI first and make it pass locally.
2. Add a backend container build once the backend workflow is stable.
3. Add frontend build validation and artifact publishing.
4. Add CD only after the deployment target is confirmed.

## Open Decision

The only major unresolved item is the deployment destination.

If you want, the next step can be one of these:
1. GitHub Actions CI only
2. Full GitHub Actions CI/CD with Docker
3. CI/CD for a specific host like Render, Fly, Railway, or a VPS