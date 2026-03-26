# Caching Strategy

> **TL;DR:** Use a three-tier cache hierarchy (in-memory, Redis, CDN) with cache-aside as the default pattern, event-based invalidation for mutable data, and TTL as the safety net.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** All backend services that read data more often than they write it

---

## Cache Hierarchy

The system uses a three-level cache hierarchy. Each level trades freshness for speed.

| Level | Location | Scope | Latency | Typical TTL |
|-------|----------|-------|---------|-------------|
| L1 | In-memory (per-process) | Single process | < 1ms | 5-60 seconds |
| L2 | Redis (shared) | All processes / pods | 1-5ms | 30 seconds - 24 hours |
| L3 | CDN (edge) | All users globally | 10-50ms | 1 minute - 1 day |

A read request checks L1 first, then L2, then L3, and finally the origin (database or external API). Cache misses at each level populate that level on the way back.

```
Client → CDN (L3) → App Server
                       ↓
                  In-Memory (L1)
                       ↓
                   Redis (L2)
                       ↓
                   Database
```

---

## When to Cache

Cache aggressively when:

- **Read-heavy data** -- user profiles, organization settings, feature flags, product catalogs
- **Expensive computations** -- aggregated reports, leaderboards, search results
- **External API responses** -- third-party data that does not change frequently (exchange rates, geocoding)
- **Session data** -- authentication tokens, user preferences for the current session
- **Configuration** -- application config, permission matrices, plan limits
- **Reference data** -- country lists, currency codes, timezone definitions

---

## When NOT to Cache

Avoid caching when:

- **Write-heavy data** -- data that changes on nearly every request (counters updated per-request, real-time streams)
- **User-specific realtime data** -- live notifications, chat messages, cursor positions
- **Security-sensitive data** -- passwords, API keys, PII that must be minimized in storage
- **Data with strict consistency requirements** -- account balances, inventory counts during checkout
- **Large, rarely-accessed objects** -- full audit logs, large file blobs

---

## Cache Patterns

### Cache-Aside (Default Pattern)

The application manages the cache explicitly. This is the default pattern for all cacheable reads.

```typescript
async function getUserById(id: string): Promise<User> {
  // 1. Check cache
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  // 2. Cache miss -- query database
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError("User", id);

  // 3. Populate cache
  await cache.set(`user:${id}`, user, { ttl: 300 }); // 5 minutes

  // 4. Return
  return user;
}
```

### Write-Through

The cache is updated synchronously as part of the write path. Use this when reads vastly outnumber writes and stale data is unacceptable.

```typescript
async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  // 1. Update database
  const user = await userRepo.update(id, input);

  // 2. Update cache (synchronous -- blocks until cache is written)
  await cache.set(`user:${id}`, user, { ttl: 300 });

  return user;
}
```

### Write-Behind (Write-Back)

The cache is updated immediately and the database write is deferred. Use this only for high-throughput, loss-tolerant writes (e.g., view counters, analytics events).

```typescript
async function incrementViewCount(articleId: string): Promise<void> {
  // 1. Increment in cache (fast)
  const newCount = await redis.incr(`views:${articleId}`);

  // 2. Periodically flush to database (async, batched)
  if (newCount % 100 === 0) {
    await queue.add("flush-view-count", { articleId, count: newCount });
  }
}
```

### Cache Invalidation

Invalidation is the hardest part of caching. Use a combination of TTL and event-based invalidation.

**TTL-based (safety net):** Every cache entry has a TTL. Even if event-based invalidation fails, data will eventually refresh.

**Event-based (primary):** When data changes, emit a domain event that triggers cache deletion.

```typescript
// In the service layer, after a write operation
eventBus.on("user.updated", async ({ userId }) => {
  await cache.delete(`user:${userId}`);
  await cache.delete(`user:${userId}:profile`);
  await cache.deletePattern(`user:${userId}:*`); // clear all related keys
});
```

**Manual purge:** Expose an admin endpoint for emergency cache clearing.

```typescript
router.post("/admin/cache/purge", adminOnly, async (req, res) => {
  const { pattern } = req.body; // e.g., "user:*"
  const deletedCount = await cache.deletePattern(pattern);
  res.json({ deleted: deletedCount });
});
```

---

## Redis Caching

### Key Naming Convention

Use a consistent, hierarchical naming scheme:

```
{service}:{resource}:{identifier}:{sub-resource}
```

Examples:

```
api:user:abc123                  # User object
api:user:abc123:permissions      # User permissions
api:org:def456:members           # Organization members list
api:project:ghi789:settings      # Project settings
api:config:feature-flags         # Global feature flags
session:token:xyz                # Session data
rate:ip:192.168.1.1              # Rate limit counter
lock:user:abc123:update          # Distributed lock
```

### TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Session tokens | 24 hours | Match session expiry |
| User profile | 5 minutes | Changes infrequently, but must reflect updates reasonably fast |
| Organization settings | 10 minutes | Rarely changes, slightly stale is acceptable |
| Feature flags | 1 minute | Must propagate quickly for rollout/rollback |
| List / search results | 30 seconds | Stale lists are noticeable; keep TTL short |
| Configuration / reference data | 1 hour | Essentially static; long TTL is safe |
| Rate limit counters | Matches the rate limit window | Must expire precisely |
| Expensive aggregations | 15 minutes | Recomputation is costly; accept moderate staleness |

### Serialization

```typescript
// JSON for complex objects
await redis.set(key, JSON.stringify(value), "EX", ttl);
const value = JSON.parse(await redis.get(key));

// Raw strings for simple values (counters, flags)
await redis.set("config:maintenance-mode", "true", "EX", 3600);
await redis.incr("stats:api-calls:2026-03-26");
```

### Connection Pooling and Error Handling

```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null; // stop retrying
    return Math.min(times * 200, 5000); // exponential backoff, max 5s
  },
  enableReadyCheck: true,
  lazyConnect: true,
});

// Graceful degradation: cache failures must not break the application
redis.on("error", (err) => {
  logger.warn("Redis connection error -- falling back to database", { error: err.message });
});
```

---

## HTTP Caching

### Cache-Control Headers

```typescript
// Public, cacheable by CDN and browser
res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
// Browser caches for 60s, CDN caches for 300s, CDN serves stale for 60s while revalidating

// Private, cacheable by browser only
res.set("Cache-Control", "private, max-age=300");
// User-specific data -- CDN must not cache

// No caching at all
res.set("Cache-Control", "no-store");
// Sensitive data -- must not be stored anywhere
```

### ETag / Conditional Requests

```typescript
import { createHash } from "crypto";

function generateETag(data: unknown): string {
  const hash = createHash("md5").update(JSON.stringify(data)).digest("hex");
  return `"${hash}"`;
}

// In the controller
async function getUser(req: Request, res: Response) {
  const user = await userService.findById(req.params.id);
  const etag = generateETag(user);

  // If client already has this version, return 304
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).send();
  }

  res.set("ETag", etag);
  res.set("Cache-Control", "private, max-age=0, must-revalidate");
  res.json({ data: user });
}
```

### CDN Caching for Public API Responses

```typescript
// Middleware to set CDN-friendly headers for public endpoints
function cdnCacheable(maxAge: number, staleWhileRevalidate = 60) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
    res.set("Vary", "Accept, Accept-Encoding");
    next();
  };
}

// Apply to public endpoints
router.get("/api/v1/products", cdnCacheable(300), ProductController.list);
router.get("/api/v1/categories", cdnCacheable(3600), CategoryController.list);
```

---

## Cache Stampede Prevention

A cache stampede occurs when many requests simultaneously miss the cache and all hit the database at once. Two strategies prevent this.

### Mutex Lock

Only one request recomputes the value; others wait for the result.

```typescript
async function getWithLock<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;

  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, "1", "NX", "EX", 10); // 10s lock

  if (lockAcquired) {
    try {
      // This process won the lock -- fetch from source
      const value = await fetchFn();
      await cache.set(key, value, { ttl });
      return value;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Another process holds the lock -- wait and retry
  await sleep(50);
  return getWithLock(key, ttl, fetchFn);
}
```

### Probabilistic Early Expiration

Each process independently decides to refresh the cache slightly before it expires, spreading the recomputation load.

```typescript
async function getWithEarlyExpiry<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const entry = await redis.get(key);
  if (entry) {
    const { value, expiresAt } = JSON.parse(entry);
    const remainingTtl = expiresAt - Date.now();
    const beta = 1.0; // tuning parameter

    // Probabilistically refresh before expiry
    // As remaining TTL approaches 0, probability of refresh approaches 1
    const shouldRefresh = remainingTtl > 0 && Math.random() < Math.exp(-remainingTtl / (ttl * 1000 * beta));

    if (!shouldRefresh) return value;
  }

  // Fetch fresh data
  const value = await fetchFn();
  const wrappedEntry = JSON.stringify({ value, expiresAt: Date.now() + ttl * 1000 });
  await redis.set(key, wrappedEntry, "EX", ttl);
  return value;
}
```

---

## Cache Warming

Preload frequently accessed data on deploy or process start to avoid a cold-cache surge.

```typescript
// /lib/cache-warmer.ts

export async function warmCaches(deps: {
  userRepo: UserRepository;
  configRepo: ConfigRepository;
  cache: CacheService;
}): Promise<void> {
  const startTime = Date.now();
  logger.info("Cache warming started");

  // Warm feature flags
  const flags = await deps.configRepo.getAllFeatureFlags();
  await deps.cache.set("config:feature-flags", flags, { ttl: 60 });

  // Warm top 100 most-accessed users
  const topUsers = await deps.userRepo.findMostActive(100);
  await Promise.all(
    topUsers.map((user) =>
      deps.cache.set(`user:${user.id}`, user, { ttl: 300 })
    )
  );

  // Warm reference data
  const countries = await deps.configRepo.getCountries();
  await deps.cache.set("ref:countries", countries, { ttl: 3600 });

  const elapsed = Date.now() - startTime;
  logger.info("Cache warming completed", { durationMs: elapsed });
}

// Call during server startup
app.on("ready", () => warmCaches(deps));
```

---

## Monitoring

Track these metrics to understand cache health and tune TTLs:

| Metric | Target | Action if Off |
|--------|--------|---------------|
| **Hit rate** | > 90% for L1, > 80% for L2 | Increase TTL, check invalidation frequency |
| **Miss rate** | < 20% | Check if keys are being invalidated too aggressively |
| **Eviction rate** | < 5% of total keys | Increase Redis memory or reduce TTL on low-value keys |
| **Memory usage** | < 80% of allocated | Add memory, shorten TTLs, or remove low-value cache entries |
| **Latency (p99)** | < 5ms for Redis gets | Check network, connection pooling, key size |
| **Error rate** | < 0.1% | Check Redis health, connection pool exhaustion |

```typescript
// /lib/cache-metrics.ts

export class InstrumentedCache {
  constructor(
    private cache: CacheService,
    private metrics: MetricsClient
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    try {
      const value = await this.cache.get<T>(key);
      const duration = Date.now() - start;

      this.metrics.histogram("cache.get.duration_ms", duration, { key_prefix: this.prefix(key) });

      if (value !== null) {
        this.metrics.increment("cache.hit", { key_prefix: this.prefix(key) });
      } else {
        this.metrics.increment("cache.miss", { key_prefix: this.prefix(key) });
      }

      return value;
    } catch (error) {
      this.metrics.increment("cache.error", { key_prefix: this.prefix(key), operation: "get" });
      logger.warn("Cache get failed", { key, error });
      return null; // Graceful degradation
    }
  }

  async set<T>(key: string, value: T, opts: { ttl: number }): Promise<void> {
    const start = Date.now();
    try {
      await this.cache.set(key, value, opts);
      this.metrics.histogram("cache.set.duration_ms", Date.now() - start, { key_prefix: this.prefix(key) });
    } catch (error) {
      this.metrics.increment("cache.error", { key_prefix: this.prefix(key), operation: "set" });
      logger.warn("Cache set failed", { key, error });
      // Do not throw -- cache write failure is non-fatal
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.cache.delete(key);
      this.metrics.increment("cache.delete", { key_prefix: this.prefix(key) });
    } catch (error) {
      this.metrics.increment("cache.error", { key_prefix: this.prefix(key), operation: "delete" });
      logger.warn("Cache delete failed", { key, error });
    }
  }

  private prefix(key: string): string {
    return key.split(":").slice(0, 2).join(":");
  }
}
```

---

## Canonical Cache Helper

A complete, reusable cache helper that combines cache-aside reads, write-through writes, and stampede prevention.

```typescript
// /lib/cache.ts

import Redis from "ioredis";

export interface CacheOptions {
  ttl: number;        // seconds
  lockTtl?: number;   // seconds, for stampede prevention (default: 10)
}

export class CacheService {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.redis.del(key); // corrupted entry
      return null;
    }
  }

  async set<T>(key: string, value: T, opts: CacheOptions): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.set(key, serialized, "EX", opts.ttl);
  }

  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, opts: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const lockKey = `lock:${key}`;
    const lockTtl = opts.lockTtl ?? 10;
    const acquired = await this.redis.set(lockKey, "1", "NX", "EX", lockTtl);

    if (acquired) {
      try {
        const value = await fetchFn();
        await this.set(key, value, opts);
        return value;
      } finally {
        await this.redis.del(lockKey);
      }
    }

    // Wait for the lock holder to populate the cache
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const result = await this.get<T>(key);
      if (result !== null) return result;
    }

    // Lock holder may have failed -- fetch directly
    return fetchFn();
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, "MATCH", pattern, "COUNT", 100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }
}
```

This cache service is designed for graceful degradation: callers should catch and log errors from cache operations rather than letting them propagate. The database is always the source of truth; the cache is a performance optimization that must never cause a request to fail.
