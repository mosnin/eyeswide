# backend-doctor

A diagnostic and repair system for backend projects. Scans the codebase against conventions.md rules, checks infrastructure readiness, and produces an actionable health report with severity-ranked findings and remediation steps.

---

## Invocation

When the user triggers this skill, run every diagnostic category below in order. Collect results into a unified health report at the end.

---

## Diagnostic Categories

### 1. Project Structure

Check that all required files and directories exist per conventions.md.

| Check | Severity | What to look for |
|---|---|---|
| Schema file exists | critical | `schema.prisma`, `schema.sql`, or equivalent ORM schema present |
| Migrations directory exists | critical | `migrations/`, `db/migrate/`, or framework-equivalent directory |
| Environment config exists | critical | `.env.example` or `env.ts` config module — never `.env` committed |
| Health check endpoint | critical | A `/health` or `/healthz` route is defined and reachable |
| Test directory exists | critical | `tests/`, `__tests__/`, or `spec/` directory present with files |
| Docker / container config | warning | `Dockerfile` or `docker-compose.yml` present |
| CI/CD pipeline config | warning | `.github/workflows/`, `Jenkinsfile`, or equivalent present |
| README with setup steps | info | `README.md` contains install, run, and test instructions |

**Remediation:** List every missing file. For critical items, generate a stub or template the developer can fill in.

---

### 2. Database Health

Validate schema integrity, migration state, and query efficiency.

| Check | Severity | What to look for |
|---|---|---|
| Migrations in sync | critical | No pending migrations; schema matches the latest migration output |
| Indexes on foreign keys | critical | Every foreign key column has an index defined |
| No N+1 patterns | warning | Common query paths (list endpoints, nested includes) do not exhibit N+1 fetches |
| Connection config uses pooling | warning | Database connection uses a connection pool with explicit min/max settings |
| Seed data available | info | A seed script or factory exists for local development |
| Soft-delete consistency | info | If soft-delete is used, all queries filter on `deleted_at` |

**Remediation:** For missing indexes, generate the exact `CREATE INDEX` or migration statement. For N+1 patterns, identify the file and line and suggest eager-loading or batching.

---

### 3. API Compliance

Verify that every API endpoint meets baseline quality standards.

| Check | Severity | What to look for |
|---|---|---|
| Input validation on every endpoint | critical | Request bodies and query params are validated via a schema (Zod, Joi, class-validator, or equivalent) |
| Auth middleware on protected routes | critical | Non-public endpoints have authentication middleware applied |
| Rate limiting configured | warning | A rate limiter is applied globally or per-route |
| Consistent error response format | warning | All error responses follow a uniform shape (`{ error, message, statusCode }` or similar) |
| Pagination on list endpoints | warning | List endpoints accept `limit`/`offset` or cursor-based pagination params |
| Request ID propagation | info | Each request receives a unique ID that flows through logs and responses |

**Remediation:** For endpoints missing validation, list the route and suggest adding the validation middleware. For auth gaps, identify unprotected routes that should be guarded.

---

### 4. Security Posture

Detect common security misconfigurations and vulnerabilities.

| Check | Severity | What to look for |
|---|---|---|
| No hardcoded secrets | critical | No API keys, passwords, tokens, or connection strings in source files |
| CORS configured | critical | CORS origin whitelist is explicit — not a wildcard `*` in production config |
| Auth on protected routes | critical | Already covered in API Compliance but re-verified here as a security gate |
| Helmet / security headers | warning | Security headers middleware is applied (e.g., `helmet`, `secure-headers`) |
| Input sanitization | warning | User input is sanitized or parameterized to prevent SQL injection and XSS |
| Dependency vulnerabilities | warning | `npm audit`, `pip audit`, or equivalent reports no high/critical findings |
| Secrets in env only | info | All secrets are loaded from environment variables or a vault, never from files in repo |

**Remediation:** For hardcoded secrets, identify the file and line. For CORS, show the current config and the recommended change. For dependency vulnerabilities, list the affected packages and upgrade commands.

---

### 5. Test Coverage

Assess the breadth and quality of the test suite.

| Check | Severity | What to look for |
|---|---|---|
| Unit tests for services | critical | Each service module has a corresponding `*.test.*` or `*.spec.*` file |
| Integration tests for API endpoints | critical | Each major endpoint has at least one integration test exercising the full request-response cycle |
| Test factories / fixtures exist | warning | A factory or fixture system exists for generating test data |
| E2E tests present | warning | At least one end-to-end test exercises a critical user flow |
| Tests can run in isolation | warning | Tests do not depend on shared mutable state or external services without mocks |
| Coverage threshold configured | info | A coverage threshold (e.g., 80%) is set in the test runner config |

**Remediation:** For missing test files, list the untested modules and generate a skeleton test file. For coverage gaps, report the current percentage and the target.

---

### 6. Observability

Confirm the project has adequate logging, monitoring, and error tracking.

| Check | Severity | What to look for |
|---|---|---|
| Structured logging present | critical | Logs use structured format (JSON) with consistent fields: `level`, `message`, `timestamp`, `requestId` |
| Health check endpoint | critical | `/health` or `/healthz` returns 200 with service status and dependency checks |
| Error tracking configured | warning | An error tracking service (Sentry, Datadog, Bugsnag, etc.) is initialized |
| Request logging middleware | warning | Every inbound request is logged with method, path, status code, and duration |
| No `console.log` in production code | warning | Raw `console.log` calls are replaced with the structured logger |
| Metrics / APM configured | info | Application performance monitoring is set up for latency, throughput, and error rate |

**Remediation:** For missing structured logging, suggest a logger setup snippet. For console.log usage, list the files and lines to fix.

---

### 7. Deployment Readiness

Evaluate whether the project is ready to ship to staging or production.

| Check | Severity | What to look for |
|---|---|---|
| Dockerfile present and valid | critical | A `Dockerfile` exists, uses a non-root user, and has a multi-stage build or slim base |
| CI/CD pipeline defined | critical | A pipeline config exists that runs lint, test, build, and deploy steps |
| Environment config documented | critical | `.env.example` lists all required environment variables with descriptions |
| Migrations run in CI | warning | The pipeline includes a migration step or migration check |
| Graceful shutdown handling | warning | The server handles `SIGTERM`/`SIGINT` and drains connections before exiting |
| Production logging level | info | Log level defaults to `info` or `warn` in production, not `debug` |
| Health check used by orchestrator | info | The container orchestrator (Docker, K8s) uses the health check for readiness/liveness probes |

**Remediation:** For missing Dockerfile, generate a best-practice template for the detected runtime. For CI/CD gaps, suggest a pipeline config matching the project's tooling.

---

## Health Report Format

After running all checks, produce a report in the following structure:

```
# Backend Doctor Report

Generated: {timestamp}
Project: {project name}
Overall Health: {HEALTHY | NEEDS ATTENTION | CRITICAL}

## Summary
- Critical: {count}
- Warning: {count}
- Info: {count}
- Passed: {count}

## Findings

### CRITICAL

#### [{Category}] {Check name}
- Status: FAIL
- Severity: critical
- Details: {what was found}
- Remediation: {specific steps to fix}
- Files: {affected file paths}

### WARNING

#### [{Category}] {Check name}
- Status: FAIL
- Severity: warning
- Details: {what was found}
- Remediation: {specific steps to fix}
- Files: {affected file paths}

### INFO

#### [{Category}] {Check name}
- Status: FAIL
- Severity: info
- Details: {what was found}
- Remediation: {specific steps to fix}

### PASSED

- [x] {Check name} ({Category})
- [x] ...
```

## Scoring

- **HEALTHY** — zero critical findings, two or fewer warnings.
- **NEEDS ATTENTION** — zero critical findings, three or more warnings.
- **CRITICAL** — one or more critical findings.

## Behavior Notes

- Run checks non-destructively. Never modify project files during diagnosis.
- When a check cannot be evaluated (e.g., no database config found), mark it as **SKIPPED** with a note explaining why.
- Offer to fix findings after presenting the report, but only with explicit user approval.
- Reference conventions.md rules by name when a finding violates a specific convention.
- Use the **backend-internal** knowledge pack for framework-specific guidance when generating remediation steps.
