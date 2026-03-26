# Performance Optimization

> **TL;DR:** Set explicit performance budgets (P95 < 200ms, P99 < 500ms), optimize database queries first, layer caching strategically, and validate with load tests before every release.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** All backend services, APIs, background jobs, and database interactions

---

## Performance Budgets

Every backend service must operate within these latency and resource budgets. Violations trigger investigation and remediation before the next release.

| Metric | Target | Hard Limit | Measurement |
|---|---|---|---|
| API response P50 | < 100ms | < 150ms | Application metrics |
| API response P95 | < 200ms | < 350ms | Application metrics |
| API response P99 | < 500ms | < 1000ms | Application metrics |
| Database query (single) | < 20ms | < 50ms | Query logging |
| Database query (complex join) | < 50ms | < 100ms | Query logging |
| Background job execution | < 10s | < 30s | Job queue metrics |
| Background job start delay | < 5s | < 15s | Job queue metrics |
| Memory per instance | < 256MB | < 512MB | Container metrics |
| CPU per instance (sustained) | < 50% | < 80% | Container metrics |

Monitor these budgets continuously. Set alerts at 80% of hard limits so you catch regressions before they become incidents.

---

## Database Optimization

Database queries are the single largest contributor to API latency. Optimize them first before touching application code.

### EXPLAIN ANALYZE for Slow Queries

Every slow query investigation starts with `EXPLAIN ANALYZE`. This shows the actual execution plan the database used, not just what it planned to do.

```sql
EXPLAIN ANALYZE
SELECT u.id, u.name, o.name AS org_name
FROM users u
JOIN org_memberships om ON om.user_id = u.id
JOIN organizations o ON o.id = om.org_id
WHERE u.status = 'active'
ORDER BY u.created_at DESC
LIMIT 50;
```

Key things to look for in the output:

- **Seq Scan** on large tables -- indicates a missing index
- **Nested Loop** with high row estimates -- may need a different join strategy
- **Sort** with high memory usage -- consider an index that matches the ORDER BY
- **Actual rows** far exceeding **estimated rows** -- stale statistics, run `ANALYZE`
- **Buffers: shared read** being high -- data not cached, may need to increase `shared_buffers`

### Index Tuning

Add indexes for columns that appear in:

- `WHERE` clauses (equality and range conditions)
- `JOIN` conditions
- `ORDER BY` clauses (especially combined with `LIMIT`)
- `DISTINCT` or `GROUP BY` clauses

```sql
-- Composite index for a common query pattern
CREATE INDEX idx_users_status_created ON users (status, created_at DESC);

-- Partial index for a subset of rows
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';

-- Expression index for case-insensitive search
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```

Remove unused indexes. Every index slows down writes and consumes storage. Identify unused indexes with:

```sql
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### N+1 Query Detection

N+1 queries are the most common performance problem in ORM-based applications. They occur when fetching a list of records and then making an individual query for each record's related data.

Detection methods:

- **Query logging:** Enable query logging in development and count queries per request. Any endpoint that makes more than 10 queries for a list endpoint is suspect.
- **Automated detection:** Use middleware that counts queries per request and logs a warning when the count exceeds a threshold.

```typescript
// Middleware to detect N+1 queries in development
function queryCountMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    let queryCount = 0;
    const originalQuery = prisma.$queryRawUnsafe;

    // Increment counter on each query (simplified)
    prisma.$use(async (params, next) => {
      queryCount++;
      const result = await next(params);
      if (queryCount > 10) {
        console.warn(
          `[N+1 WARNING] ${req.method} ${req.path} -- ${queryCount} queries`
        );
      }
      return result;
    });

    await next();
  };
}
```

### N+1 Prevention

**Eager loading with Prisma `include`:**

```typescript
// BAD: N+1 -- one query for users, then one query per user for their org
const users = await prisma.user.findMany();
for (const user of users) {
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
  });
}

// GOOD: Single query with JOIN
const users = await prisma.user.findMany({
  include: {
    organization: true,
    memberships: { include: { role: true } },
  },
});
```

**Data loader pattern for batch queries:**

When eager loading is not practical (e.g., GraphQL resolvers or deeply nested access patterns), use a data loader to batch and deduplicate queries within a single request.

```typescript
import DataLoader from "dataloader";

// Create a loader that batches user lookups by ID
const userLoader = new DataLoader<string, User>(async (userIds) => {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return userIds.map((id) => userMap.get(id) ?? new Error(`User ${id} not found`));
});

// Usage: these calls within the same tick are batched into one query
const user1 = await userLoader.load("user-1");
const user2 = await userLoader.load("user-2");
```

### Connection Pooling

Database connections are expensive to create. Always use connection pooling.

**PgBouncer (recommended for production):**

- Sits between the application and PostgreSQL
- Supports transaction-level pooling (connections returned after each transaction)
- Pool size formula: `pool_size = (num_cores * 2) + effective_spindle_count` (for SSDs, use `num_cores * 2 + 1`)
- Typical production setting: 20-50 connections per pool

**Application-level pooling (Prisma):**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  // ?connection_limit=20&pool_timeout=10
}
```

Pool size guidelines:

- Development: 5 connections
- Production (per instance): 10-20 connections
- Total across all instances should not exceed PostgreSQL `max_connections` minus overhead (typically 100)

### Query Optimization Techniques

```typescript
// Select only needed columns
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
  where: { status: "active" },
  take: 50,
});

// Use cursors for large result sets (not OFFSET)
const nextPage = await prisma.user.findMany({
  take: 50,
  skip: 1,
  cursor: { id: lastUserId },
  orderBy: { id: "asc" },
});
```

### Materialized Views

For complex aggregations that are queried frequently but change infrequently, use materialized views.

```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
  o.id AS org_id,
  COUNT(DISTINCT u.id) AS user_count,
  COUNT(DISTINCT p.id) AS project_count,
  MAX(a.created_at) AS last_activity
FROM organizations o
LEFT JOIN users u ON u.org_id = o.id
LEFT JOIN projects p ON p.org_id = o.id
LEFT JOIN activities a ON a.org_id = o.id
GROUP BY o.id;

CREATE UNIQUE INDEX idx_dashboard_stats_org ON dashboard_stats (org_id);

-- Refresh periodically (e.g., every 5 minutes via cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
```

---

## Application Optimization

### Response Compression

Enable gzip or brotli compression for all API responses. Most frameworks support this via middleware.

```typescript
import compression from "compression";

app.use(
  compression({
    level: 6, // balance between compression ratio and CPU
    threshold: 1024, // only compress responses larger than 1KB
    filter: (req, res) => {
      // Compress JSON and text responses
      const contentType = res.getHeader("Content-Type") as string;
      return /json|text|javascript|css/.test(contentType || "");
    },
  })
);
```

### Payload Optimization

- Return only the fields the client needs. Use `select` in queries and shape response DTOs explicitly.
- Paginate all list endpoints. Default page size: 20, max: 100.
- Use cursor-based pagination for real-time data or large datasets.
- Avoid deeply nested response objects; flatten where possible.

### Streaming Responses

For large datasets (exports, reports), stream the response instead of buffering it in memory.

```typescript
app.get("/api/v1/exports/users", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Transfer-Encoding", "chunked");

  res.write("[");
  let first = true;

  const cursor = prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { id: "asc" },
  });

  // Stream in batches
  let lastId: string | undefined;
  while (true) {
    const batch = await prisma.user.findMany({
      take: 100,
      ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;

    for (const user of batch) {
      res.write((first ? "" : ",") + JSON.stringify(user));
      first = false;
    }
    lastId = batch[batch.length - 1].id;
  }

  res.write("]");
  res.end();
});
```

### Memory Leak Detection

Memory leaks are subtle and often only manifest under sustained load.

- Set `--max-old-space-size` appropriately (default 1.5GB for 64-bit, use 256-512MB for containerized apps)
- Take heap snapshots at intervals under load and compare retained object counts
- Watch for growing arrays, event listener counts, and unclosed streams
- Use `process.memoryUsage()` in health check endpoints to track RSS over time

```typescript
app.get("/health", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + "MB",
      external: Math.round(mem.external / 1024 / 1024) + "MB",
    },
    uptime: process.uptime(),
  });
});
```

---

## Caching for Performance

### What to Cache

| Data Type | TTL | Invalidation |
|---|---|---|
| User profiles | 5 min | On profile update |
| Permissions/roles | 10 min | On role change |
| App configuration | 30 min | On config update |
| Dashboard stats | 5 min | On refresh schedule |
| Aggregate counts | 2 min | Time-based only |
| External API responses | Varies | Per API rate limits |
| Static lookups (countries, currencies) | 24 hours | On deployment |

### Invalidation Strategy

- **Time-based (TTL):** simplest, acceptable staleness. Use for aggregates and stats.
- **Event-based:** publish cache invalidation events on data mutation. Use for user profiles and permissions.
- **Version-based:** include a version key; increment on change. Use for configuration.

---

## Load Testing

### Tools

- **k6 (default):** JavaScript-based, excellent for CI integration, good reporting
- **Artillery:** YAML config, good for quick tests, less flexible
- **autocannon:** Node.js native, good for microbenchmarks

### Test Types

- **Baseline test:** 10 concurrent users for 2 minutes. Establishes normal performance.
- **Stress test:** Ramp from 10 to 500 users over 10 minutes. Find the breaking point.
- **Soak test:** 50 concurrent users for 2-4 hours. Detects memory leaks and connection exhaustion.
- **Spike test:** Jump from 10 to 200 users instantly. Tests auto-scaling and error handling.

### Canonical k6 Load Test Script

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const apiDuration = new Trend("api_duration");

export const options = {
  stages: [
    { duration: "1m", target: 20 },   // ramp up
    { duration: "3m", target: 20 },   // steady state
    { duration: "1m", target: 50 },   // push higher
    { duration: "3m", target: 50 },   // steady at peak
    { duration: "1m", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200", "p(99)<500"],
    errors: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export function setup() {
  // Authenticate and return token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: "loadtest@example.com",
    password: "loadtest-password",
  }), { headers: { "Content-Type": "application/json" } });

  return { token: loginRes.json("token") };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    "Content-Type": "application/json",
  };

  // Scenario 1: List users
  const listRes = http.get(`${BASE_URL}/api/v1/users?limit=20`, { headers });
  check(listRes, { "list status 200": (r) => r.status === 200 });
  errorRate.add(listRes.status !== 200);
  apiDuration.add(listRes.timings.duration);

  sleep(1);

  // Scenario 2: Get single user
  const getRes = http.get(`${BASE_URL}/api/v1/users/me`, { headers });
  check(getRes, { "get status 200": (r) => r.status === 200 });
  errorRate.add(getRes.status !== 200);
  apiDuration.add(getRes.timings.duration);

  sleep(1);

  // Scenario 3: Create resource
  const createRes = http.post(`${BASE_URL}/api/v1/tasks`, JSON.stringify({
    title: `Load test task ${Date.now()}`,
    description: "Created during load testing",
  }), { headers });
  check(createRes, { "create status 201": (r) => r.status === 201 });
  errorRate.add(createRes.status !== 201);
  apiDuration.add(createRes.timings.duration);

  sleep(2);
}
```

---

## Profiling

### Node.js Built-in Profiler

```bash
# Record a CPU profile
node --prof app.js
# Process the log
node --prof-process isolate-*.log > profile.txt
```

### Flame Graphs

Use `0x` or `clinic.js` to generate flame graphs that visually show where CPU time is spent.

```bash
npx 0x -- node app.js
# Or with clinic
npx clinic flame -- node app.js
```

### Trace Events

For detailed async operation tracing:

```bash
node --trace-events-enabled --trace-event-categories v8,node.async_hooks app.js
```

Open the resulting trace file in `chrome://tracing` for visualization.

---

## Performance Optimization Checklist

Before every release, verify:

1. All API endpoints meet P95 < 200ms budget
2. No N+1 queries detected in query logs
3. Database indexes cover all frequent query patterns
4. Connection pool is sized correctly for the deployment
5. Response compression is enabled
6. List endpoints are paginated with sensible defaults
7. Cache hit rates are above 80% for hot data
8. Load test passes with no threshold violations
9. Memory usage is stable over a 1-hour soak test
10. No unused indexes consuming write overhead
