# Quartinho — dev convenience targets.
# `make up` starts the full stack (emulator + api + web) via Docker Compose.
# Run `make help` for the list.

SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help install up down logs seed seed-extra reset dev api web stop \
        lint typecheck test test-emulators test-all \
        e2e e2e-install build clean \
        status

# ─── Meta ───────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies (host — for IDE, tests, etc)
	bun install

# ─── Docker Compose lifecycle ───────────────────────────────────────────

up: ## Start full stack: emulator + api + web (Docker, background)
	docker compose up -d --build
	@echo "→ waiting for emulator hub on :4400"
	@for i in $$(seq 1 40); do \
		curl -sf http://localhost:4400/ >/dev/null && echo "✓ emulator ready" && break; \
		sleep 2; \
	done
	@echo "→ waiting for api on :3001"
	@for i in $$(seq 1 30); do \
		curl -sf http://localhost:3001/health -o /dev/null && echo "✓ api ready" && break; \
		sleep 2; \
	done
	@echo ""
	@echo "  App:          http://localhost:5173"
	@echo "  API:          http://localhost:3001"
	@echo "  Emulator UI:  http://localhost:4000"
	@echo ""

down: ## Stop all containers
	docker compose down

logs: ## Tail all container logs
	docker compose logs -f

logs-api: ## Tail api logs only
	docker compose logs -f api

logs-web: ## Tail web logs only
	docker compose logs -f web

logs-emulator: ## Tail emulator logs only
	docker compose logs -f firebase-emulators

# ─── Seeding ────────────────────────────────────────────────────────────

seed: ## Seed emulator with admin user + sample event (needs .env.seed)
	@test -f .env.seed || (echo "✗ .env.seed missing. Run: cp .env.seed.example .env.seed"; exit 1)
	bun run seed
	docker exec gustavo_quartinho-api-1 bash /app/scripts/make-admin.sh admin@quartinho.local

seed-extra: ## Seed extra: more users, events, RSVPs, products, links, banners
	@test -f .env.seed || (echo "✗ .env.seed missing. Run: cp .env.seed.example .env.seed"; exit 1)
	bun run seed-extra

reset: down ## Wipe emulator data and start fresh (DESTRUCTIVE)
	rm -rf .firebase-data
	mkdir -p .firebase-data
	$(MAKE) up
	@sleep 5
	$(MAKE) seed

# ─── Native dev (no Docker — for IDE hot-reload or debugging) ──────────

dev-api: ## Run API natively (watch) against emulator — foreground
	bun run --filter=api dev

dev-web: ## Run Vite natively against emulator — foreground
	VITE_USE_EMULATOR=true VITE_API_URL=http://localhost:3001 bun run --filter=web dev

# ─── Quality gates ──────────────────────────────────────────────────────

lint: ## ESLint api + web
	bun run lint

typecheck: ## tsc --noEmit across workspaces
	bun run typecheck

test: ## Unit tests (api + web, vitest)
	bun run test

test-emulators: ## API integration tests against running emulator (needs `make up`)
	bun run test:emulators

test-integration: ## RSVP integration tests against emulator + MailDev (needs `make up` + maildev)
	docker compose --profile test up -d maildev
	@echo "→ waiting for MailDev on :1080"
	@for i in $$(seq 1 15); do \
		curl -sf http://localhost:1080 -o /dev/null && echo "✓ maildev ready" && break; \
		sleep 1; \
	done
	cd api && bun run test:integration

test-all: lint typecheck test test-emulators ## Run every check below E2E

# ─── E2E ────────────────────────────────────────────────────────────────

e2e-install: ## Download Playwright chromium browser
	bun run --filter=web e2e:install

e2e: ## Run Playwright E2E (auto-starts vite; requires emulator + api + seed)
	bun run --filter=web e2e

# ─── Production ────────────────────────────────────────────────────────

deploy: ## Build web + deploy to Firebase Hosting
	source .github/secrets.env && bun run --filter=web build && bunx firebase-tools deploy --only hosting --project teste-qbh --token "$$FIREBASE_TOKEN"

deploy-rules: ## Deploy Firestore/RTDB/Storage security rules
	source .github/secrets.env && bunx firebase-tools deploy --only firestore:rules,database:rules,storage:rules --project teste-qbh --token "$$FIREBASE_TOKEN"

admin: ## Promote email to admin in production: make admin EMAIL=user@example.com
	@test -n "$(EMAIL)" || (echo "Uso: make admin EMAIL=user@example.com"; exit 1)
	bun api/scripts/make-admin.ts "$(EMAIL)"

reset-prod: ## DESTRUCTIVE: wipe all production data (Firestore + instructions for Auth)
	./scripts/reset-prod.sh

# ─── Build / clean ──────────────────────────────────────────────────────

build: ## Production build of api + web
	bun run build

clean: ## Remove build artifacts + caches (keeps .firebase-data)
	rm -rf web/dist api/dist .turbo web/.turbo api/.turbo
	find . -name "*.tsbuildinfo" -delete

# ─── Status ─────────────────────────────────────────────────────────────

stop: down ## Alias for `make down`

status: ## Show what's running locally
	@echo "─ docker ─"
	@docker ps --format '  {{.Names}}  {{.Status}}' 2>/dev/null | grep -E "firebase|api|web" || echo "  (no containers)"
	@echo "─ ports ─"
	@for p in 3001 4000 4400 5173 8085 9000 9099 9199; do \
		if lsof -i :$$p -sTCP:LISTEN -n -P >/dev/null 2>&1; then \
			who=$$(lsof -i :$$p -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR==2 {print $$1}'); \
			echo "  :$$p  UP   ($$who)"; \
		else \
			echo "  :$$p  down"; \
		fi; \
	done
