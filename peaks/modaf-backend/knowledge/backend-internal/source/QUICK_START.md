# Backend Internal Knowledge Pack — Quick Start

Use this guide to load the right files fast. Skim the flowcharts, find your scenario, and load only what you need.

---

## Phase Detection Flowchart

Determine which phase you are in by answering these questions in order:

```
START
  |
  v
Has the repo been initialized with a framework + folder structure?
  |-- NO  --> Phase 00 (Project bootstrap)
  |-- YES
      |
      v
  Are domain entities, bounded contexts, and requirements documented?
      |-- NO  --> Phase 01 (Requirements & domain modeling)
      |-- YES
          |
          v
      Does a database schema with migrations exist?
          |-- NO  --> Phase 02 (Database design)
          |-- YES
              |
              v
          Is authentication wired up with user model and tokens/sessions?
              |-- NO  --> Phase 03 (Auth & identity)
              |-- YES
                  |
                  v
              Do API routes exist with validation and DTOs?
                  |-- NO  --> Phase 04 (Core API scaffolding)
                  |-- YES
                      |
                      v
                  Are business logic services implemented with DI?
                      |-- NO  --> Phase 05 (Service layer build-out)
                      |-- YES
                          |
                          v
                      Are repositories, queries, and transactions optimized?
                          |-- NO  --> Phase 06 (Data access & query layer)
                          |-- YES
                              |
                              v
                          Are background jobs and queues configured?
                              |-- NO  --> Phase 07 (Background jobs & async)
                              |-- YES
                                  |
                                  v
                              Are external APIs, webhooks, and storage integrated?
                                  |-- NO  --> Phase 08 (External integrations)
                                  |-- YES
                                      |
                                      v
                                  Does test coverage meet quality gates?
                                      |-- NO  --> Phase 09 (Testing & quality gates)
                                      |-- YES
                                          |
                                          v
                                      Has security hardening been applied?
                                          |-- NO  --> Phase 10 (Security hardening)
                                          |-- YES
                                              |
                                              v
                                          Is the app deployed with CI/CD and monitoring?
                                              |-- NO  --> Phase 11 (Deployment & production readiness)
                                              |-- YES --> COMPLETE
```

---

## Task-to-File Decision Trees

### "I need to build an API endpoint"
1. Load `phases/phase_04.md` for scaffolding conventions
2. Load `internal/api_design.md` for endpoint patterns
3. Load `internal/data_serialization.md` for request/response format
4. If auth-protected: also load `internal/auth_authorization.md`
5. If rate-limited: also load `internal/rate_limiting.md`

### "I need to add a database table or change the schema"
1. Load `phases/phase_02.md` for schema modeling rules
2. Load `internal/database_patterns.md` for conventions
3. Load `internal/migrations.md` for migration authoring

### "I need to set up or modify authentication"
1. Load `phases/phase_03.md` for auth phase guidance
2. Load `internal/auth_authorization.md` for flow patterns
3. Load `internal/security_hardening.md` for security posture
4. Load `internal/environment_config.md` for secrets handling

### "I need to add a background job"
1. Load `phases/phase_07.md` for async processing guidance
2. Load `internal/queues.md` for broker patterns
3. Load `internal/error_handling.md` for retry/DLQ strategy
4. Load `internal/logging_monitoring.md` for job observability

### "I need to integrate a third-party service"
1. Load `phases/phase_08.md` for integration patterns
2. Load `internal/webhooks.md` if receiving/sending webhooks
3. Load `internal/file_storage.md` if handling uploads
4. Load `internal/error_handling.md` for circuit breaker patterns

### "I need to write or fix tests"
1. Load `phases/phase_09.md` for coverage targets and gates
2. Load `internal/testing_strategy.md` for test patterns
3. Load `internal/data_serialization.md` for contract testing

### "I need to debug a production issue"
1. Load `internal/error_handling.md` for error taxonomy
2. Load `internal/logging_monitoring.md` for log analysis
3. Load `internal/monitoring.md` for metrics and SLOs
4. Load `internal/performance_optimization.md` if perf-related

### "I need to deploy or set up CI/CD"
1. Load `phases/phase_11.md` for deployment phase guidance
2. Load `internal/deployment.md` for CI/CD and Docker patterns
3. Load `internal/environment_config.md` for config management
4. Load `internal/monitoring.md` for health checks and alerting

---

## Files by Category

### Architecture
- `internal/service_architecture.md` — module boundaries, DI, hexagonal patterns
- `internal/api_design.md` — endpoint conventions and resource modeling
- `internal/api_versioning.md` — versioning and deprecation strategy
- `internal/data_serialization.md` — DTOs, serialization, contract testing

### Database
- `internal/database_patterns.md` — schema conventions, indexing, multi-tenancy
- `internal/migrations.md` — migration rules, zero-downtime patterns, rollbacks
- `internal/caching_strategy.md` — cache layers, invalidation, TTL policies

### API
- `internal/api_design.md` — REST/GraphQL conventions, pagination, filtering
- `internal/api_versioning.md` — version strategies, consumer migration
- `internal/rate_limiting.md` — throttling algorithms, per-route config
- `internal/webhooks.md` — dispatch, signing, retry, verification

### Security
- `internal/auth_authorization.md` — JWT, OAuth2, RBAC/ABAC, permissions
- `internal/security_hardening.md` — OWASP mitigations, input validation, auditing
- `internal/environment_config.md` — secrets management, feature flags

### Testing
- `internal/testing_strategy.md` — test pyramid, mocking, coverage enforcement
- `internal/data_serialization.md` — API contract testing
- `internal/performance_optimization.md` — load testing guidance

### Deployment & Observability
- `internal/deployment.md` — Docker, CI/CD, blue-green/canary
- `internal/logging_monitoring.md` — structured logging, tracing, correlation IDs
- `internal/monitoring.md` — metrics, dashboards, SLI/SLOs, runbooks
- `internal/environment_config.md` — environment variables, config validation

### Async & Integration
- `internal/queues.md` — message brokers, consumers, idempotency, DLQ
- `internal/file_storage.md` — object storage, uploads, signed URLs
- `internal/webhooks.md` — webhook dispatch and consumption
- `internal/error_handling.md` — circuit breakers, retries, graceful degradation

---

## Phase Dependency Chain

Phases are designed to be sequential. Each phase assumes prior phases are complete.

```
Phase 00  Project bootstrap
  |
Phase 01  Requirements & domain modeling
  |
Phase 02  Database design
  |
Phase 03  Auth & identity
  |
Phase 04  Core API scaffolding
  |
Phase 05  Service layer build-out
  |
Phase 06  Data access & query layer
  |
Phase 07  Background jobs & async processing
  |
Phase 08  External integrations
  |
Phase 09  Testing & quality gates
  |
Phase 10  Security hardening
  |
Phase 11  Deployment & production readiness
```

**Hard dependencies** (skipping is never safe):
- Phase 02 requires Phase 01 (schema needs domain model)
- Phase 04 requires Phase 02 (API routes need data models)
- Phase 05 requires Phase 04 (services need API layer to expose)
- Phase 11 requires Phase 09 (cannot deploy without quality gates)

**Soft dependencies** (can be reordered in experienced hands):
- Phase 03 can run in parallel with Phase 02 if using an external auth provider
- Phase 07 and Phase 08 can be swapped depending on project needs
- Phase 10 practices should be applied continuously, not only at Phase 10

---

## Common Scenarios

| Scenario | Files to load |
|----------|---------------|
| Greenfield project kickoff | `phase_00.md`, `phase_01.md`, `service_architecture.md`, `environment_config.md` |
| Adding a new CRUD resource | `phase_04.md`, `api_design.md`, `database_patterns.md`, `data_serialization.md` |
| Implementing OAuth2 login | `phase_03.md`, `auth_authorization.md`, `security_hardening.md` |
| Setting up Redis caching | `caching_strategy.md`, `performance_optimization.md` |
| Adding Stripe webhook handler | `phase_08.md`, `webhooks.md`, `error_handling.md`, `queues.md` |
| Writing integration tests | `phase_09.md`, `testing_strategy.md`, `database_patterns.md` |
| Preparing for first deploy | `phase_11.md`, `deployment.md`, `monitoring.md`, `environment_config.md` |
| Debugging slow queries | `performance_optimization.md`, `database_patterns.md`, `logging_monitoring.md` |
| Hardening before launch | `phase_10.md`, `security_hardening.md`, `rate_limiting.md`, `auth_authorization.md` |
| Adding a background email job | `phase_07.md`, `queues.md`, `error_handling.md`, `logging_monitoring.md` |
