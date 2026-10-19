# --- base ---------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# --- dev (used by docker compose) -------------------------------------------
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- build ----------------------------------------------------------------
FROM base AS build
# Optional. The running container's API_BASE_URL overrides this.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN npm run build

# --- production (static files served by nginx) ----------------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security.conf /etc/nginx/security.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["sh", "/docker-entrypoint.sh"]
