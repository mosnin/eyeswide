# Phase 0: Requirements Gathering

## Purpose

Before writing a single line of code, the system must be fully understood from a business
perspective. This phase exists to capture the complete picture of what the backend must do,
who it serves, what it connects to, and what constraints it operates under. Skipping or
rushing this phase is the single most common cause of costly mid-project rewrites.

The goals of this phase are:

1. Understand the business domain and the problem being solved.
2. Identify all core entities, their attributes, and their relationships.
3. Map every external dependency and integration point.
4. Establish scale expectations so the architecture phase can make informed trade-offs.
5. Document non-functional requirements (security, compliance, performance, availability).
6. Produce a set of deliverables that serve as the contract for all subsequent phases.

Nothing leaves this phase without explicit user confirmation.

---

## Step 1: Conduct the Discovery Interview

The discovery interview is a structured conversation with the user (or stakeholder). It is
not a checklist to race through. Each question should be explored until the answer is
unambiguous. Follow-up questions are expected and encouraged.

### 1.1 System Purpose and Users

Ask and fully resolve the following:

- What does this system do in one sentence?
- Who are the primary users? (end-users, admins, internal operators, other services)
- Are there distinct user roles with different permission levels?
- Is there a public-facing component, an internal-only component, or both?
- What is the expected user journey from sign-up to core value delivery?
- Are there any existing systems this replaces or must coexist with?

Record the answers verbatim. Do not paraphrase at this stage -- exact language from the
stakeholder often reveals domain nuance that paraphrasing destroys.

### 1.2 Core Entities and Relationships

Ask and fully resolve the following:

- What are the primary "things" in the system? (e.g., User, Order, Product, Invoice)
- For each entity: what are its key attributes?
- How do entities relate to each other? (one-to-one, one-to-many, many-to-many)
- Are there entities that have a lifecycle or state machine? (e.g., Order: draft -> placed -> fulfilled -> cancelled)
- Are there entities that are immutable once created? (e.g., audit logs, transaction records)
- Are there entities owned by external systems that the backend must reference but not modify?
- Are there soft-delete requirements for any entities?
- Is there a concept of multi-tenancy? If so, how is tenant isolation achieved?

For each entity identified, create a preliminary entity card:

```
Entity: [Name]
Description: [One sentence]
Key Attributes: [List]
Relationships: [List of related entities and cardinality]
Lifecycle States: [If applicable]
Owner: [This system | External system name]
```

### 1.3 Primary Workflows and Use Cases

Ask and fully resolve the following:

- What are the 3-5 most important things a user does in this system?
- For each workflow, walk through the steps: what triggers it, what happens at each step, what is the end state?
- Are there workflows that span multiple entities? (e.g., "placing an order" touches User, Cart, Order, Payment, Inventory)
- Are there time-sensitive workflows? (e.g., payment must complete within 30 seconds)
- Are there workflows triggered by external events rather than user actions? (e.g., webhook from payment provider)
- Are there batch or scheduled workflows? (e.g., nightly report generation, subscription renewal)
- What happens when a workflow fails partway through? Is there a rollback strategy or a compensating action?

For each workflow, document it as a numbered step list:

```
Workflow: [Name]
Trigger: [User action | Scheduled | External event]
Steps:
  1. [Step description]
  2. [Step description]
  ...
End State: [What is true when this workflow completes successfully]
Failure Handling: [What happens on partial failure]
```

### 1.4 External Service Integrations

Ask and fully resolve the following:

- Does the system process payments? If so, which provider(s)? (Stripe, PayPal, Braintree, etc.)
- Does the system send emails or notifications? Which provider? (SendGrid, SES, Postmark, Twilio, etc.)
- Does the system store files or media? Where? (S3, GCS, Cloudflare R2, local filesystem)
- What authentication provider is used? (Built-in, Auth0, Clerk, Firebase Auth, Cognito, etc.)
- Does the system consume any third-party APIs? (Maps, analytics, CRM, ERP, etc.)
- Does the system expose webhooks or consume webhooks from other services?
- Are there any legacy systems that must be integrated via specific protocols? (SOAP, FTP, etc.)
- For each integration: is there a sandbox/test environment available?
- For each integration: what are the rate limits and error handling expectations?

For each integration, create an integration card:

```
Integration: [Service Name]
Purpose: [What it does for this system]
Protocol: [REST API | GraphQL | Webhook | SDK | etc.]
Auth Method: [API key | OAuth | mTLS | etc.]
Sandbox Available: [Yes | No]
Rate Limits: [If known]
Failure Mode: [What happens if this service is down]
```

### 1.5 Scale Expectations

Ask and fully resolve the following:

- How many users are expected at launch? In 6 months? In 2 years?
- What is the expected request volume? (requests per second, peak vs average)
- How much data will the system store? (total volume, growth rate)
- Are there geographic distribution requirements? (single region, multi-region, edge)
- Are there specific latency requirements for critical endpoints?
- Is there a budget constraint that affects infrastructure choices?
- What is the expected ratio of read operations to write operations?
- Are there any known "hot spots" -- specific operations that will dominate traffic?

Document scale expectations in a structured format:

```
Scale Profile:
  Users at Launch: [Number]
  Users at 6 Months: [Number]
  Users at 2 Years: [Number]
  Avg Requests/Second: [Number]
  Peak Requests/Second: [Number]
  Data Volume at Launch: [Size]
  Data Growth Rate: [Size/month]
  Read/Write Ratio: [Ratio]
  Geographic Requirements: [Single region | Multi-region | Edge]
```

### 1.6 Security and Compliance Requirements

Ask and fully resolve the following:

- Are there regulatory requirements? (GDPR, HIPAA, SOC 2, PCI-DSS, CCPA, etc.)
- Is there a data classification scheme? (public, internal, confidential, restricted)
- Are there data residency requirements? (data must stay in specific countries/regions)
- What is the password policy? (minimum length, complexity, rotation)
- Is multi-factor authentication required? For all users or specific roles?
- Are there audit logging requirements? What events must be logged?
- Is data encryption at rest required? In transit?
- Are there IP allowlisting or network isolation requirements?
- Is there a vulnerability scanning or penetration testing requirement?
- Who is responsible for incident response?

### 1.7 Performance Requirements

Ask and fully resolve the following:

- What is the target response time for API calls? (e.g., p50 < 100ms, p99 < 500ms)
- What is the uptime SLA? (e.g., 99.9%, 99.99%)
- What is the maximum acceptable downtime per month?
- Are there specific endpoints that have stricter latency requirements?
- Is there a maximum acceptable time for background job processing?
- What is the recovery time objective (RTO) and recovery point objective (RPO)?
- Are there load testing requirements before go-live?

---

## Step 2: Compile the Requirements Document

After the discovery interview is complete, compile all answers into a single requirements
document. This document must be structured, not a raw transcript. Organize it into the
following sections:

1. **System Overview** -- one paragraph summarizing what the system does and who it serves.
2. **User Roles** -- a table listing each role, its description, and its permission level.
3. **Entity Catalog** -- all entity cards from Step 1.2, refined and cross-referenced.
4. **Workflow Catalog** -- all workflow descriptions from Step 1.3, refined and cross-referenced.
5. **Integration Inventory** -- all integration cards from Step 1.4.
6. **Scale Profile** -- the structured scale expectations from Step 1.5.
7. **Security and Compliance** -- all requirements from Step 1.6.
8. **Performance Targets** -- all requirements from Step 1.7.
9. **Open Questions** -- anything that was not fully resolved during the interview.

---

## Step 3: Produce the Entity List

Separate from the requirements document, produce a standalone entity list. This is a
focused reference that the architecture phase will use directly.

For each entity, include:

- Name (singular, PascalCase)
- Description (one sentence)
- Key attributes with types (string, number, boolean, date, enum, relation)
- Relationships (entity name, cardinality, optional/required)
- Lifecycle states (if applicable)
- Soft-delete required (yes/no)
- Estimated row count at launch and at 2 years
- Access patterns (how is this entity typically queried?)

Example:

```
Entity: Order
Description: Represents a customer purchase of one or more products.
Attributes:
  - id: UUID (primary key)
  - userId: UUID (foreign key -> User)
  - status: enum (draft, placed, processing, fulfilled, cancelled)
  - totalAmount: decimal
  - currency: string (ISO 4217)
  - createdAt: datetime
  - updatedAt: datetime
Relationships:
  - User: many-to-one (required)
  - OrderItem: one-to-many
  - Payment: one-to-one (optional)
Lifecycle: draft -> placed -> processing -> fulfilled | cancelled
Soft Delete: No (use status: cancelled instead)
Row Count: 1,000 at launch, 500,000 at 2 years
Access Patterns:
  - By ID (single lookup)
  - By userId + status (list, paginated)
  - By createdAt range (reporting)
```

---

## Step 4: Produce the Integration Inventory

Produce a standalone integration inventory document. For each external service, include:

- Service name and purpose
- API documentation URL
- Authentication method and credential storage location
- Environments (production, sandbox, test)
- Rate limits and throttling behavior
- Error handling strategy (retry with backoff, circuit breaker, fallback)
- Data flow direction (inbound, outbound, bidirectional)
- Webhook endpoints (if applicable)
- SDK or client library to use (if applicable)
- Cost implications (per-request pricing, monthly minimums)

---

## Step 5: Produce the Non-Functional Requirements (NFR) Document

Compile all non-functional requirements into a standalone document organized by category:

### Performance
- Latency targets per endpoint category (CRUD, search, file upload, report generation)
- Throughput targets (requests/second sustained, burst)
- Database query time limits

### Availability
- Uptime SLA with measurement methodology
- Planned maintenance windows
- Failover strategy

### Security
- Authentication and authorization requirements
- Encryption requirements (at rest, in transit)
- Audit logging scope and retention period
- Compliance frameworks and certification targets

### Scalability
- Horizontal scaling triggers and limits
- Database scaling strategy (read replicas, sharding, partitioning)
- Caching requirements and invalidation strategy

### Observability
- Logging requirements (structured logging, log levels, retention)
- Metrics to collect (application, infrastructure, business)
- Alerting thresholds and notification channels
- Distributed tracing requirements

### Disaster Recovery
- RTO and RPO targets
- Backup frequency and retention
- Recovery testing schedule

---

## Step 6: Validation Gate

This phase is complete only when ALL of the following are true:

1. The requirements document has been presented to the user and explicitly confirmed.
2. The entity list has been reviewed and all entities, attributes, and relationships are correct.
3. The integration inventory has been reviewed and all external services are accounted for.
4. The NFR document has been reviewed and all targets are realistic and agreed upon.
5. All open questions from the requirements document have been resolved or explicitly deferred with a resolution plan.

Do not proceed to Phase 1 (Architecture Planning) until the validation gate is passed.

### Validation Checklist

- [ ] Requirements document complete and confirmed
- [ ] Entity list complete with all attributes and relationships
- [ ] Integration inventory complete with auth methods and error strategies
- [ ] NFR document complete with measurable targets
- [ ] Open questions resolved or deferred with plan
- [ ] User has explicitly approved proceeding to Phase 1

---

## Common Pitfalls

- **Assuming requirements**: Never fill in gaps with assumptions. If something is unclear, ask.
- **Skipping NFRs**: Non-functional requirements are often forgotten until production. Capture them now.
- **Ignoring scale**: A system designed for 100 users will fail at 100,000. Get the numbers early.
- **Vague entity relationships**: "Order has items" is not enough. Specify cardinality, optionality, and cascade behavior.
- **Missing failure modes**: For every integration, the question "what happens when this is down?" must have an answer.
- **Overlooking compliance**: Discovering a GDPR requirement mid-build can invalidate weeks of work.
- **Not documenting access patterns**: How data is read determines how it must be stored and indexed. Capture this during requirements, not during performance tuning.
