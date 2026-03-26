# Queue & Job System

> **TL;DR:** Offload expensive, slow, or unreliable work to background jobs processed by workers pulling from a Redis-backed queue (BullMQ by default), with retry, priority, scheduling, and dead-letter support baked in.

---

**Status:** Stable
**Last updated:** 2026-03-26
**Applies to:** modaf-backend >=1.0
**Tags:** queues, jobs, background-processing, bullmq, redis, workers

---

## Architecture Overview

The job system follows the classic producer-queue-worker pattern:

```
Producer (enqueue) ──▶ Queue (Redis / SQS) ──▶ Worker (dequeue + process)
```

1. **Producer** -- any part of the application code that creates a job (an API handler, a cron trigger, another job).
2. **Queue** -- a durable, ordered list of pending jobs stored in Redis (BullMQ) or an external message broker.
3. **Worker** -- a long-running process that pulls jobs from the queue, executes the handler, and reports success or failure.

Producers and workers are decoupled. They share only the job name, the payload schema, and access to the same backing store.

---

## Default Stack

| Component | Default | Alternatives |
|-----------|---------|--------------|
| Queue library | BullMQ 5.x | - |
| Backing store | Redis 7+ | - |
| Swap-in broker | - | AWS SQS, RabbitMQ |

### Swapping to AWS SQS

Replace the BullMQ queue adapter with the SQS adapter. SQS provides at-least-once delivery and automatic message retention (up to 14 days). You lose native delayed-job support shorter than 15 minutes and fine-grained priority levels. Use SQS when you are already deep in AWS and want to avoid managing Redis.

### Swapping to RabbitMQ

RabbitMQ offers routing, topic exchanges, and more sophisticated acknowledgement patterns. Use it when you need fan-out (one event triggers multiple independent consumers) or when your infrastructure already runs an AMQP broker.

---

## Job Definition Pattern

Every job is defined with four required pieces and one optional configuration block.

### Naming Convention

Job names use **kebab-case** and follow the pattern `{verb}-{noun}`:

- `send-welcome-email`
- `process-invoice`
- `generate-thumbnail`
- `cleanup-expired-tokens`
- `sync-stripe-subscription`

### Payload Schema

Every job payload is validated with Zod at enqueue time. This catches bad data before it reaches the queue.

### Handler Function

The handler receives the validated payload, performs the work, and either completes or throws. If it throws, the retry machinery kicks in.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `priority` | number | 0 | Higher = processed first |
| `delay` | number (ms) | 0 | Wait before making the job available |
| `attempts` | number | 5 | Maximum retry attempts |
| `backoff` | object | exponential, 1000ms | Backoff strategy and base delay |
| `timeout` | number (ms) | 30000 | Kill the job if it runs longer than this |

### Canonical Job Definition

```typescript
// src/jobs/definitions/send-welcome-email.ts
import { z } from "zod";
import { defineJob } from "@/lib/queue/define-job";

export const sendWelcomeEmailJob = defineJob({
  name: "send-welcome-email",
  schema: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
  }),
  options: {
    priority: 5,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    timeout: 15_000,
  },
  async handler({ data, logger }) {
    const { userId, email, firstName } = data;

    logger.info({ userId }, "Sending welcome email");

    await emailService.send({
      to: email,
      template: "welcome",
      variables: { firstName },
    });

    logger.info({ userId }, "Welcome email sent");
  },
});
```

---

## Queue Organization

Create **one queue per concern**. This keeps things isolated so a spike in one area does not starve another.

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `email` | Transactional emails, notifications | 10 |
| `billing` | Invoice generation, subscription sync | 5 |
| `media-processing` | Thumbnails, video transcoding, image resize | 3 |
| `cleanup` | Token expiry, log rotation, temp files | 2 |
| `webhooks` | Outgoing webhook delivery | 10 |
| `analytics` | Event aggregation, rollups | 2 |

### Canonical Queue Configuration

```typescript
// src/lib/queue/queues.ts
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

function createQueue(name: string) {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
  });
}

export const emailQueue = createQueue("email");
export const billingQueue = createQueue("billing");
export const mediaQueue = createQueue("media-processing");
export const cleanupQueue = createQueue("cleanup");
export const webhookQueue = createQueue("webhooks");
export const analyticsQueue = createQueue("analytics");
```

---

## Priority System

Jobs within a single queue are ordered by priority. Higher numbers are processed first.

| Level | Value | Use Case |
|-------|-------|----------|
| Critical | 10 | Password reset emails, security alerts |
| High | 5 | Welcome emails, order confirmations |
| Normal | 0 | Digest emails, analytics events |
| Low | -5 | Cleanup tasks, non-urgent syncs |

Priority only affects ordering within the same queue. If you need guaranteed ordering across different queues, use a single queue with priority levels instead.

---

## Retry Strategy

### Exponential Backoff

The default backoff formula is `2^attempt * 1000ms`:

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds |

### Max Attempts

The default is **5 attempts**. Override per job type when the work is more or less tolerant of failure:

- Email delivery: 5 attempts (default)
- Payment processing: 3 attempts (fail fast, alert human)
- Media processing: 2 attempts (likely deterministic failure)
- Cleanup jobs: 1 attempt (will run again on next schedule)

### Dead Letter Queue

After exhausting all retry attempts, the job is moved to a **dead letter queue** (DLQ). The DLQ is a separate queue (`{original-queue}-dlq`) that stores failed jobs for investigation.

DLQ jobs are never automatically retried. An operator must inspect them and either:

1. Fix the underlying issue and re-enqueue the job.
2. Mark the job as acknowledged (discard it).

```typescript
// Handling DLQ in worker configuration
worker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
    await dlqQueue.add(`dlq-${job.name}`, {
      originalJob: job.name,
      payload: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    });
    logger.error({ jobId: job.id, error: err.message }, "Job moved to DLQ");
  }
});
```

---

## Scheduled & Cron Jobs

Use BullMQ's repeatable jobs for recurring work.

### Daily Cleanup

```typescript
await cleanupQueue.add(
  "delete-expired-tokens",
  {},
  { repeat: { pattern: "0 3 * * *" } } // 3:00 AM daily
);

await cleanupQueue.add(
  "purge-old-logs",
  { retentionDays: 90 },
  { repeat: { pattern: "0 4 * * *" } } // 4:00 AM daily
);
```

### Billing Cycle

```typescript
await billingQueue.add(
  "check-trial-expirations",
  {},
  { repeat: { pattern: "0 9 * * *" } } // 9:00 AM daily
);

await billingQueue.add(
  "send-monthly-invoices",
  {},
  { repeat: { pattern: "0 8 1 * *" } } // 8:00 AM, 1st of month
);
```

### Analytics Aggregation

```typescript
await analyticsQueue.add(
  "daily-rollup",
  {},
  { repeat: { pattern: "0 2 * * *" } } // 2:00 AM daily
);

await analyticsQueue.add(
  "weekly-rollup",
  {},
  { repeat: { pattern: "0 5 * * 1" } } // 5:00 AM every Monday
);
```

---

## Idempotency

Use the **job ID as an idempotency key**. Before executing, check whether the job has already been processed.

```typescript
async handler({ data, job, logger }) {
  const idempotencyKey = `job:processed:${job.id}`;
  const alreadyProcessed = await redis.get(idempotencyKey);

  if (alreadyProcessed) {
    logger.info({ jobId: job.id }, "Job already processed, skipping");
    return;
  }

  // ... perform the actual work ...

  // Mark as processed with a TTL matching your data retention
  await redis.set(idempotencyKey, "1", "EX", 7 * 24 * 3600);
}
```

When enqueuing, pass a deterministic job ID to prevent duplicate enqueues:

```typescript
await emailQueue.add("send-welcome-email", payload, {
  jobId: `welcome-email-${userId}`,
});
```

If a job with that ID already exists in the queue, BullMQ will silently ignore the duplicate.

---

## Graceful Shutdown

Workers must shut down cleanly to avoid leaving jobs in a broken state.

1. **Stop accepting new jobs** -- close the worker's connection to the queue.
2. **Finish the current job** -- let the in-progress handler complete.
3. **Timeout after 30 seconds** -- if the current job does not finish within 30s, force-kill it.

```typescript
// src/lib/queue/worker-lifecycle.ts
import { Worker } from "bullmq";

export function setupGracefulShutdown(workers: Worker[]) {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received, draining workers");

    await Promise.all(
      workers.map((worker) =>
        worker.close().catch((err) => {
          logger.error({ error: err.message }, "Error closing worker");
        })
      )
    );

    logger.info("All workers drained, exiting");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Force exit after 30 seconds
  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 30_000);

  forceExit.unref();
}
```

---

## Canonical Worker Setup

```typescript
// src/workers/email-worker.ts
import { Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import { sendWelcomeEmailJob } from "@/jobs/definitions/send-welcome-email";
import { sendInvoiceEmailJob } from "@/jobs/definitions/send-invoice-email";

const jobHandlers: Record<string, (job: Job) => Promise<void>> = {
  [sendWelcomeEmailJob.name]: sendWelcomeEmailJob.handler,
  [sendInvoiceEmailJob.name]: sendInvoiceEmailJob.handler,
};

const emailWorker = new Worker(
  "email",
  async (job) => {
    const handler = jobHandlers[job.name];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.name}`);
    }
    await handler(job);
  },
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60_000, // 100 jobs per minute
    },
  }
);

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, name: job.name }, "Job completed");
});

emailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, error: err.message }, "Job failed");
});

export { emailWorker };
```

---

## Monitoring

Track these metrics for every queue:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `active_count` | Jobs currently being processed | >50 sustained |
| `waiting_count` | Jobs waiting to be picked up | >1000 |
| `completed_count` | Successfully finished (rolling 1h) | - |
| `failed_count` | Failed after all retries (rolling 1h) | >10 |
| `dlq_count` | Jobs in the dead letter queue | >0 |
| `processing_time_p95` | 95th percentile processing time | >30s |
| `failure_rate` | failed / (completed + failed) | >5% |

Expose queue metrics via a `/admin/queues` dashboard (Bull Board) or push to your metrics backend (Prometheus, Datadog).

```typescript
// src/lib/queue/metrics.ts
export async function getQueueMetrics(queue: Queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
```

---

## Common Pitfalls

1. **Serialization** -- Job payloads must be JSON-serializable. Do not pass class instances, functions, or circular references.
2. **Large payloads** -- Keep payloads small (IDs, not full objects). Fetch full data inside the handler.
3. **Connection leaks** -- Reuse a single Redis connection config. Do not create new connections per job.
4. **Missing error handling** -- Always wrap handler logic in try/catch. Unhandled rejections crash the worker.
5. **Clock skew** -- Cron jobs use the worker's clock. Ensure all workers use NTP-synced time.
