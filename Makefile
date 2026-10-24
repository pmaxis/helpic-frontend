.DEFAULT_GOAL := help
COMPOSE := docker compose
# The build's version, as the backend names its own; the admin panel shows it.
export VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

.PHONY: help dev up down build logs prod test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev: ## Build and start the Vite dev server in the foreground
	$(COMPOSE) up --build

up: ## Start the Vite dev server in the background
	$(COMPOSE) up -d --build

down: ## Stop and remove the containers
	$(COMPOSE) --profile prod down

build: ## Build the Docker images
	$(COMPOSE) build

logs: ## Follow container logs
	$(COMPOSE) logs -f

prod: ## Build and serve the production bundle via nginx
	$(COMPOSE) --profile prod up -d --build frontend-prod

test: ## Run the tests, type-check and build
	pnpm install --frozen-lockfile && pnpm run test && pnpm run build
