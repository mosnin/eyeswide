# Logging & Monitoring

> **TL;DR:** Structured JSON logging via pino with request correlation IDs, sensitive data redaction, RED/USE metrics exposed in Prometheus format, and alerting thresholds for error rate, latency, and resource saturation.

---

**Knowledge Pack:** modaf-backend
**Category:** Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active

---

## 1. Structured Logging

### 1.1 Format

All logs are emitted as **JSON**, one entry per line (NDJSON). This ensures machine parseability by log aggregation systems while remaining human-readable with tools like `pino-pretty`.

Never use `console.log` in production code. Always use the structured logger.

### 1.2 Standard Fields

Every log entry must include these fields:

| Field | Type | Description | Example |
|---|---|---|---|
| `timestamp` | string (ISO 8601) | When the event occurred | `"2026-03-26T14:30:00.000Z"` |
| `level` | string | Severity level | `"info"` |
| `msg` | string | Human-readable description | `"User created successfully"` |
| `service` | string | Service or module name | `"user-service"` |
| `requestId` | string (UUID v4) | Correlation ID for the request | `"a1b2c3d4-..."` |
| `userId` | string | Authenticated user ID (if available) | `"usr_abc123"` |
| `duration` | number | Operation duration in milliseconds | `142` |
| `metadata` | object | Additional context (varies per event) | `{ "email": "..." }` |

### 1.3 Library: pino

**pino** is the default logging library for all Node.js services in modaf-backend.

Why pino:
- **Fast:** 5x faster than winston, minimal overhead in hot paths.
- **JSON-native:** Outputs structured JSON without transformation.
- **Redaction:** Built-in support for redacting sensitive fields at the serializer level.
- **Child loggers:** Create scoped loggers with pre-bound context (requestId, userId) for request lifecycle.
- **Transport separation:** Log processing (formatting, shipping) happens in a separate worker thread, never blocking the event loop.

### 1.4 Log Levels

Log levels are ordered by severity. The runtime log level filters out everything below it.

| Level | Numeric | When to Use |
|---|---|---|
| `fatal` | 60 | System is unusable. Process is about to crash. Requires immediate human intervention. |
| `error` | 50 | An operation failed. Data loss or user-visible failure. Requires investigation. |
| `warn` | 40 | Degraded operation. Something unexpected happened but the system recovered. A threshold was approached. |
| `info` | 30 | Key business events. Request lifecycle. State changes. Deployments. This is the default production level. |
| `debug` | 20 | Development-time detail. Query parameters, intermediate calculations, branching decisions. |
| `trace` | 10 | Extremely verbose. Function entry/exit, full payloads. Never enable in production. |

**Production default:** `info`
**Staging default:** `debug`
**Development default:** `debug`

---

## 2. Request Logging Middleware

### 2.1 Request Start

Log when a request enters the pipeline:

```json
{
  "level": "info",
  "msg": "request started",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/api/users",
  "userAgent": "Mozilla/5.0 ...",
  "ip": "192.168.1.100",
  "timestamp": "2026-03-26T14:30:00.000Z"
}
```

### 2.2 Response End

Log when the response is sent:

```json
{
  "level": "info",
  "msg": "request completed",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "POST",
  "path": "/api/users",
  "statusCode": 201,
  "duration": 142,
  "contentLength": 256,
  "timestamp": "2026-03-26T14:30:00.142Z"
}
```

Log level for responses varies by status code:
- `2xx` / `3xx` -- `info`
- `4xx` -- `warn`
- `5xx` -- `error`

### 2.3 Correlation: Request ID

Every inbound request receives a unique correlation ID:

1. Check for an existing `X-Request-Id` header (forwarded from an upstream service or API gateway).
2. If absent, generate a new UUID v4.
3. Attach to a child logger scoped to the request lifecycle.
4. Return in the `X-Request-Id` response header so clients can reference it in support requests.
5. Pass the requestId to all downstream service calls via the `X-Request-Id` header.

This enables tracing a single user action across multiple services and log entries.

---

## 3. What to Log

### 3.1 Always Log

- **Authentication events:** login success, login failure, token refresh, logout.
- **Authorization failures:** access denied, insufficient permissions, resource not owned.
- **Data mutations:** create, update, delete operations with entity type and ID.
- **External service calls:** outbound HTTP requests with URL, method, status, duration.
- **Errors:** all caught and uncaught exceptions with stack traces.
- **System lifecycle:** process start, graceful shutdown, configuration loaded.
- **Rate limit events:** when a request is rate-limited (at `warn` level).

### 3.2 Never Log

- **Passwords:** raw or hashed. Not even partially.
- **Authentication tokens:** JWTs, API keys, session tokens, refresh tokens.
- **Credit card numbers:** or any PCI-DSS-scoped data.
- **Full request bodies:** truncate to a reasonable size (e.g., first 1KB). Never log file upload contents.
- **PII in non-audit logs:** email addresses, phone numbers, and IP addresses should only appear in audit-specific log streams where retention and access policies apply.

---

## 4. Sensitive Data Redaction

Configure pino's built-in redaction to scrub sensitive fields at the serializer level, before the log line is written:

```typescript
const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "body.password",
  "body.passwordConfirmation",
  "body.token",
  "body.refreshToken",
  "body.creditCard",
  "body.ssn",
  "user.email",
];
```

Redacted fields appear as `"[Redacted]"` in log output. This is a defense-in-depth measure -- the primary defense is not logging these fields at all.

---

## 5. Log Aggregation Pipeline

```
Application (stdout) → Log Collector → Storage → Query/Dashboard
```

| Stage | Tool Options | Notes |
|---|---|---|
| Application output | stdout (NDJSON) | Never write to files in containerized deployments |
| Log collector | Fluentd, Vector, Fluent Bit | Runs as sidecar or DaemonSet; handles buffering, routing, enrichment |
| Storage | Elasticsearch, Grafana Loki, AWS CloudWatch Logs | Choose based on scale and query needs |
| Query / Dashboard | Kibana, Grafana, CloudWatch Insights | Correlate by requestId, filter by level and service |

**Key principles:**
- Applications write to **stdout only**. The infrastructure layer handles collection and routing.
- Log retention: 30 days for `info` and above; 7 days for `debug` (if enabled in staging).
- Audit logs (auth events, data mutations) have a separate retention policy: 1 year minimum.

---

## 6. Metrics

### 6.1 RED Method (Request-Oriented)

The RED method captures the three signals that matter most for user-facing services:

| Signal | Metric | Description |
|---|---|---|
| **Rate** | `http_requests_total` | Requests per second, labeled by method, path, status |
| **Errors** | `http_requests_errors_total` | Error count (5xx responses), error rate as percentage |
| **Duration** | `http_request_duration_seconds` | Latency histogram with P50, P95, P99 buckets |

### 6.2 USE Method (Resource-Oriented)

The USE method captures infrastructure health:

| Signal | Metric | Description |
|---|---|---|
| **Utilization** | `process_cpu_seconds_total`, `process_resident_memory_bytes` | CPU and memory consumption |
| **Saturation** | `db_pool_active_connections`, `queue_depth` | How close resources are to capacity |
| **Errors** | `db_query_errors_total`, `external_call_errors_total` | Infrastructure-level failure rates |

### 6.3 Business Metrics

Track events that matter to the product:

- `user_signups_total` -- New user registrations per day.
- `api_calls_by_customer` -- API usage per customer (for billing and capacity planning).
- `revenue_events_total` -- Payment completions, subscription changes.
- `feature_usage_total` -- Labeled by feature name, tracks adoption.

### 6.4 Prometheus Exposition

All metrics are exposed at `GET /metrics` in Prometheus exposition format:

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/users",status="200"} 15234

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.01"} 12000
http_request_duration_seconds_bucket{le="0.05"} 14500
http_request_duration_seconds_bucket{le="0.1"} 14900
http_request_duration_seconds_bucket{le="0.5"} 15100
http_request_duration_seconds_bucket{le="1"} 15200
http_request_duration_seconds_bucket{le="+Inf"} 15234
http_request_duration_seconds_sum 1523.4
http_request_duration_seconds_count 15234
```

The `/metrics` endpoint is excluded from rate limiting and authentication. Restrict access at the network level (internal-only ingress).

---

## 7. Dashboards

### Key Dashboard Panels

| Panel | Metric Source | Visualization |
|---|---|---|
| Request Rate | `rate(http_requests_total[5m])` | Time series graph |
| Error Rate | `rate(http_requests_errors_total[5m]) / rate(http_requests_total[5m]) * 100` | Time series with threshold line at 5% |
| P95 Latency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | Time series with threshold line at 500ms |
| Active Connections | `db_pool_active_connections` | Gauge with max-pool-size reference line |
| Queue Depth | `queue_depth` | Time series with threshold line at 1000 |
| CPU Usage | `rate(process_cpu_seconds_total[5m])` | Gauge (percentage) |
| Memory Usage | `process_resident_memory_bytes` | Gauge with RSS limit reference |
| External Call Latency | `histogram_quantile(0.95, rate(external_call_duration_seconds_bucket[5m]))` | Time series by service |

Organize dashboards by audience:
- **On-call dashboard:** Error rate, P95 latency, queue depth, recent alerts.
- **Service dashboard:** All RED metrics, dependency health, deployment markers.
- **Business dashboard:** Signups, API usage, revenue events.

---

## 8. Alerting Rules

| Alert | Condition | Duration | Severity |
|---|---|---|---|
| High Error Rate | Error rate > 5% | 5 minutes | Critical |
| High Latency | P95 > 500ms | 10 minutes | Warning |
| Very High Latency | P95 > 2000ms | 5 minutes | Critical |
| Queue Backlog | Queue depth > 1000 | 5 minutes | Warning |
| Queue Stalled | Queue depth > 5000 | 5 minutes | Critical |
| Disk Usage | Disk > 80% | 1 minute | Warning |
| Disk Critical | Disk > 95% | 1 minute | Critical |
| Memory Pressure | RSS > 90% of limit | 5 minutes | Warning |
| DB Pool Exhaustion | Active connections > 90% of pool max | 5 minutes | Critical |
| External Dependency Down | Error rate to dependency > 50% | 2 minutes | Critical |

Alert routing:
- **Critical:** Page on-call engineer immediately (PagerDuty / Opsgenie).
- **Warning:** Send to Slack channel; investigate within 1 hour during business hours.

---

## 9. Canonical Pino Setup

```typescript
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "body.password",
      "body.passwordConfirmation",
      "body.token",
      "body.refreshToken",
      "body.creditCard",
    ],
    censor: "[Redacted]",
  },
  base: {
    service: process.env.SERVICE_NAME || "modaf-backend",
    env: process.env.NODE_ENV || "development",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
});
```

---

## 10. Canonical Request Logging Middleware

```typescript
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export function requestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (req.headers["x-request-id"] as string) || randomUUID();
    const startTime = process.hrtime.bigint();

    // Create a child logger with request context
    const log = logger.child({
      requestId,
      method: req.method,
      path: req.originalUrl,
    });

    // Attach to request for use in handlers
    (req as any).log = log;
    (req as any).requestId = requestId;

    // Set response header
    res.setHeader("X-Request-Id", requestId);

    // Log request start
    log.info({
      msg: "request started",
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      contentLength: req.headers["content-length"],
    });

    // Log on response finish
    res.on("finish", () => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const statusCode = res.statusCode;

      const logData = {
        msg: "request completed",
        statusCode,
        duration: Math.round(duration * 100) / 100,
        contentLength: res.getHeader("content-length"),
      };

      if (statusCode >= 500) {
        log.error(logData);
      } else if (statusCode >= 400) {
        log.warn(logData);
      } else {
        log.info(logData);
      }
    });

    next();
  };
}
```

Usage in the application:

```typescript
import express from "express";
import { requestLogging } from "./middleware/request-logging";

const app = express();

// Request logging is the first middleware after rate limiting
app.use(requestLogging());

// Handler example using the request-scoped logger
app.post("/api/users", async (req, res) => {
  const log = (req as any).log;

  log.info({ msg: "creating user", email: req.body.email });

  try {
    const user = await userService.create(req.body);
    log.info({ msg: "user created", userId: user.id });
    res.status(201).json(user);
  } catch (err) {
    log.error({ msg: "user creation failed", err });
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});
```
