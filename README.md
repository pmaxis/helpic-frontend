# Helpic — frontend

Vue 3 SPA for Helpic. Runs in its own Docker Compose project; the API lives in [`../backend`](../backend) with its own `.env` and containers.

## Stack

Vue 3, TypeScript, Vite, Tailwind CSS 4, Pinia, Vue Router, axios.

## Getting started

Requires Docker and the backend running (`cd ../backend && make up`).

```sh
cp .env.example .env
make up                   # or: docker compose up -d --build
```

Open http://localhost:5180. The source is bind-mounted, so changes hot-reload.

Production-like build (nginx): `make prod` → http://localhost:8091.

Without Docker: `npm install && npm run dev` (set `VITE_PROXY_TARGET=http://localhost:8090` or leave it unset).

## Configuration

See [`.env.example`](.env.example):

- `VITE_API_BASE_URL` — the API URL the browser calls; baked into the production bundle at build time;
- `VITE_PROXY_TARGET` — where the dev server proxies `/api`; the backend is another compose project, so it is reached through the host;
- `FRONTEND_PORT`, `FRONTEND_PROD_PORT` — host ports.

## Layout

```
src/
  views/             login, register, invite (accept), tasks, task detail,
                     projects, project detail, clients (freelancer),
                     freelancers (client), settings
  layouts/           auth layout, dashboard layout with sidebar
  components/        ui kit, auth, navigation, tasks, board (kanban), projects, people
  stores/            Pinia stores
  services/api.ts    HTTP client (cookies, 401 handling)
  router/            routes, auth guard, per-role pages (meta.role)
  constants/mainNav  sidebar items per role
```
