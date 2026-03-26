# modaf-backend

A backend engineering peak for [Melted Peak](../../README.md). It provides a structured, phase-driven workflow for building production-grade server-side systems — from initial requirements all the way through security hardening and deployment.

## What this peak covers

- **API design** — RESTful and RPC endpoint design, OpenAPI specifications, versioning strategies
- **Database modeling** — Schema design, relationships, indexing, migrations
- **Authentication and authorization** — JWT, OAuth2, RBAC, ABAC, session management
- **Service architecture** — Layered architecture, dependency injection, domain modeling
- **Caching** — In-memory caching, Redis, cache invalidation strategies
- **Queues and background jobs** — Task queues, scheduled jobs, retry policies, dead-letter handling
- **File storage** — Local and cloud storage (S3-compatible), signed URLs, streaming uploads
- **Webhooks and events** — Event-driven patterns, webhook delivery, idempotency
- **Rate limiting** — Per-endpoint, per-user, sliding window, token bucket
- **Logging and monitoring** — Structured logging (JSON), metrics, distributed tracing, alerting
- **Testing** — Unit tests for business logic, integration tests for API endpoints, E2E for critical flows
- **Security hardening** — Input validation, SQL injection prevention, CORS, CSP headers, dependency auditing
- **Deployment** — Docker containers, CI/CD pipelines, blue-green and rolling deployments
- **Migrations** — Forward-only database migrations, data backfills, zero-downtime schema changes
- **Performance optimization** — Query optimization, connection pooling, payload compression, N+1 detection
- **API versioning** — URL-based, header-based, and content-negotiation versioning strategies

## The 12 build phases

Every backend project moves through these phases in order. The `backend-phase-workflow` skill detects where you are and guides you through each step.

| # | Phase | Key outputs |
|---|-------|-------------|
| 1 | **Requirements** | Functional requirements doc, domain glossary, success metrics |
| 2 | **Architecture** | System diagram, tech stack decisions, module boundaries |
| 3 | **Database** | Schema design, ER diagrams, migration plan, seed data |
| 4 | **API design** | OpenAPI spec, endpoint inventory, request/response contracts |
| 5 | **Auth and security** | Auth strategy doc, role/permission matrix, security checklist |
| 6 | **Core services** | Service layer implementation, business logic, validation rules |
| 7 | **Integrations** | Third-party API clients, webhooks, external service adapters |
| 8 | **Queues and jobs** | Background job definitions, scheduling, retry/failure policies |
| 9 | **Testing** | Test plan, test infrastructure, coverage targets met |
| 10 | **Observability** | Logging config, health checks, metrics dashboards, alerting rules |
| 11 | **Deployment** | Dockerfiles, CI/CD pipelines, environment configs, runbooks |
| 12 | **Hardening** | Security audit, load testing, dependency audit, production checklist |

## Peak contents

### Skills (2)

| Skill | Purpose |
|-------|---------|
| `backend-phase-workflow` | Orchestrates the 12-phase build lifecycle with phase detection, prerequisites, and quality gates |
| `backend-doctor` | Diagnoses project health — scans config, dependencies, security posture, test coverage, and infra readiness |

### Knowledge pack (1)

| Pack | Docs |
|------|------|
| `backend-internal` | 20 internal reference documents covering every aspect of backend engineering listed above |

### Templates (6)

| Template | Purpose |
|----------|---------|
| `api-design` | OpenAPI specification and endpoint design |
| `database-schema` | Database schema, migrations, and data modeling |
| `service-architecture` | Service layer, dependency injection, and module structure |
| `auth-security` | Authentication, authorization, and security configuration |
| `deployment` | Docker, CI/CD, and infrastructure-as-code |
| `testing-strategy` | Unit, integration, and E2E testing plan |

### Context profiles (4)

| Profile | When to use |
|---------|-------------|
| `solo-backend` | Single developer, reduced ceremony |
| `team-backend` | Teams of 2-8, adds review gates and shared ownership |
| `microservices` | Multi-service architectures with distributed concerns |
| `api-only` | Headless API projects, no frontend, focus on consumer contracts |

## Default tech stack

The peak is **technology-agnostic** but ships with sensible defaults:

| Layer | Default | Escape hatches |
|-------|---------|----------------|
| Runtime | Node.js + TypeScript | Python, Go, Rust |
| Database | PostgreSQL (via Prisma or Drizzle) | MySQL, MongoDB, SQLite |
| Cache / Pub-Sub | Redis | Memcached, in-memory |
| ORM / Query builder | Prisma or Drizzle | TypeORM, Knex, Sequelize, raw SQL |
| Queue system | BullMQ (Redis-backed) | RabbitMQ, SQS, Celery, Temporal |
| Containerization | Docker | Podman, Nix |
| CI/CD | GitHub Actions | GitLab CI, CircleCI, Jenkins |

When you select an escape hatch, the peak adjusts its guidance, templates, and doctor checks accordingly.

## Quick start

1. Ensure the `modaf-backend` peak is registered in your Melted Peak configuration.
2. The `conventions.md` file is loaded automatically on boot via `boot_files`.
3. Invoke the `backend-phase-workflow` skill to detect your current phase and get started.
4. Use `backend-doctor` at any time to audit project health.
