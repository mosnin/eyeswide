# Third-Party Integration Specification

| Field            | Value                          |
|------------------|--------------------------------|
| **Document ID**  | INT-[NUMBER]                   |
| **Author**       | [Name]                         |
| **Created**      | [YYYY-MM-DD]                   |
| **Last Updated** | [YYYY-MM-DD]                   |
| **Status**       | Draft / In Review / Approved   |
| **Reviewers**    | [Names]                        |

---

## 1. Integration Overview

### 1.1 Provider Information

| Field              | Details                        |
|--------------------|--------------------------------|
| **Provider Name**  | [e.g., Stripe, Twilio, AWS]    |
| **Provider URL**   | [https://...]                  |
| **API Version**    | [e.g., v2024-01-01]           |
| **SDK Version**    | [e.g., stripe-node@14.x]      |
| **Documentation**  | [Link to provider API docs]    |
| **Support Contact**| [Email / Slack channel / URL]  |

### 1.2 Purpose & Scope

- **Business Purpose:** [Why this integration exists and the problem it solves]
- **Features Used:** [List the specific provider features/products being consumed]
- **Data Flow Direction:** [ Inbound / Outbound / Bidirectional ]
- **Criticality:** [ Critical / High / Medium / Low ] — impact if the integration is unavailable
- **Estimated Traffic:** [Requests per minute/hour/day in each environment]

### 1.3 Architecture Diagram

```
[Your Service] --(HTTPS/REST)--> [Provider API]
[Provider]     --(Webhook)------> [Your Webhook Endpoint]
```

> Replace with a detailed diagram showing all touchpoints, queues, and intermediaries.

---

## 2. Authentication

### 2.1 Authentication Method

| Field                  | Details                                      |
|------------------------|----------------------------------------------|
| **Method**             | [ API Key / OAuth 2.0 / JWT / mTLS / HMAC ] |
| **Key Type**           | [ Publishable / Secret / Both ]              |
| **Token Lifetime**     | [e.g., 3600 seconds / never expires]         |
| **Refresh Mechanism**  | [e.g., refresh token grant / manual rotation]|

### 2.2 Credential Storage

- **Storage Location:** [e.g., AWS Secrets Manager, HashiCorp Vault, environment variables]
- **Access Pattern:** [How the application retrieves credentials at runtime]
- **Rotation Schedule:** [e.g., every 90 days, on-demand]
- **Rotation Procedure:**
  1. [Step-by-step process for rotating credentials]
  2. [How to verify the new credentials work before decommissioning old ones]
  3. [Rollback procedure if rotation fails]

### 2.3 OAuth Flow Details (if applicable)

- **Grant Type:** [Authorization Code / Client Credentials / etc.]
- **Scopes Required:** [List each scope and why it is needed]
- **Authorization URL:** [URL]
- **Token URL:** [URL]
- **Redirect URI:** [URL]
- **Token Storage:** [Where access/refresh tokens are persisted]

---

## 3. Endpoints Used

### 3.1 Endpoint Inventory

For each endpoint consumed, document the following:

#### 3.1.1 [Endpoint Name — e.g., Create Payment Intent]

| Field              | Details                                       |
|--------------------|-----------------------------------------------|
| **Method**         | [GET / POST / PUT / PATCH / DELETE]           |
| **Path**           | [e.g., /v1/payment_intents]                   |
| **Content-Type**   | [application/json / application/x-www-form-urlencoded] |
| **Idempotency**    | [Supported — via Idempotency-Key header / Not supported] |
| **Rate Limit**     | [e.g., 100 req/sec per key]                  |
| **Timeout**        | [Client-side timeout setting, e.g., 30s]     |

**Request Headers:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}
```

**Request Body:**
```json
{
  "amount": 2000,
  "currency": "usd",
  "payment_method": "pm_xxx",
  "confirm": true
}
```

**Success Response (200/201):**
```json
{
  "id": "pi_xxx",
  "status": "succeeded",
  "amount": 2000,
  "currency": "usd"
}
```

**Error Response (4xx/5xx):**
```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined."
  }
}
```

> Copy this block for each endpoint. Add as many subsections (3.1.2, 3.1.3, ...) as needed.

### 3.2 Rate Limit Summary

| Endpoint               | Limit              | Window   | Handling Strategy          |
|------------------------|--------------------|---------:|----------------------------|
| [e.g., /v1/charges]   | [100 req/sec]      | [1 sec]  | [Exponential backoff]      |
| [e.g., /v1/customers] | [50 req/sec]       | [1 sec]  | [Queue + rate limiter]     |

---

## 4. Data Mapping

### 4.1 Field Mapping Table

| External Field (Provider) | Internal Field (Our System) | Transform            | Notes                        |
|---------------------------|-----------------------------|----------------------|------------------------------|
| `id`                      | `external_provider_id`      | Direct copy          | Stored as string             |
| `amount`                  | `amount_cents`              | Direct copy          | Provider uses cents           |
| `created`                 | `provider_created_at`       | Unix timestamp to ISO| Convert epoch to DateTime    |
| `status`                  | `payment_status`            | Enum mapping         | See status mapping table     |
| `customer.email`          | `user.email`                | Nested extraction    | Used for reconciliation      |

### 4.2 Enum / Status Mapping

| Provider Status   | Internal Status     | Description                          |
|-------------------|---------------------|--------------------------------------|
| `succeeded`       | `COMPLETED`         | Payment successfully captured        |
| `pending`         | `PROCESSING`        | Awaiting confirmation                |
| `failed`          | `FAILED`            | Payment attempt failed               |
| `canceled`        | `CANCELLED`         | Payment was cancelled                |

### 4.3 Data Validation Rules

- [ ] All external IDs are validated for format before storage
- [ ] Monetary amounts are validated for currency consistency
- [ ] Timestamps are normalized to UTC
- [ ] Required fields are checked before processing
- [ ] String fields are sanitized and length-checked

---

## 5. Webhook Handling

### 5.1 Webhook Configuration

| Field                   | Details                                         |
|-------------------------|-------------------------------------------------|
| **Endpoint URL**        | [e.g., https://api.example.com/webhooks/stripe] |
| **HTTP Method**         | POST                                            |
| **Content-Type**        | application/json                                |
| **Signing Secret**      | [Stored in secrets manager — reference key]     |
| **IP Allowlist**        | [Provider IPs if applicable]                    |
| **TLS Version**         | [Minimum TLS 1.2]                               |

### 5.2 Events Subscribed

| Event Type                    | Handler                        | Priority | Description                  |
|-------------------------------|--------------------------------|----------|------------------------------|
| `payment_intent.succeeded`    | `handlePaymentSuccess()`       | Critical | Fulfillment trigger          |
| `payment_intent.failed`       | `handlePaymentFailure()`       | Critical | Notify user of failure       |
| `customer.updated`            | `handleCustomerUpdate()`       | Medium   | Sync customer profile        |
| `invoice.payment_failed`      | `handleInvoiceFailure()`       | High     | Dunning flow trigger         |

### 5.3 Verification

- **Signature Verification Method:** [e.g., HMAC-SHA256 of raw body with signing secret]
- **Timestamp Validation:** [Reject events older than N minutes to prevent replay attacks]
- **Implementation Reference:**
  ```
  // Pseudocode
  const signature = computeHMAC(signingSecret, rawBody);
  if (signature !== headerSignature) reject(401);
  if (eventTimestamp < now() - toleranceWindow) reject(400);
  ```

### 5.4 Idempotency

- **Idempotency Key:** [e.g., event ID from provider — `evt_xxx`]
- **Deduplication Store:** [e.g., Redis set with TTL / database unique constraint]
- **TTL for Dedup Records:** [e.g., 72 hours]
- **Handling Duplicates:** [Log and skip / return 200 without processing]

### 5.5 Processing Architecture

- **Processing Mode:** [ Synchronous / Asynchronous via queue ]
- **Queue System:** [e.g., SQS, RabbitMQ, Redis Streams]
- **Max Retries by Provider:** [e.g., provider retries 3 times over 72 hours]
- **Response Time Requirement:** [e.g., respond 200 within 5 seconds]

---

## 6. Error Handling

### 6.1 Retry Strategy

| Error Category       | Retry | Max Attempts | Backoff Strategy            | Initial Delay |
|----------------------|-------|--------------|-----------------------------|---------------|
| Network timeout      | Yes   | 3            | Exponential with jitter     | 1s            |
| 429 Too Many Requests| Yes   | 5            | Respect Retry-After header  | Per header    |
| 500 Server Error     | Yes   | 3            | Exponential with jitter     | 2s            |
| 502/503/504 Gateway  | Yes   | 3            | Exponential with jitter     | 2s            |
| 400 Bad Request      | No    | --           | --                          | --            |
| 401 Unauthorized     | No    | --           | Alert + credential check    | --            |
| 404 Not Found        | No    | --           | --                          | --            |

### 6.2 Circuit Breaker Configuration

| Parameter              | Value                                            |
|------------------------|--------------------------------------------------|
| **Failure Threshold**  | [e.g., 5 failures in 60 seconds]                |
| **Open State Duration**| [e.g., 30 seconds]                              |
| **Half-Open Probes**   | [e.g., 1 request to test recovery]              |
| **Reset Condition**    | [e.g., 3 consecutive successes in half-open]    |
| **Library/Tool**       | [e.g., opossum, Polly, custom implementation]   |

### 6.3 Fallback Behavior

| Scenario                        | Fallback Action                                    |
|---------------------------------|----------------------------------------------------|
| Provider completely unavailable | [e.g., Queue for retry / serve cached data]        |
| Partial degradation             | [e.g., Disable non-critical features]              |
| Data inconsistency detected     | [e.g., Flag for manual review / reconciliation job]|
| Rate limit exceeded             | [e.g., Backpressure to callers / shed load]        |

### 6.4 Error Logging Format

```json
{
  "level": "error",
  "integration": "[provider_name]",
  "endpoint": "[method] [path]",
  "status_code": 500,
  "request_id": "[provider_request_id]",
  "internal_trace_id": "[our_trace_id]",
  "error_type": "[provider_error_code]",
  "message": "[error_message]",
  "retry_attempt": 2,
  "timestamp": "2026-01-15T10:30:00Z"
}
```

---

## 7. Testing Strategy

### 7.1 Sandbox / Test Environment

| Field                      | Details                                   |
|----------------------------|-------------------------------------------|
| **Sandbox URL**            | [e.g., https://api.sandbox.provider.com]  |
| **Test API Keys**          | [Stored in: secrets manager key reference]|
| **Test Account**           | [How to access the sandbox dashboard]     |
| **Sandbox Limitations**    | [Features not available in sandbox]       |
| **Data Reset Policy**      | [How often sandbox data is purged]        |

### 7.2 Mock Strategy

- **Mock Library:** [e.g., nock, MSW, WireMock, VCR]
- **Fixture Location:** [e.g., `tests/fixtures/integrations/provider_name/`]
- **Recording Mode:** [Manual / Auto-recorded from sandbox]
- **Mock Server for CI:** [e.g., Docker container with WireMock stubs]

### 7.3 Test Cases

| Test Case                           | Type        | Description                                  |
|-------------------------------------|-------------|----------------------------------------------|
| Successful API call                 | Unit        | Happy path with mocked response              |
| Network timeout                     | Unit        | Verify retry logic triggers                  |
| Rate limit response                 | Unit        | Verify backoff / queuing behavior            |
| Invalid credentials                 | Unit        | Verify alerting and graceful failure         |
| Webhook signature valid             | Unit        | Verify acceptance of correctly signed events |
| Webhook signature invalid           | Unit        | Verify rejection of tampered events          |
| Duplicate webhook event             | Unit        | Verify idempotency deduplication             |
| End-to-end payment flow             | Integration | Full flow against sandbox                    |
| Circuit breaker activation          | Integration | Simulate repeated failures                   |
| Data mapping correctness            | Unit        | Verify all fields map correctly              |

### 7.4 Contract Testing

- **Contract Tool:** [e.g., Pact, Dredd, Schemathesis]
- **Provider Contract Location:** [Link to OpenAPI spec / Pact broker]
- **Validation Frequency:** [e.g., nightly CI run / pre-deploy]

---

## 8. Monitoring

### 8.1 Health Checks

| Check                           | Method                               | Interval | Timeout |
|---------------------------------|--------------------------------------|----------|---------|
| API reachability                | [e.g., GET /v1/health or ping]       | 60s      | 5s      |
| Authentication validity         | [e.g., lightweight authenticated GET]| 300s     | 10s     |
| Webhook endpoint reachability   | [Internal health endpoint]           | 30s      | 5s      |

### 8.2 Key Metrics

| Metric                            | Source       | Dashboard             |
|-----------------------------------|--------------|-----------------------|
| API request latency (p50/p95/p99) | APM          | [Link to dashboard]   |
| API error rate (4xx / 5xx)        | APM / Logs   | [Link to dashboard]   |
| Webhook processing latency        | APM          | [Link to dashboard]   |
| Webhook failure rate              | Logs         | [Link to dashboard]   |
| Circuit breaker state changes     | App metrics  | [Link to dashboard]   |
| Rate limit proximity              | App metrics  | [Link to dashboard]   |
| Queue depth (if async)            | Queue metrics| [Link to dashboard]   |

### 8.3 Alert Thresholds

| Alert                              | Condition                          | Severity | Notification Channel |
|------------------------------------|------------------------------------|----------|----------------------|
| High API error rate                | > 5% 5xx in 5 minutes             | Critical | PagerDuty / Slack    |
| Elevated latency                   | p95 > 5s for 10 minutes           | Warning  | Slack                |
| Circuit breaker opened             | State changed to OPEN              | Critical | PagerDuty / Slack    |
| Webhook processing backlog         | Queue depth > 1000 for 5 minutes  | Warning  | Slack                |
| Authentication failure             | Any 401 response                  | Critical | PagerDuty            |
| Rate limit approaching             | > 80% of limit utilized           | Warning  | Slack                |

---

## 9. Security

### 9.1 Secrets Rotation

| Secret                  | Rotation Schedule | Rotation Method                       | Last Rotated |
|-------------------------|-------------------|---------------------------------------|--------------|
| API Secret Key          | Every 90 days     | [Manual / Automated via Vault]        | [Date]       |
| Webhook Signing Secret  | Every 90 days     | [Manual / Automated]                  | [Date]       |
| OAuth Client Secret     | Every 180 days    | [Manual / Automated]                  | [Date]       |

### 9.2 Data Encryption

- **In Transit:** TLS 1.2+ enforced for all API communication
- **At Rest:** [Encryption method for stored provider data — e.g., AES-256 via database-level encryption]
- **Sensitive Fields:** [List fields that receive additional encryption — e.g., tokens, payment method details]
- **Key Management:** [e.g., AWS KMS, GCP Cloud KMS, self-managed HSM]

### 9.3 PII Handling

| Data Element           | Classification | Storage Policy                        | Retention Period |
|------------------------|----------------|---------------------------------------|------------------|
| Customer email         | PII            | Encrypted at rest                     | Account lifetime |
| Payment card last 4    | PCI-adjacent   | Stored, not full card number          | Transaction + 7y |
| Full card number       | PCI            | Never stored — tokenized by provider  | N/A              |
| Customer name          | PII            | Encrypted at rest                     | Account lifetime |
| IP address             | PII            | Logged, auto-purged                   | 90 days          |

### 9.4 Access Control

- **Who can access provider dashboard:** [Roles / named individuals]
- **Who can rotate credentials:** [Roles / named individuals]
- **Who can modify webhook configuration:** [Roles / named individuals]
- **Audit log for credential access:** [Location / tool]

### 9.5 Compliance Notes

- [ ] Provider is SOC 2 Type II certified
- [ ] Data Processing Agreement (DPA) is signed
- [ ] Provider appears in our vendor risk assessment registry
- [ ] Data residency requirements are met (data stays in [region])
- [ ] Subprocessor list reviewed and accepted

---

## Appendix

### A. Changelog

| Date       | Author  | Description                              |
|------------|---------|------------------------------------------|
| [Date]     | [Name]  | Initial draft                            |

### B. Related Documents

- [Link to system architecture document]
- [Link to API design document]
- [Link to runbook for this integration]

### C. Glossary

| Term       | Definition                                           |
|------------|------------------------------------------------------|
| [Term]     | [Definition]                                         |
