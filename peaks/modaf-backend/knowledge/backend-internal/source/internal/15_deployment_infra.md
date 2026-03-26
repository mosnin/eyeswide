# Deployment & Infrastructure

> **TL;DR:** Containerize with multi-stage Docker builds, automate CI/CD via GitHub Actions, validate environment variables on startup, and scale horizontally behind a load balancer.

---

**Metadata**

| Field         | Value                          |
|---------------|--------------------------------|
| ID            | `backend-internal-015`         |
| Category      | DevOps / Infrastructure        |
| Audience      | Backend engineers, DevOps      |
| Last reviewed | 2026-03-26                     |
| Status        | Active                         |

---

## 1. Deployment Targets

| Target            | When to Use                                   | Complexity |
|-------------------|-----------------------------------------------|------------|
| Docker containers | Default for all projects                      | Medium     |
| Serverless        | Event-driven, low-traffic, or cost-sensitive  | Low        |
| Bare metal / VMs  | Legacy, regulatory, or extreme performance    | High       |

Docker containers are the default. Every backend project must have a working Dockerfile and docker-compose.yml before the first deploy.

---

## 2. Docker

### 2.1 Multi-Stage Dockerfile

Use a multi-stage build to keep production images small and free of dev dependencies.

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-slim AS production

# Security: run as non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy dependency manifests and install production only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output and Prisma artifacts
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/

# Switch to non-root user
USER appuser

# Expose port (configurable via env)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start
CMD ["node", "dist/main.js"]
```

### 2.2 Base Image Selection

| Image             | Size    | Use Case                          |
|-------------------|---------|-----------------------------------|
| `node:20-slim`    | ~200MB  | Default -- good balance           |
| `node:20-alpine`  | ~140MB  | Smaller image, musl libc caveats  |
| `node:20`         | ~900MB  | Only if native build tools needed |

Prefer `node:20-slim`. Use Alpine only if you have verified that all native dependencies compile against musl.

### 2.3 Security Practices

- **Non-root user:** Always run as `node` or a custom non-root user. Never run containers as root in production.
- **Read-only filesystem:** Mount the container filesystem as read-only where possible. Use tmpfs for `/tmp` if the app writes temp files.
- **No secrets in images:** Never bake environment variables, API keys, or credentials into the Docker image. Pass them at runtime.

### 2.4 .dockerignore

```
node_modules
.git
.github
tests
__tests__
*.test.ts
*.spec.ts
.env*
.env.local
*.md
docs
coverage
.nyc_output
.vscode
.idea
```

### 2.5 docker-compose.yml for Local Development

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/app_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./src:/app/src  # Hot reload in dev
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025'   # SMTP
      - '8025:8025'   # Web UI
    profiles:
      - email

  minio:
    image: minio/minio
    ports:
      - '9000:9000'
      - '9001:9001'   # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    profiles:
      - storage

volumes:
  pgdata:
```

Start core services: `docker compose up -d`
Start with email testing: `docker compose --profile email up -d`
Start with S3-compatible storage: `docker compose --profile storage up -d`

---

## 3. CI/CD (GitHub Actions)

### 3.1 PR Workflow

Runs on every pull request to validate code quality before merge.

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

concurrency:
  group: pr-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: app_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/app_test

      - name: Test
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/app_test
          NODE_ENV: test

      - name: Build
        run: npm run build
```

### 3.2 Deploy Workflow

Triggered on merge to `main`. Builds, pushes, and deploys the Docker image.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install and test
        run: |
          npm ci
          npm test
        env:
          NODE_ENV: test

      - name: Build Docker image
        run: |
          docker build \
            --tag ${{ secrets.DOCKER_REGISTRY }}/app:${{ github.sha }} \
            --tag ${{ secrets.DOCKER_REGISTRY }}/app:latest \
            .

      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login ${{ secrets.DOCKER_REGISTRY }} -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push ${{ secrets.DOCKER_REGISTRY }}/app:${{ github.sha }}
          docker push ${{ secrets.DOCKER_REGISTRY }}/app:latest

      - name: Deploy
        run: |
          # Replace with your deployment mechanism:
          # - kubectl set image deployment/app app=$REGISTRY/app:$SHA
          # - railway deploy
          # - aws ecs update-service
          echo "Deploying ${{ github.sha }}"

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deploy failed for ${{ github.sha }} by ${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 3.3 Caching Strategy

- **npm cache:** `actions/setup-node` with `cache: 'npm'` caches `~/.npm`.
- **Docker layer cache:** Use `docker/build-push-action` with `cache-from` and `cache-to` for faster builds.
- **Prisma engine cache:** Cache `node_modules/.prisma` to avoid re-downloading the query engine.

---

## 4. Environment Management

### 4.1 File Convention

| File             | Purpose                    | Committed? |
|------------------|----------------------------|------------|
| `.env.example`   | Template with dummy values | Yes        |
| `.env.local`     | Local dev overrides        | No         |
| `.env.test`      | Test environment values    | Sometimes  |
| `.env`           | Never used in production   | No         |

### 4.2 Startup Validation

Validate all required environment variables on application startup. Fail fast with a clear error message listing every missing variable.

```typescript
const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'PORT',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

// Call at the very top of your entry point
validateEnv();
```

### 4.3 Production Environment Variables

In production, environment variables come from the platform (not files):

- **Railway / Render / Fly.io:** Dashboard or CLI (`railway variables set KEY=value`)
- **AWS ECS:** Task definition environment or Secrets Manager
- **Kubernetes:** ConfigMaps and Secrets
- **Vercel:** Project settings environment variables

---

## 5. Database in CI

Every CI run must test against a real PostgreSQL instance (not SQLite mocks).

1. Start PostgreSQL as a service container.
2. Run migrations (`prisma migrate deploy`).
3. Optionally seed test data (`prisma db seed`).
4. Run the test suite.
5. Service container is automatically torn down after the job.

This ensures migration compatibility and catches SQL dialect differences.

---

## 6. Deployment Strategies

### 6.1 Rolling Deploy (Default)

Replace instances one at a time. At least one instance is always serving traffic.

- **Pros:** Simple, minimal resource overhead, zero downtime for stateless apps.
- **Cons:** Both old and new versions run simultaneously during the rollout. Ensure backward-compatible API changes.

### 6.2 Blue-Green Deploy

Maintain two identical environments. Deploy new version to the inactive environment, verify health, then switch the load balancer.

- **Pros:** Instant rollback (switch back), no mixed versions.
- **Cons:** Double the infrastructure cost during deploy.

### 6.3 Canary Deploy

Route a small percentage (5-10%) of traffic to the new version. Monitor error rates and latency. Gradually increase if healthy.

- **Pros:** Limits blast radius of bad deploys.
- **Cons:** Requires traffic-splitting infrastructure (Istio, AWS ALB weighted routing).

---

## 7. Scaling

### 7.1 Horizontal Scaling

Add more instances behind a load balancer. This is the primary scaling strategy.

Requirements for horizontal scaling:
- **Stateless application:** No in-memory sessions (use Redis).
- **Shared storage:** File uploads go to S3/MinIO, not local disk.
- **Database connection pooling:** Use PgBouncer or Prisma's built-in pooling to avoid exhausting connections.

### 7.2 Vertical Scaling

Increase CPU/memory of a single instance. Use only as a short-term measure while implementing horizontal scaling.

### 7.3 Auto-Scaling Rules

| Metric      | Scale Up Threshold | Scale Down Threshold | Cooldown |
|-------------|--------------------|-----------------------|----------|
| CPU usage   | >70% for 3 min     | <30% for 10 min      | 5 min    |
| Memory      | >80% for 3 min     | <40% for 10 min      | 5 min    |
| Request rate| >1000 rps          | <200 rps              | 5 min    |

Minimum instances: 2 (for availability). Maximum instances: defined per project.

### 7.4 Database Scaling

- **Connection pooling:** PgBouncer in transaction mode. Set pool size to `(num_instances * connections_per_instance)` but never exceed `max_connections - 10`.
- **Read replicas:** Route read-heavy queries (analytics, reports, search) to replicas. Use Prisma's `$replica()` or a connection string override.
- **Partitioning:** For tables exceeding 100M rows, partition by date or tenant ID.
- **Caching:** Cache frequent reads in Redis. Invalidate on write.

---

## 8. Health Checks and Readiness

Every application must expose two endpoints:

```typescript
// Liveness: is the process alive?
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: can the process serve traffic?
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;       // Database check
    await redis.ping();                       // Cache check
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

Configure the load balancer to use `/ready` for routing decisions and `/health` for restart decisions.

---

## 9. Logging and Observability in Production

- **Structured JSON logs:** Use `pino` or `winston` with JSON output. Never use `console.log` in production.
- **Log levels:** `error` for failures, `warn` for degraded state, `info` for business events, `debug` off in production.
- **Request ID:** Generate a unique ID per request (use `crypto.randomUUID()`). Include it in every log line and return it in the response header `X-Request-Id`.
- **Metrics:** Export Prometheus metrics (request count, latency histogram, error rate) via `/metrics`.
- **Tracing:** Instrument with OpenTelemetry for distributed tracing across services.

---

## Summary

Containerize everything with multi-stage Docker builds. Automate the entire path from PR to production with GitHub Actions. Validate environment variables at startup so misconfigurations fail immediately, not at 3 AM. Scale horizontally, cache aggressively, and monitor everything.
