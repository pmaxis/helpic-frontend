# Helpic — frontend

Vue SPA for Helpic, a workspace for freelancers and their clients: tasks, projects, kanban boards, time tracking and reports, in English and Ukrainian, light and dark. API: [helpic-backend](https://github.com/pmaxis/helpic-backend).

**Stack:** Vue 3, TypeScript, Vite, Tailwind CSS 4, Pinia, Vue Router, vue-i18n.

## Run

Requires Docker and the backend running.

```sh
cp .env.example .env
make up                 # http://localhost:5180, hot reload
```

- Production build behind nginx: `make prod` → http://localhost:8091
- Without Docker: `pnpm install && pnpm dev` → http://localhost:5173
- Type-check and build: `make test`

## Configuration

[`.env.example`](.env.example):

- `VITE_API_BASE_URL`: the API the browser calls. The production image can override it at start with `API_BASE_URL`.
- `VITE_PROXY_TARGET`: where the dev server proxies `/api`.
- `FRONTEND_PORT`, `FRONTEND_PROD_PORT`: host ports.

## Layout

```
src/
  views/          pages
  components/     UI kit and feature components
  layouts/        auth and app (sidebar) layouts
  stores/         Pinia stores
  services/       API client and calls
  router/         routes and guards
  i18n/           English and Ukrainian messages
  admin/          admin panel, loaded only when opened
```
