# modaf-backend conventions

> This file is the source of truth for the modaf-backend peak. It is loaded on every boot via `boot_files` in `peak.yaml`. All rules here are enforced by the `backend-phase-workflow` and `backend-doctor` skills.

---

## Source-of-truth hierarchy

When guidance conflicts, the higher-ranked source wins:

1. **Project docs** — the project's own documentation, ADRs, and configuration files
2. **Peak internal docs** — the 20 reference documents in `knowledge/backend-internal/`
3. **Peak templates** — the 6 templates in `templates/`

If a project doc explicitly overrides a peak convention (e.g., "we use MySQL instead of PostgreSQL"), the project doc wins and the peak adapts accordingly.

---

## Default tech stack

| Layer | Default | Notes |
|-------|---------|-------|
| Runtime | **Node.js + TypeScript** | Strict mode, ESM modules |
| Database | **PostgreSQL** via Prisma or Drizzle | Default ORM is Prisma; Drizzle as lightweight alternative |
| Cache | **Redis** | Used for caching, sessions, pub/sub, and queue backing store |
| Containerization | **Docker** | Multi-stage builds, non-root user, health checks |
| CI/CD | **GitHub Actions** | Lint, test, build, deploy pipeline |

### Escape hatches

The following substitutions are supported. When activated, the peak adjusts all guidance, templates, and doctor checks:

| Layer | Alternatives |
|-------|-------------|
| Runtime | Python (FastAPI/Django), Go (stdlib/Gin/Echo), Rust (Actix/Axum) |
| Database | MySQL, MongoDB, SQLite, CockroachDB |
| ORM | TypeORM, Knex, Sequelize, SQLAlchemy, GORM, raw SQL |
| Queue system | RabbitMQ, Amazon SQS, Celery, Temporal |
| Cache | Memcached, in-memory (node-cache / lru-cache) |
| Containerization | Podman, Nix |
| CI/CD | GitLab CI, CircleCI, Jenkins, Dagger |

To activate an escape hatch, declare it in your project docs or tell the workflow skill directly. The peak will not fight your choices.

---

## 15 global backend build rules

These rules apply to every phase and every project that uses this peak. They are non-negotiable unless a project doc explicitly overrides them (see source-of-truth hierarchy above).

### 1. API-first design
Write the OpenAPI specification before writing implementation code. The spec is the contract. Code is generated or validated against it.

### 2. Database migrations are immutable
Once a migration has been applied to any shared environment (staging, production), it must never be modified. Create a new migration to alter schema. Squashing is allowed only for unapplied local migrations.

### 3. Every endpoint has input validation
All request bodies, query parameters, and path parameters must be validated at the boundary. Default validators: Zod (TypeScript), Pydantic (Python), or equivalent. Reject invalid input with a `400` response before it reaches business logic.

### 4. Every endpoint has rate limiting
No endpoint is exempt. Public endpoints get stricter limits. Authenticated endpoints get per-user limits. Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) must be present on every response.

### 5. Auth on every non-public route
Every route is authenticated by default. Public routes must be explicitly marked as such. Authorization checks (roles, permissions, ownership) happen in middleware or guards, never inline in controllers.

### 6. Structured logging on every request
All log output is JSON. Every request logs: request ID, method, path, status code, duration, and user ID (if authenticated). No `console.log` in production code. Use a structured logger (Pino, Winston, or equivalent).

### 7. Error responses follow RFC 7807
All error responses use the Problem Details format (`application/problem+json`):
```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The 'email' field is not a valid email address.",
  "instance": "/users/signup"
}
```
Internal error details (stack traces, query text) are never exposed to clients.

### 8. All secrets from environment variables
No secrets in code, config files, or version control. Use environment variables loaded from `.env` files locally and from a secrets manager (Vault, AWS Secrets Manager, GitHub Secrets) in deployed environments. The `.env` file is always in `.gitignore`.

### 9. Background jobs for anything over 500ms
Any operation expected to take more than 500ms must be offloaded to a background job queue. The API endpoint enqueues the job and returns immediately with a `202 Accepted` and a job ID or polling URL.

### 10. Database queries must be parameterized
No string concatenation or template literals in SQL queries. All queries use parameterized statements or the ORM's built-in query builder. This is a hard security requirement — no exceptions.

### 11. Tests required at three levels
- **Unit tests** for all business logic (service layer). Target: 80%+ line coverage on service code.
- **Integration tests** for all API endpoints. Every endpoint has at least one happy-path and one error-path test.
- **E2E tests** for critical user flows (auth, payment, core domain operations).

### 12. Health check endpoint required
Every service exposes `GET /health` (or `GET /healthz`) that returns:
- `200 OK` when the service and its critical dependencies (database, cache) are healthy.
- `503 Service Unavailable` with a body indicating which dependency is down.
The health endpoint is unauthenticated and excluded from rate limiting.

### 13. Graceful shutdown handling
The process listens for `SIGTERM` and `SIGINT`. On receipt, it:
1. Stops accepting new connections.
2. Finishes in-flight requests (with a timeout, default 30s).
3. Closes database and cache connections.
4. Exits with code 0.

### 14. CORS configured explicitly
CORS is never set to `*` in staging or production. Allowed origins, methods, and headers are listed explicitly. Credentials mode is enabled only when required. CORS preflight responses are cached.

### 15. No business logic in controllers
Controllers (route handlers) are thin. They:
1. Parse and validate input.
2. Call the service layer.
3. Format and return the response.

All business rules, data transformations, and orchestration live in the service layer. This keeps controllers testable and swappable.

---

## Phase detection rules

The `backend-phase-workflow` skill uses these signals to determine the current project phase. It checks in order and assigns the earliest incomplete phase.

| Phase | Detection: phase is COMPLETE when... |
|-------|--------------------------------------|
| 1. Requirements | A requirements document exists (e.g., `docs/requirements.md`, `docs/PRD.md`, or equivalent) with at least functional requirements and success metrics. |
| 2. Architecture | An architecture document exists (e.g., `docs/architecture.md`) with tech stack decisions, system diagram reference, and module boundaries. |
| 3. Database | A schema file or migration directory exists (e.g., `prisma/schema.prisma`, `drizzle/`, `migrations/`, `alembic/`) with at least one model defined. |
| 4. API design | An OpenAPI spec exists (e.g., `openapi.yaml`, `openapi.json`, `docs/api-spec.yaml`) with at least one endpoint defined, OR a route directory exists with handler files. |
| 5. Auth and security | Auth middleware or guards are implemented. A role/permission model is defined. Environment-based secret loading is configured. |
| 6. Core services | A service layer directory exists (e.g., `src/services/`, `app/services/`) with at least one service implementing business logic beyond CRUD scaffolding. |
| 7. Integrations | Third-party integration clients or adapters exist, OR the architecture doc explicitly states "no external integrations needed." |
| 8. Queues and jobs | A job/queue configuration exists (e.g., BullMQ workers, Celery tasks, SQS consumers), OR the architecture doc explicitly states "no background jobs needed." |
| 9. Testing | Test files exist at unit and integration levels. A test runner is configured. Coverage meets the targets defined in rule 11. |
| 10. Observability | Structured logging is configured. A health check endpoint exists and responds correctly. Metrics or monitoring config is present. |
| 11. Deployment | A Dockerfile or container config exists. A CI/CD pipeline config exists (e.g., `.github/workflows/`). Environment-specific configs are defined. |
| 12. Hardening | A security audit checklist is completed. Load/stress test results exist. Dependency audit passes with no critical vulnerabilities. A production readiness checklist is signed off. |

When a phase cannot be detected automatically, the skill asks the developer to confirm their current phase. Phases may be revisited — the workflow is sequential but not strictly linear.
