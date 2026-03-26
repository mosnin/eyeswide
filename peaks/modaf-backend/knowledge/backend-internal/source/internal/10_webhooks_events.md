# Webhooks & Event System

> **TL;DR:** Handle incoming webhooks by verifying signatures and processing async via the job queue. Send outgoing webhooks with signed payloads, exponential retry, and delivery logging. Use an internal event bus for decoupled cross-module communication.

---

**Status:** Stable
**Last updated:** 2026-03-26
**Applies to:** modaf-backend >=1.0
**Tags:** webhooks, events, event-bus, incoming-webhooks, outgoing-webhooks, domain-events

---

## Incoming Webhooks (Receiving from External Services)

External services (Stripe, GitHub, Lemon Squeezy, Resend) send HTTP POST requests to your application to notify you of events.

### Endpoint Pattern

```
POST /api/webhooks/{provider}
```

Examples:

- `POST /api/webhooks/stripe`
- `POST /api/webhooks/github`
- `POST /api/webhooks/lemon-squeezy`
- `POST /api/webhooks/resend`

Each provider gets its own endpoint. Never share a single endpoint across providers -- verification logic and payload shapes differ.

### Signature Verification

Always verify the webhook signature before processing. An unverified webhook is an open door for attackers.

#### HMAC-SHA256 (Stripe, Lemon Squeezy, most providers)

The provider signs the raw request body with a shared secret. You recompute the signature and compare.

#### Asymmetric Verification (GitHub)

GitHub signs payloads with an HMAC-SHA256 using the webhook secret configured in the GitHub App or repository settings. Some providers use asymmetric keys -- verify using the provider's public key.

### Canonical Webhook Verification Code

```typescript
// src/lib/webhooks/verify.ts
import { createHmac, timingSafeEqual } from "crypto";

export function verifyHmacSignature(params: {
  payload: string | Buffer;
  signature: string;
  secret: string;
  algorithm?: string;
  prefix?: string;
}): boolean {
  const {
    payload,
    signature,
    secret,
    algorithm = "sha256",
    prefix = "",
  } = params;

  const expected = createHmac(algorithm, secret)
    .update(payload)
    .digest("hex");

  const expectedWithPrefix = prefix ? `${prefix}${expected}` : expected;

  if (signature.length !== expectedWithPrefix.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedWithPrefix)
  );
}

// Provider-specific verification
export function verifyStripeWebhook(payload: Buffer, sigHeader: string, secret: string) {
  // Stripe uses its own library for verification
  const event = stripe.webhooks.constructEvent(payload, sigHeader, secret);
  return event;
}

export function verifyGitHubWebhook(payload: Buffer, signature: string, secret: string) {
  return verifyHmacSignature({
    payload,
    signature,
    secret,
    algorithm: "sha256",
    prefix: "sha256=",
  });
}
```

### Response Strategy

**Return 200 immediately.** Do not process the webhook synchronously. Acknowledge receipt, then queue the event for async processing.

```typescript
// src/routes/webhooks/stripe.ts
export async function handleStripeWebhook(req: Request, res: Response) {
  const rawBody = req.body as Buffer;
  const signature = req.headers["stripe-signature"] as string;

  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ error: err }, "Invalid Stripe webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  // 2. Respond immediately
  res.status(200).json({ received: true });

  // 3. Queue for async processing
  await webhookQueue.add("process-stripe-event", {
    eventId: event.id,
    type: event.type,
    data: event.data,
    createdAt: event.created,
  });
}
```

### Idempotency

External services may deliver the same webhook multiple times (network retries, at-least-once delivery). Store the event ID and skip duplicates.

```typescript
async function processWebhookEvent(eventId: string, handler: () => Promise<void>) {
  // Check if already processed
  const existing = await db.webhookEvents.findByEventId(eventId);
  if (existing?.processedAt) {
    logger.info({ eventId }, "Webhook event already processed, skipping");
    return;
  }

  // Record the event
  await db.webhookEvents.upsert({
    eventId,
    receivedAt: new Date(),
  });

  // Process
  await handler();

  // Mark as processed
  await db.webhookEvents.update(eventId, {
    processedAt: new Date(),
  });
}
```

### Event Ordering

Webhooks can arrive out of order. A `subscription.updated` event might arrive before `subscription.created`. Strategies:

1. **Check timestamps** -- ignore events older than the last processed event for the same resource.
2. **Use resource state** -- fetch the current state from the provider's API instead of relying on the webhook payload.
3. **Sequence by resource ID** -- within a queue, ensure events for the same resource are processed sequentially (use BullMQ job groups or a FIFO queue keyed by resource ID).

### Error Handling

- Log all failures with full context (event type, payload, error).
- Alert on repeated failures for the same event type (3+ failures in an hour).
- Provide a manual retry UI in the admin dashboard for stuck events.
- Never throw unhandled exceptions in webhook handlers -- always catch and log.

### Security

- **Verify source IP** when the provider publishes a list of webhook IPs (Stripe, GitHub). Use as an additional layer, not the only verification.
- **Validate payload structure** -- parse with Zod before processing. Malformed payloads should be logged and discarded.
- **Use raw body** -- signature verification requires the raw request body, not parsed JSON. Configure your framework to preserve the raw body for webhook routes.

---

## Outgoing Webhooks (Sending to Customers)

If your product exposes an API, customers will want webhooks to react to events in real time.

### Event Types

Use the `resource.action` naming convention (past tense for the action):

```
user.created
user.updated
user.deleted
order.completed
order.refunded
subscription.activated
subscription.cancelled
invoice.paid
invoice.overdue
```

### Payload Format

Every outgoing webhook payload follows a consistent envelope:

```json
{
  "id": "evt_a1b2c3d4e5",
  "type": "order.completed",
  "api_version": "2026-03-01",
  "created_at": "2026-03-26T14:30:00Z",
  "data": {
    "id": "ord_xyz789",
    "status": "completed",
    "total": 9900,
    "currency": "usd",
    "customer_id": "cus_abc123"
  }
}
```

Fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event ID (idempotency key for the receiver) |
| `type` | string | Event type in `resource.action` format |
| `api_version` | string | API version that generated this event |
| `created_at` | ISO 8601 | Timestamp of event creation |
| `data` | object | The resource data at the time of the event |

### Delivery

Send via HTTP POST with a signature header. The receiving server must respond with a 2xx status code within 30 seconds.

### Signature

Sign every outgoing webhook with HMAC-SHA256 using the customer's unique webhook secret:

```typescript
function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
```

Include the signature in the request headers:

```
X-Webhook-Signature: sha256=a1b2c3d4...
X-Webhook-Timestamp: 1711461000
X-Webhook-Id: evt_a1b2c3d4e5
```

Include the timestamp in the signed content to prevent replay attacks:

```typescript
const timestamp = Math.floor(Date.now() / 1000);
const signedContent = `${timestamp}.${JSON.stringify(payload)}`;
const signature = signWebhookPayload(signedContent, customerSecret);
```

### Subscription Management

Customers register webhook endpoints through your API:

```
POST /api/v1/webhook-endpoints
{
  "url": "https://customer.example.com/webhooks",
  "events": ["order.completed", "order.refunded"],
  "secret": "whsec_..." // auto-generated, returned once
}
```

Store:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Owning organization |
| `url` | text | Delivery URL |
| `events` | text[] | Subscribed event types |
| `secret` | text | HMAC signing secret (encrypted at rest) |
| `active` | boolean | Whether the endpoint is enabled |
| `created_at` | timestamptz | When the endpoint was registered |
| `disabled_at` | timestamptz | When it was auto-disabled (null if active) |

### Retry Policy

If delivery fails (non-2xx response or timeout), retry with exponential backoff:

| Attempt | Delay After |
|---------|-------------|
| 1 | 1 second |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After **5 consecutive failures**, disable the endpoint and notify the customer via email. They can re-enable it from the dashboard after fixing their server.

### Canonical Outgoing Webhook Delivery Code

```typescript
// src/lib/webhooks/deliver.ts
import { createHmac } from "crypto";
import { webhookQueue } from "@/lib/queue/queues";

export interface WebhookDeliveryParams {
  endpointId: string;
  url: string;
  secret: string;
  event: {
    id: string;
    type: string;
    data: unknown;
    apiVersion: string;
    createdAt: string;
  };
}

export async function deliverWebhook(params: WebhookDeliveryParams) {
  const { url, secret, event } = params;
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Id": event.id,
      "X-Webhook-Timestamp": String(timestamp),
      "X-Webhook-Signature": `sha256=${signature}`,
      "User-Agent": "ModafBackend-Webhooks/1.0",
    },
    body: payload,
    signal: AbortSignal.timeout(30_000),
  });

  // Log the delivery attempt
  await db.webhookDeliveries.create({
    endpointId: params.endpointId,
    eventId: event.id,
    eventType: event.type,
    url,
    statusCode: response.status,
    success: response.ok,
    responseTimeMs: Date.now() - timestamp * 1000,
    attemptNumber: 1, // incremented by job retry logic
  });

  if (!response.ok) {
    throw new WebhookDeliveryError(
      `Webhook delivery failed: ${response.status} ${response.statusText}`
    );
  }
}

// Enqueue webhook for delivery
export async function enqueueWebhook(
  eventType: string,
  data: unknown
) {
  const event = {
    id: `evt_${generateId()}`,
    type: eventType,
    data,
    apiVersion: env.API_VERSION,
    createdAt: new Date().toISOString(),
  };

  // Find all endpoints subscribed to this event type
  const endpoints = await db.webhookEndpoints.findActive({
    events: eventType,
  });

  // Enqueue a delivery job for each endpoint
  for (const endpoint of endpoints) {
    await webhookQueue.add(
      "deliver-webhook",
      {
        endpointId: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret,
        event,
      },
      {
        attempts: 5,
        backoff: {
          type: "custom",
          delay: 1000,
        },
        jobId: `webhook-${event.id}-${endpoint.id}`,
      }
    );
  }
}
```

### Webhook Logs

Store every delivery attempt for debugging and customer support:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `endpoint_id` | UUID | FK to webhook endpoints |
| `event_id` | text | The event ID |
| `event_type` | text | Event type (for filtering) |
| `url` | text | Delivery URL |
| `status_code` | int | HTTP response code |
| `success` | boolean | Whether delivery succeeded |
| `response_time_ms` | int | Round-trip time |
| `attempt_number` | int | Which retry attempt |
| `created_at` | timestamptz | When the attempt was made |
| `response_body` | text | First 1KB of response (for debugging) |

Expose these logs to customers so they can self-serve debug delivery issues.

---

## Internal Domain Events

For cross-module communication within your application, use an internal event bus. This keeps modules decoupled -- the user module does not need to know about the email module, billing module, or analytics module.

### Event Bus Options

| Option | Scope | Use When |
|--------|-------|----------|
| In-process EventEmitter | Single process | Simple apps, monoliths, development |
| Redis Pub/Sub | Distributed | Multiple server instances, microservices |

### Event Naming

Use **PascalCase past tense** for internal events:

- `UserCreated`
- `UserEmailVerified`
- `OrderCompleted`
- `SubscriptionCancelled`
- `InvoicePaid`
- `FileUploaded`

### Event Payload

```typescript
interface DomainEvent<T = unknown> {
  eventId: string;       // Unique ID for this event instance
  type: string;          // Event name (UserCreated, OrderCompleted)
  data: T;               // Event-specific payload
  timestamp: string;     // ISO 8601
  metadata: {
    correlationId: string; // Trace ID for request tracking
    userId?: string;       // Who triggered the event
    tenantId?: string;     // Which tenant
    source: string;        // Module that emitted the event
  };
}
```

### Canonical Event Emitter Setup

```typescript
// src/lib/events/event-bus.ts
import { EventEmitter } from "events";
import { generateId } from "@/lib/utils";

type EventHandler<T> = (event: DomainEvent<T>) => Promise<void>;

class DomainEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Increase the default listener limit
    this.emitter.setMaxListeners(50);
  }

  emit<T>(type: string, data: T, metadata: Partial<DomainEvent["metadata"]> = {}) {
    const event: DomainEvent<T> = {
      eventId: `evt_${generateId()}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      metadata: {
        correlationId: metadata.correlationId ?? generateId(),
        userId: metadata.userId,
        tenantId: metadata.tenantId,
        source: metadata.source ?? "unknown",
      },
    };

    logger.debug({ eventType: type, eventId: event.eventId }, "Domain event emitted");

    // Emit asynchronously -- do not block the caller
    this.emitter.emit(type, event);
  }

  on<T>(type: string, handler: EventHandler<T>) {
    this.emitter.on(type, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (err) {
        // Error isolation: handler failures do not affect other handlers
        logger.error(
          { eventType: type, eventId: event.eventId, error: err },
          "Domain event handler error"
        );
      }
    });
  }

  off(type: string, handler: EventHandler<unknown>) {
    this.emitter.off(type, handler);
  }
}

export const eventBus = new DomainEventBus();
```

### Handler Registration

Register handlers at startup time. Each handler is typed and isolated.

```typescript
// src/modules/email/events.ts
import { eventBus } from "@/lib/events/event-bus";

export function registerEmailEventHandlers() {
  eventBus.on<{ userId: string; email: string; firstName: string }>(
    "UserCreated",
    async (event) => {
      await emailQueue.add("send-welcome-email", {
        userId: event.data.userId,
        email: event.data.email,
        firstName: event.data.firstName,
      });
    }
  );

  eventBus.on<{ userId: string; email: string }>(
    "UserEmailVerified",
    async (event) => {
      await emailQueue.add("send-verification-confirmed", {
        userId: event.data.userId,
        email: event.data.email,
      });
    }
  );
}

// src/modules/billing/events.ts
export function registerBillingEventHandlers() {
  eventBus.on<{ userId: string; plan: string }>(
    "UserCreated",
    async (event) => {
      await billingService.createFreeTrialSubscription(
        event.data.userId,
        event.data.plan
      );
    }
  );
}

// src/modules/analytics/events.ts
export function registerAnalyticsEventHandlers() {
  eventBus.on<{ userId: string }>(
    "UserCreated",
    async (event) => {
      await analyticsService.trackSignup(event.data.userId);
    }
  );
}
```

### Application Startup

```typescript
// src/app.ts
import { registerEmailEventHandlers } from "@/modules/email/events";
import { registerBillingEventHandlers } from "@/modules/billing/events";
import { registerAnalyticsEventHandlers } from "@/modules/analytics/events";

function bootstrapEventHandlers() {
  registerEmailEventHandlers();
  registerBillingEventHandlers();
  registerAnalyticsEventHandlers();
  logger.info("All domain event handlers registered");
}
```

### Error Isolation

Handler errors must never propagate to the emitter or affect other handlers. The event bus wraps every handler call in a try/catch (shown in the canonical code above). This guarantees:

1. The emitting module is not blocked or crashed by a handler failure.
2. Other handlers for the same event still execute.
3. Errors are logged with full context for debugging.

For critical handlers where you cannot afford to silently swallow errors, enqueue a job instead of running the logic directly. The job system provides its own retry and DLQ mechanisms.

---

## Common Pitfalls

1. **Processing webhooks synchronously** -- Always return 200 immediately and process via the job queue. External services have short timeout windows (typically 5-30 seconds) and will mark your endpoint as unhealthy.
2. **No signature verification** -- Without verification, anyone can send fake events to your webhook endpoint. Always verify, even in staging.
3. **Missing idempotency** -- Webhooks are delivered at-least-once. Without idempotency checks, you will process events multiple times (double charges, duplicate emails).
4. **Ignoring event ordering** -- Events for the same resource can arrive out of order. Use timestamps or fetch current state from the provider API.
5. **Leaking webhook secrets** -- Webhook signing secrets are sensitive. Store them encrypted, rotate them periodically, and never log them.
6. **No delivery logging** -- Without logs, debugging webhook failures is impossible. Store every delivery attempt with status code and response time.
7. **Tight coupling via events** -- The event bus is for decoupling, not for replacing function calls. If module A always needs a response from module B, call it directly instead of emitting an event and hoping.
