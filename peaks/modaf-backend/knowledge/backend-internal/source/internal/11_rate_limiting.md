# Rate Limiting System

> **TL;DR:** Token-bucket rate limiting at multiple tiers (global, per-IP, per-user, per-endpoint) backed by Redis, with cost-based weighting for expensive operations and standard response headers for client integration.

---

**Knowledge Pack:** modaf-backend
**Category:** Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active

---

## 1. Purpose

Rate limiting serves three core goals:

1. **Prevent abuse** -- Stop malicious actors from overwhelming the system with automated or scripted requests (credential stuffing, scraping, enumeration attacks).
2. **Protect resources** -- Guard downstream services, databases, and third-party integrations from cascading overload. A single runaway client should never degrade the experience for everyone.
3. **Ensure fair usage** -- Distribute capacity equitably across tenants so that no single consumer monopolizes shared infrastructure.

Rate limiting is a **first-line defense** that runs before authentication, validation, or business logic. It fails fast and cheaply.

---

## 2. Algorithm Selection

### 2.1 Fixed Window

- Divide time into fixed intervals (e.g., 1-minute windows aligned to clock minutes).
- Maintain a counter per window per key. Increment on each request; reject when counter exceeds the limit.
- **Pros:** Simple to implement, low storage overhead.
- **Cons:** Burst at window boundaries -- a client can send `limit` requests at the end of window N and `limit` more at the start of window N+1, effectively doubling throughput in a short span.

### 2.2 Sliding Window

- Combine counts from the current window and the previous window, weighted by how far into the current window we are.
- Formula: `effective_count = prev_count * (1 - elapsed_fraction) + current_count`
- **Pros:** Smooths out boundary bursts while remaining computationally cheap.
- **Cons:** Slightly more complex than fixed window; still an approximation.

### 2.3 Token Bucket (Default)

- Each key has a bucket with a maximum capacity (`burst_size`) and a refill rate (`tokens_per_second`).
- Each request consumes one or more tokens. If insufficient tokens remain, the request is rejected.
- Tokens accumulate up to `burst_size` when the client is idle, allowing controlled bursts.
- **Pros:** Naturally handles bursty traffic; intuitive configuration; widely understood.
- **Cons:** Requires storing both the token count and the last-refill timestamp.
- **This is the default algorithm for all API rate limiting in modaf-backend.**

### 2.4 Leaky Bucket

- Requests enter a queue (bucket) that drains at a fixed rate.
- If the queue is full, new requests are rejected.
- **Pros:** Produces a perfectly consistent output rate; excellent for background job queues and webhook delivery.
- **Cons:** Adds latency (requests wait in queue); not ideal for interactive API endpoints where immediate response matters.

**Decision guide:**

| Use Case | Algorithm |
|---|---|
| Public API rate limiting | Token bucket |
| Background job dispatch | Leaky bucket |
| Simple internal throttling | Fixed or sliding window |
| Multi-tenant SaaS tiers | Token bucket with per-tier config |

---

## 3. Implementation Tiers

Rate limits are enforced in layers. A request must pass all applicable tiers.

### 3.1 Global Tier

- **Scope:** All inbound requests regardless of identity.
- **Default limit:** 1000 requests/minute.
- **Purpose:** DDoS protection and system-wide safety valve.
- **Key:** Single global counter (or per-instance if not using shared storage).

### 3.2 Per-IP Tier

- **Scope:** Unauthenticated requests grouped by client IP.
- **Default limit:** 60 requests/minute.
- **Purpose:** Prevent anonymous abuse (scraping, enumeration, brute force).
- **Key:** Client IP address (respect `X-Forwarded-For` behind trusted proxies only).
- **Note:** Be cautious with shared IPs (corporate NAT, VPNs). Consider allowing higher limits for known CIDR ranges.

### 3.3 Per-User Tier

- **Scope:** Authenticated requests grouped by user or API key.
- **Default limit:** 300 requests/minute.
- **Purpose:** Fair usage among authenticated consumers.
- **Key:** User ID or API key identifier from the auth token.

### 3.4 Per-Endpoint Tier

- **Scope:** Sensitive or expensive endpoints with tighter limits.
- **Default limits:**
  - `POST /auth/login` -- 5 requests/minute
  - `POST /auth/signup` -- 3 requests/minute
  - `POST /auth/password-reset` -- 3 requests/minute
  - `POST /auth/verify-email` -- 5 requests/minute
  - `POST /uploads` -- 10 requests/minute
  - `GET /reports/export` -- 2 requests/minute
- **Key:** Combination of user/IP + endpoint path pattern.

---

## 4. Response Headers

Every response includes rate limit headers so clients can self-regulate:

| Header | Description | Example |
|---|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window | `300` |
| `X-RateLimit-Remaining` | Requests remaining in the current window | `247` |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets | `1711468800` |

These headers reflect the **most restrictive** tier that applies to the request.

---

## 5. Exceeded Response

When a client exceeds any rate limit, respond immediately:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 34
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711468834

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry after 34 seconds.",
  "retryAfter": 34
}
```

- The `Retry-After` header value is the number of seconds until the client can retry.
- The response body includes a machine-readable error code and the retry delay.
- Do **not** leak which tier was exceeded to external clients (security concern). Internal logs should record the tier.

---

## 6. Storage Backend

### 6.1 Redis (Production Default)

Redis provides atomic operations, expiration, and shared state across multiple application instances.

- Use `MULTI`/`EXEC` transactions to atomically read-and-increment counters.
- Use `PEXPIRE` for precise millisecond expiration on window keys.
- Key naming convention: `ratelimit:{tier}:{key}:{window}` (e.g., `ratelimit:user:usr_abc123:1711468800`).
- For token bucket, store a hash with `tokens` and `last_refill` fields.
- Redis cluster mode is supported; use hash tags `{key}` to ensure related keys land on the same shard.

### 6.2 In-Memory (Development / Single-Instance)

- Use a `Map<string, { count: number; resetAt: number }>` with periodic cleanup via `setInterval`.
- Suitable for development, testing, and single-instance deployments.
- Not suitable for production multi-instance deployments (each instance has independent state).

---

## 7. Middleware Pattern

Rate limiting runs as the **first middleware** in the request pipeline, before authentication, body parsing, or validation. This ensures:

1. Abusive requests are rejected with minimal resource consumption.
2. No database queries or external calls are made for rate-limited requests.
3. The application server stays responsive even under attack.

Pipeline order:

```
Request → Rate Limiter → CORS → Auth → Validation → Handler → Response
```

---

## 8. Rate Limit Bypass

Certain requests bypass rate limiting entirely:

- **Internal service-to-service calls:** Identified by a shared internal secret in the `X-Internal-Token` header. These are trusted and managed by separate circuit breakers.
- **Health check / readiness endpoints:** `GET /health`, `GET /ready`, `GET /metrics` are excluded so monitoring systems are never rate-limited.
- **Allow-listed IPs:** Specific CIDR ranges (e.g., office IPs, CI/CD runners) can be configured in the rate limiter allow-list.

Bypass decisions are logged at `debug` level for auditability.

---

## 9. Cost-Based Limiting

Not all requests impose equal load. Cost-based limiting assigns a token cost to each operation:

| Operation Type | Token Cost | Examples |
|---|---|---|
| Read (list/get) | 1 | `GET /users`, `GET /posts/:id` |
| Write (create/update) | 5 | `POST /users`, `PUT /posts/:id` |
| Upload / media | 10 | `POST /uploads`, `POST /imports` |
| Export / report | 20 | `GET /reports/export`, `GET /analytics/dump` |
| Search | 3 | `GET /search?q=...` |

With a per-user bucket of 300 tokens/minute, a client can make 300 reads, or 60 writes, or 15 exports, or any combination.

Cost is determined by matching the request method and path pattern against a cost configuration table. Unmatched routes default to cost 1.

---

## 10. Canonical Rate Limiter Middleware

```typescript
import { Redis } from "ioredis";
import type { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  costFn?: (req: Request) => number;
  keyFn: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export function createRateLimiter(redis: Redis, config: RateLimitConfig) {
  const {
    maxTokens,
    refillRate,
    costFn = () => 1,
    keyFn,
    skip,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) return next();

    const key = `ratelimit:${keyFn(req)}`;
    const cost = costFn(req);
    const now = Date.now();

    const result = await redis
      .multi()
      .hgetall(key)
      .exec();

    const stored = result?.[0]?.[1] as Record<string, string> | null;
    let state: BucketState;

    if (!stored || !stored.tokens) {
      state = { tokens: maxTokens, lastRefill: now };
    } else {
      state = {
        tokens: parseFloat(stored.tokens),
        lastRefill: parseInt(stored.lastRefill, 10),
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - state.lastRefill) / 1000;
    state.tokens = Math.min(maxTokens, state.tokens + elapsed * refillRate);
    state.lastRefill = now;

    const resetTimestamp = Math.ceil(
      now / 1000 + (maxTokens - state.tokens) / refillRate
    );

    if (state.tokens < cost) {
      const retryAfter = Math.ceil((cost - state.tokens) / refillRate);

      res.set({
        "X-RateLimit-Limit": String(maxTokens),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetTimestamp),
        "Retry-After": String(retryAfter),
      });

      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    // Consume tokens
    state.tokens -= cost;

    await redis
      .multi()
      .hset(key, "tokens", String(state.tokens), "lastRefill", String(state.lastRefill))
      .pexpire(key, Math.ceil(maxTokens / refillRate) * 1000 + 1000)
      .exec();

    res.set({
      "X-RateLimit-Limit": String(maxTokens),
      "X-RateLimit-Remaining": String(Math.floor(state.tokens)),
      "X-RateLimit-Reset": String(resetTimestamp),
    });

    next();
  };
}
```

---

## 11. Canonical Rate Limit Configuration

```typescript
import type { Request } from "express";

const ENDPOINT_COSTS: Record<string, number> = {
  "GET:*": 1,
  "POST:/auth/login": 1,
  "POST:/auth/signup": 1,
  "POST:*": 5,
  "PUT:*": 5,
  "PATCH:*": 5,
  "DELETE:*": 5,
  "POST:/uploads": 10,
  "GET:/reports/export": 20,
  "GET:/search": 3,
};

function getEndpointCost(req: Request): number {
  const specificKey = `${req.method}:${req.path}`;
  if (ENDPOINT_COSTS[specificKey] !== undefined) {
    return ENDPOINT_COSTS[specificKey];
  }
  const wildcardKey = `${req.method}:*`;
  return ENDPOINT_COSTS[wildcardKey] ?? 1;
}

export const rateLimitConfigs = {
  global: {
    windowMs: 60_000,
    maxTokens: 1000,
    refillRate: 1000 / 60,
    keyFn: () => "global",
  },
  perIp: {
    windowMs: 60_000,
    maxTokens: 60,
    refillRate: 1,
    keyFn: (req: Request) => `ip:${req.ip}`,
  },
  perUser: {
    windowMs: 60_000,
    maxTokens: 300,
    refillRate: 5,
    costFn: getEndpointCost,
    keyFn: (req: Request) => `user:${(req as any).userId}`,
    skip: (req: Request) => !(req as any).userId,
  },
  loginEndpoint: {
    windowMs: 60_000,
    maxTokens: 5,
    refillRate: 5 / 60,
    keyFn: (req: Request) => `login:${req.ip}`,
  },
  signupEndpoint: {
    windowMs: 60_000,
    maxTokens: 3,
    refillRate: 3 / 60,
    keyFn: (req: Request) => `signup:${req.ip}`,
  },
  passwordReset: {
    windowMs: 60_000,
    maxTokens: 3,
    refillRate: 3 / 60,
    keyFn: (req: Request) => `pwreset:${req.ip}`,
  },
};
```

---

## 12. Rate Limit Testing Strategy

### Unit Tests

- Test token bucket logic: verify tokens are consumed, refilled, and capped at max.
- Test cost calculation: verify correct cost is assigned per method/path combination.
- Test skip logic: verify internal services and health endpoints bypass limiting.
- Test key generation: verify correct keys are produced for each tier.

### Integration Tests

- Send `maxTokens + 1` requests and verify the last receives 429.
- Verify `X-RateLimit-Remaining` decrements correctly across sequential requests.
- Verify `Retry-After` header contains a reasonable positive integer.
- Wait for refill and verify requests succeed again.
- Test concurrent requests from the same key to verify Redis atomicity.

### Load Tests

- Use a tool like `k6` or `autocannon` to verify rate limiting holds under sustained pressure.
- Confirm that rate-limited responses have minimal latency (sub-5ms) since they short-circuit early.
- Verify Redis connection pool does not become a bottleneck under high rejection rates.

```typescript
// Example integration test
describe("Rate Limiting", () => {
  it("should return 429 when per-IP limit is exceeded", async () => {
    const requests = Array.from({ length: 61 }, () =>
      request(app).get("/api/public-endpoint")
    );
    const responses = await Promise.all(requests);
    const rejected = responses.filter((r) => r.status === 429);

    expect(rejected.length).toBeGreaterThanOrEqual(1);
    expect(rejected[0].headers["retry-after"]).toBeDefined();
    expect(rejected[0].body.error).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("should include rate limit headers on successful responses", async () => {
    const res = await request(app).get("/api/public-endpoint");

    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
  });
});
```
