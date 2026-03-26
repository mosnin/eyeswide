# Phase 6: External Integrations

## Purpose

Connect the backend to third-party services in a way that is resilient, swappable, and testable. By the end of this phase every external dependency is accessed through a well-defined abstraction, configuration is validated at startup, and failures in any single provider cannot cascade into the rest of the system.

---

## Integration Architecture

### Provider Abstraction Layer

Every external service MUST be accessed through an interface. The business logic layer never imports a concrete provider -- it depends only on the abstraction.

```
src/
  integrations/
    payments/
      payment-provider.interface.ts   # defines createCheckout, verifyWebhook, ...
      stripe.provider.ts              # implements PaymentProvider
      lemonsqueezy.provider.ts        # implements PaymentProvider
      index.ts                        # re-exports active provider based on config
    email/
      email-provider.interface.ts
      resend.provider.ts
      sendgrid.provider.ts
      index.ts
    storage/
      storage-provider.interface.ts
      s3.provider.ts
      supabase-storage.provider.ts
      r2.provider.ts
      index.ts
```

Key rules:

- The interface file is the contract. It defines input types, output types, and error types.
- Each implementation file maps the interface to the vendor SDK.
- The barrel `index.ts` reads configuration and returns the correct implementation. Business logic imports from the barrel and never from a concrete provider.
- Swapping providers is a config change, not a code change.

### Configuration Pattern

All provider credentials and settings come from environment variables, validated at startup with a schema validator (Zod, Joi, or equivalent).

```ts
// integrations/payments/config.ts
const PaymentConfigSchema = z.object({
  PAYMENT_PROVIDER: z.enum(["stripe", "lemonsqueezy"]),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
});
```

Startup validation:

- Parse all integration configs before the server starts listening.
- If a required variable for the selected provider is missing, fail hard with a descriptive error.
- Never log secret values -- log only that validation passed or which key is missing.

### Error Handling

External calls fail. Plan for it.

**Retry with exponential backoff:**

- First retry after 200ms, second after 400ms, third after 800ms, and so on.
- Cap retries at a reasonable maximum (typically 3-5).
- Only retry on transient errors (5xx, network timeout, rate limit). Never retry on 4xx client errors (except 429 Too Many Requests).

**Circuit breaker pattern:**

- Track failure rate over a rolling window (e.g., last 60 seconds).
- When failures exceed a threshold (e.g., 50% of requests in the window), open the circuit.
- While open, fail immediately without calling the provider. Return a known error type so the caller can handle it gracefully (queue for retry, show user a message, etc.).
- After a cooldown period, allow a single probe request. If it succeeds, close the circuit.

Implementation options:

- Use a library like `opossum` for Node.js circuit breakers.
- Or build a lightweight version: a counter, a timestamp, and a state enum (`CLOSED`, `OPEN`, `HALF_OPEN`).

### Timeout Configuration

Every outbound HTTP call MUST have an explicit timeout.

- Define per-provider defaults in the provider config (e.g., Stripe: 30s, Resend: 10s, S3: 60s).
- Define a global fallback timeout (e.g., 15s) for any call that does not specify one.
- Timeouts should be configurable via environment variables so they can be tuned in production without redeployment.

```ts
const PROVIDER_TIMEOUTS = {
  stripe: env.STRIPE_TIMEOUT_MS ?? 30_000,
  resend: env.RESEND_TIMEOUT_MS ?? 10_000,
  s3: env.S3_TIMEOUT_MS ?? 60_000,
  default: env.DEFAULT_INTEGRATION_TIMEOUT_MS ?? 15_000,
};
```

---

## Common Integration Patterns

### Payment Providers (Stripe, Lemon Squeezy)

**Checkout flow:**

1. Client requests a checkout session from the backend.
2. Backend calls the payment provider to create a checkout session, passing product/price IDs, success/cancel URLs, and customer metadata.
3. Provider returns a checkout URL. Backend sends it to the client.
4. Client redirects the user to the provider-hosted checkout page.
5. After payment, the provider redirects the user to the success URL and fires a webhook.

**Webhook handling for payments:**

- Verify the webhook signature before processing (see Webhook Handling section below).
- Map provider-specific event types to internal domain events (e.g., `checkout.session.completed` becomes `payment.completed`).
- Update subscription status, grant access, and send confirmation emails as side effects.

**Subscription lifecycle:**

- `subscription.created` -- provision access, store subscription ID and plan details.
- `subscription.updated` -- handle plan changes (upgrade/downgrade), update stored plan.
- `subscription.deleted` / `subscription.canceled` -- schedule access revocation, send retention email.
- `invoice.payment_failed` -- notify user, start dunning flow, mark subscription as past due.
- `invoice.paid` -- clear any past-due flags, extend access.

Store the provider subscription ID alongside the internal user/org record. Always use the webhook as the source of truth for subscription state -- never trust the client.

### Email Providers (Resend, SendGrid)

**Transactional emails:**

- Define email types as an enum: `WELCOME`, `PASSWORD_RESET`, `INVOICE`, `TEAM_INVITE`, etc.
- Each email type maps to a template ID (provider-hosted) or a local template (React Email, MJML, etc.).
- The email service accepts a type, recipient, and a data payload. It resolves the template and calls the provider.

**Template management:**

- Prefer local templates (checked into the repo) over provider-hosted templates for version control and review.
- Use a rendering step that takes a template + data and produces HTML and plain-text versions.
- Test templates with snapshot tests to catch regressions.

**Delivery tracking:**

- Store the provider message ID when an email is sent.
- Optionally receive delivery/bounce/complaint webhooks from the provider.
- Track delivery status per message for debugging and compliance.

**Rate limiting:**

- Respect provider rate limits. Queue emails if you approach the limit rather than failing.
- For bulk sends (e.g., announcements), use the queue system (Phase 7) to throttle sends.

### File Storage (S3, Supabase Storage, Cloudflare R2)

**Upload patterns:**

- **Direct upload (preferred for large files):** Backend generates a pre-signed upload URL. Client uploads directly to the storage provider. Backend receives a callback or polls for completion.
- **Proxy upload (for small files or when processing is needed):** Client uploads to the backend. Backend streams the file to the storage provider. Use multipart upload for files over 5MB.

**Signed URLs for access:**

- Never expose raw storage URLs. Generate short-lived signed URLs (e.g., 15 minutes) for read access.
- Cache signed URLs for their validity period minus a buffer (e.g., cache for 10 minutes if the URL is valid for 15).

**File organization:**

- Use a consistent key structure: `{tenant}/{entity-type}/{entity-id}/{filename}`.
- Store file metadata (size, MIME type, original name, storage key) in the database.
- Never rely solely on the storage provider for file metadata.

**Cleanup:**

- When a database record referencing a file is deleted, queue a cleanup job to delete the file from storage.
- Run a periodic reconciliation job to find orphaned files (files in storage with no database reference) and delete them.
- Keep deleted files in a "trash" prefix for a grace period (e.g., 30 days) before permanent deletion.

### Auth Providers (OAuth: Google, GitHub, Discord)

**OAuth flow:**

1. Client clicks "Sign in with Google." Backend generates an authorization URL with the provider, including scopes, state parameter (CSRF protection), and redirect URI.
2. User authenticates with the provider and grants access.
3. Provider redirects to the backend callback URL with an authorization code.
4. Backend exchanges the code for access and refresh tokens.
5. Backend fetches the user profile from the provider.
6. Backend creates or updates the local user record, linking the provider profile.
7. Backend issues a session token or JWT to the client.

**Token refresh:**

- Store refresh tokens securely (encrypted at rest).
- When the access token expires, use the refresh token to obtain a new one.
- If the refresh token is also expired or revoked, force the user to re-authenticate.

**Profile sync:**

- On each login, fetch the latest profile from the provider and update stored fields (name, avatar, email).
- Handle email changes carefully -- if the provider email changes, decide whether to update the primary email or require confirmation.

**Account linking:**

- Allow users to link multiple OAuth providers to a single account.
- When a new OAuth login matches an existing user by email, prompt the user to link accounts rather than creating a duplicate.

### Analytics (Segment, Mixpanel, PostHog)

**Event tracking:**

- Define a typed event catalog. Every trackable event has a name and a typed properties schema.
- Centralize all tracking calls through a single analytics service. Business logic calls `analytics.track("subscription.upgraded", { plan, userId })`, never the provider SDK directly.
- This makes it trivial to swap analytics providers or add multiple destinations.

**User identification:**

- Call `analytics.identify(userId, traits)` when a user signs up or updates their profile.
- Use a consistent user ID (your internal ID, not the provider's).
- Pass relevant traits: plan, role, signup date, company.

**Server-side vs. client-side:**

- Backend tracks authoritative events (payment completed, subscription changed, API key created).
- Frontend tracks interaction events (button clicked, page viewed, form abandoned).
- Use the same event naming conventions across both.

**Privacy and compliance:**

- Respect user opt-out preferences. Check before sending events.
- Anonymize or exclude PII from event properties unless explicitly needed.
- Document what data is sent to each analytics provider.

---

## Webhook Handling

### Signature Verification

Never process a webhook without verifying its signature. Unverified webhooks are an attack vector.

**HMAC verification (Stripe, Resend, most providers):**

1. Extract the signature from the request header (e.g., `Stripe-Signature`).
2. Compute an HMAC of the raw request body using the webhook secret.
3. Compare the computed HMAC with the provided signature using a timing-safe comparison.
4. Reject the request if the signature does not match.

**Asymmetric verification (some providers):**

1. Fetch the provider's public key (cache it, refresh periodically).
2. Verify the request signature against the raw body using the public key.

Critical: Always verify against the raw request body, not the parsed JSON. Parsing and re-serializing can change whitespace or key order, breaking the signature.

### Idempotency

Webhooks can and will be delivered more than once. Processing the same event twice must not cause duplicate side effects.

- Store processed event IDs in a database table or cache (e.g., Redis with TTL).
- Before processing, check if the event ID has already been handled.
- If it has, return 200 immediately without processing.
- Use a unique constraint on the event ID column to prevent race conditions in concurrent deliveries.

```ts
async function handleWebhook(event: ProviderEvent) {
  const alreadyProcessed = await db.webhookEvent.findUnique({
    where: { providerEventId: event.id },
  });

  if (alreadyProcessed) {
    return { status: "duplicate", eventId: event.id };
  }

  await db.webhookEvent.create({
    data: { providerEventId: event.id, type: event.type, processedAt: new Date() },
  });

  // Process the event...
}
```

### Retry Handling

Providers retry webhooks when they do not receive a 2xx response. Optimize for this.

- Respond with 200 as quickly as possible. Do not do heavy processing in the request handler.
- Acknowledge receipt, then enqueue the actual processing as a background job (see Phase 7).
- If processing fails, the job retry mechanism handles it -- not the webhook retry.
- Set a reasonable webhook processing timeout. If the provider does not receive a response within their timeout window (usually 5-30 seconds), they will retry.

### Event Ordering

Webhooks can arrive out of order. A `subscription.updated` event might arrive before `subscription.created`.

- Use the event timestamp (provided by most providers) to detect stale events.
- Store the last-processed event timestamp per entity. If an incoming event is older, skip it or merge carefully.
- Design handlers to be order-independent where possible. For example, an "updated" handler should upsert rather than assuming the record exists.
- For critical ordering requirements, use a short delay (e.g., 5 seconds) before processing to allow earlier events to arrive first.

---

## Deliverables

By the end of Phase 6, the following must exist:

- [ ] Provider abstraction interfaces for each integration category (payments, email, storage, auth, analytics).
- [ ] At least one concrete implementation per interface, using the project's chosen providers.
- [ ] Configuration validation that runs at startup and fails fast on missing or invalid values.
- [ ] Retry and circuit breaker wrappers applied to all outbound provider calls.
- [ ] Webhook endpoint(s) with signature verification, idempotency checks, and async processing.
- [ ] Integration tests that exercise each provider using test/sandbox credentials.
- [ ] Documentation of all environment variables required for each integration.

---

## Validation Gate

Phase 6 is complete when:

1. All integrations work end-to-end with test/sandbox credentials (Stripe test mode, Resend sandbox, S3 local or test bucket, OAuth with test app credentials).
2. Webhook handlers correctly verify signatures and reject invalid payloads.
3. Duplicate webhook deliveries are detected and skipped without side effects.
4. Circuit breakers trip when a provider is unavailable and recover when it comes back.
5. Swapping a provider implementation (e.g., Stripe to Lemon Squeezy) requires only a config change, not business logic changes.
6. All integration tests pass in CI without requiring live provider credentials (use mocks or sandbox environments).
