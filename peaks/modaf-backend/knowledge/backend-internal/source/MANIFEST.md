# Backend Internal Knowledge Pack — Manifest

Complete inventory of every file in the `backend-internal` knowledge pack.

---

## Phase Files

Phases represent the 12-step backend build lifecycle. Each phase has prerequisites and quality gates that must be satisfied before advancing.

| File | Description |
|------|-------------|
| `phases/phase_00.md` | **Project bootstrap** — repository setup, toolchain selection, folder structure, and initial configuration |
| `phases/phase_01.md` | **Requirements & domain modeling** — gather requirements, define bounded contexts, and map domain entities |
| `phases/phase_02.md` | **Database design** — schema modeling, migration strategy, seed data, and relationship mapping |
| `phases/phase_03.md` | **Auth & identity** — authentication provider setup, session/token strategy, and user model wiring |
| `phases/phase_04.md` | **Core API scaffolding** — route structure, controller patterns, request/response DTOs, and validation |
| `phases/phase_05.md` | **Service layer build-out** — business logic encapsulation, dependency injection, and cross-cutting concerns |
| `phases/phase_06.md` | **Data access & query layer** — repository pattern, query optimization, transactions, and connection pooling |
| `phases/phase_07.md` | **Background jobs & async processing** — queue setup, worker patterns, retry policies, and dead-letter handling |
| `phases/phase_08.md` | **External integrations** — third-party APIs, webhooks, file storage, and email/notification services |
| `phases/phase_09.md` | **Testing & quality gates** — unit tests, integration tests, E2E tests, coverage targets, and CI test pipeline |
| `phases/phase_10.md` | **Security hardening** — input sanitization, rate limiting, CORS, CSP headers, dependency auditing, and secrets management |
| `phases/phase_11.md` | **Deployment & production readiness** — Docker builds, CI/CD pipelines, environment config, health checks, and observability |

---

## Internal Reference Documents

Reference docs provide deep-dive guidance on specific backend topics. Each doc lists the phases where it is most relevant.

| # | File | Description | Used by phases |
|---|------|-------------|----------------|
| 01 | `internal/api_design.md` | REST/GraphQL endpoint conventions, resource naming, pagination, filtering, and content negotiation | 04, 05, 08 |
| 02 | `internal/api_versioning.md` | API versioning strategies (URL, header, media-type), deprecation policy, and consumer migration guides | 04, 08, 11 |
| 03 | `internal/auth_authorization.md` | Authentication flows (JWT, OAuth2, session), RBAC/ABAC patterns, permission models, and token lifecycle | 03, 05, 10 |
| 04 | `internal/caching_strategy.md` | Cache layers (in-memory, Redis, CDN), invalidation patterns, cache-aside vs write-through, and TTL policies | 06, 07, 11 |
| 05 | `internal/database_patterns.md` | Schema conventions, indexing strategy, normalization guidance, soft deletes, and multi-tenancy patterns | 02, 06, 09 |
| 06 | `internal/deployment.md` | Docker multi-stage builds, CI/CD pipeline design, blue-green/canary deployment, and infrastructure-as-code | 00, 11 |
| 07 | `internal/error_handling.md` | Exception hierarchy, error response format, retry semantics, circuit breakers, and graceful degradation | 04, 05, 07, 08 |
| 08 | `internal/file_storage.md` | Object storage integration (S3-compatible), upload handling, signed URLs, and media processing pipelines | 08 |
| 09 | `internal/logging_monitoring.md` | Structured logging format, log levels, correlation IDs, distributed tracing, and alerting thresholds | 05, 07, 09, 11 |
| 10 | `internal/migrations.md` | Migration authoring rules, zero-downtime migration patterns, rollback strategies, and data backfills | 02, 06, 11 |
| 11 | `internal/monitoring.md` | Metrics collection (Prometheus/StatsD), dashboard design, SLI/SLO definitions, and incident runbooks | 09, 11 |
| 12 | `internal/performance_optimization.md` | Profiling methodology, N+1 detection, query analysis, payload optimization, and load testing guidance | 06, 09, 11 |
| 13 | `internal/queues.md` | Message broker setup (Redis/RabbitMQ/SQS), consumer patterns, idempotency, ordering guarantees, and DLQ management | 07, 08 |
| 14 | `internal/rate_limiting.md` | Rate limit algorithms (token bucket, sliding window), per-route configuration, abuse detection, and client throttling | 04, 10 |
| 15 | `internal/security_hardening.md` | OWASP top-10 mitigations, input validation, SQL injection prevention, XSS defense, CSRF tokens, and dependency auditing | 03, 10 |
| 16 | `internal/service_architecture.md` | Module boundaries, dependency injection, service-to-service contracts, hexagonal architecture, and shared kernel patterns | 01, 05, 06 |
| 17 | `internal/testing_strategy.md` | Test pyramid, mocking guidelines, fixture management, snapshot tests, and coverage enforcement | 09, 05, 06 |
| 18 | `internal/webhooks.md` | Webhook dispatch design, payload signing, retry/backoff, delivery logging, and consumer verification | 08 |
| 19 | `internal/environment_config.md` | Environment variable management, secrets injection, feature flags, and config validation at startup | 00, 03, 11 |
| 20 | `internal/data_serialization.md` | Request/response serialization, JSON schema validation, DTO mapping, and API contract testing | 04, 05, 09 |
