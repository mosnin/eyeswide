# Phase 3: API Design

## Purpose

Design all API endpoints before writing any implementation code. A complete API design serves as the contract between the backend and every consumer -- frontend applications, mobile clients, third-party integrations, and internal services. By finalizing the design before implementation, we eliminate ambiguity, catch inconsistencies early, and give frontend teams enough information to begin their work in parallel.

This phase produces a complete API specification document, an OpenAPI schema, and a full endpoint inventory. No routes are implemented yet. The focus is entirely on defining what the API exposes, how it behaves, and what guarantees it provides.

---

## REST API Conventions

### Resource Naming

All resource names in URLs follow these rules:

- Use **plural nouns**: `/users`, `/projects`, `/tasks`. Never singular (`/user`).
- Use **kebab-case** for multi-word resources: `/invoice-line-items`, `/project-members`. Never camelCase or snake_case in URLs.
- Resources represent entities, not actions. Use HTTP methods to indicate the action. Wrong: `/api/v1/create-user`. Right: `POST /api/v1/users`.
- Avoid deeply nested resources beyond two levels. Instead of `/users/:userId/projects/:projectId/tasks/:taskId/comments`, prefer `/tasks/:taskId/comments` when the task ID is sufficient to scope the query.

### HTTP Methods

Each HTTP method has a specific semantic meaning. Use them correctly:

| Method | Purpose | Idempotent | Safe | Request Body |
|--------|---------|------------|------|--------------|
| `GET` | Retrieve a resource or collection | Yes | Yes | No |
| `POST` | Create a new resource | No | No | Yes |
| `PUT` | Replace a resource entirely | Yes | No | Yes |
| `PATCH` | Partially update a resource | Yes* | No | Yes |
| `DELETE` | Remove a resource | Yes | No | No (typically) |

*PATCH is idempotent when the same patch applied multiple times produces the same result.

Rules:
- `GET` requests must never modify data. No side effects.
- `POST` is for creation and for actions that do not map cleanly to CRUD (e.g., `POST /api/v1/auth/login`).
- `PUT` replaces the entire resource. Omitted fields are set to their defaults or null.
- `PATCH` updates only the provided fields. Omitted fields remain unchanged.
- `DELETE` returns `204 No Content` on success. Deleting an already-deleted resource should return `204` (idempotent), not `404`.

### URL Structure

The base URL structure follows this pattern:

```
/api/v{version}/{resource}
/api/v{version}/{resource}/{id}
/api/v{version}/{resource}/{id}/{sub-resource}
```

Examples:
```
GET    /api/v1/users                    # List users
POST   /api/v1/users                    # Create user
GET    /api/v1/users/:id                # Get single user
PATCH  /api/v1/users/:id                # Update user
DELETE /api/v1/users/:id                # Delete user
GET    /api/v1/users/:id/projects       # List user's projects
POST   /api/v1/projects/:id/members     # Add member to project
```

Use UUIDs for resource identifiers in URLs, never sequential integers. This prevents enumeration attacks and leaking information about total record counts.

### Query Parameters

Query parameters control how collections are retrieved:

**Filtering:**
```
GET /api/v1/tasks?status=active&priority=high
GET /api/v1/tasks?created_after=2026-01-01
GET /api/v1/tasks?owner_id=550e8400-e29b-41d4-a716-446655440000
```

- Use the column name directly for exact match filters.
- Use suffixes for operators: `_gt`, `_gte`, `_lt`, `_lte`, `_ne`, `_like`, `_in`.
- Example: `?price_gte=100&price_lte=500` for range queries.
- Example: `?status_in=active,pending` for IN queries (comma-separated values).

**Sorting:**
```
GET /api/v1/tasks?sort=created_at        # Ascending (default)
GET /api/v1/tasks?sort=-created_at       # Descending (prefix with -)
GET /api/v1/tasks?sort=-priority,created_at  # Multi-column sort
```

**Pagination:**
```
GET /api/v1/tasks?cursor=eyJpZCI6MTAwfQ&limit=25
GET /api/v1/tasks?page=2&per_page=25
```

**Field Selection (Sparse Fieldsets):**
```
GET /api/v1/users?fields=id,name,email
GET /api/v1/users/:id?fields=id,name,email,created_at
```

- Field selection reduces payload size and database load.
- Always return `id` regardless of field selection.
- Reject requests for fields that do not exist with a `400 Bad Request`.

### Request Body Conventions

All request bodies use JSON with the following conventions:

- Property names use **camelCase**: `firstName`, `projectId`, `createdAt`.
- Nested objects for related data: `{ "address": { "street": "123 Main", "city": "Portland" } }`.
- Arrays for multi-valued fields: `{ "tags": ["urgent", "frontend"] }`.
- Dates and times as ISO 8601 strings: `"2026-03-26T14:30:00Z"`.
- Null values are acceptable for clearing optional fields. Omitting a field in PATCH means "do not change."
- Empty strings and null are different. An empty string means "set to empty." Null means "clear the value."

### Response Envelope

All API responses use a consistent envelope:

```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

**Single resource response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "status": "active",
    "createdAt": "2026-03-26T14:30:00Z"
  },
  "meta": {}
}
```

**Collection response:**
```json
{
  "data": [
    { "id": "...", "name": "Project A" },
    { "id": "...", "name": "Project B" }
  ],
  "meta": {
    "cursor": "eyJpZCI6MTAwfQ",
    "hasMore": true,
    "count": 2
  }
}
```

**Error response:**
```json
{
  "data": null,
  "meta": {},
  "errors": [
    {
      "type": "https://api.example.com/errors/validation",
      "title": "Validation Error",
      "status": 422,
      "detail": "The request body contains invalid fields.",
      "instance": "/api/v1/users",
      "errors": [
        { "field": "email", "message": "must be a valid email address" }
      ]
    }
  ]
}
```

---

## Status Code Usage

Use HTTP status codes precisely. Every endpoint must document which codes it can return.

| Code | Name | When to Use |
|------|------|-------------|
| `200` | OK | Successful GET, PATCH, PUT. Returns the resource. |
| `201` | Created | Successful POST that creates a resource. Return the created resource and a `Location` header. |
| `204` | No Content | Successful DELETE or an update that returns no body. |
| `400` | Bad Request | Malformed JSON, missing required query params, invalid field names in `fields` parameter. |
| `401` | Unauthorized | No authentication token provided, or the token is expired/invalid. |
| `403` | Forbidden | Authenticated but lacking permission for this action. |
| `404` | Not Found | Resource does not exist. Also use for endpoints that exist but the specific ID was not found. |
| `409` | Conflict | Attempting to create a resource that violates a uniqueness constraint (e.g., duplicate email). |
| `422` | Unprocessable Entity | Request is well-formed JSON but fails validation rules (e.g., email format, required fields missing). |
| `429` | Too Many Requests | Rate limit exceeded. Include `Retry-After` header. |
| `500` | Internal Server Error | Unexpected server failure. Never expose stack traces or internal details. Log the full error server-side. |

Key distinctions:
- **400 vs 422**: 400 is for syntactically invalid requests (bad JSON, wrong content type). 422 is for semantically invalid requests (valid JSON but fails business rules).
- **401 vs 403**: 401 means "I don't know who you are." 403 means "I know who you are, and you can't do this."
- **404 vs 403**: If a user should not even know a resource exists, return 404 instead of 403. This prevents information leakage about which IDs are valid.

---

## Error Response Format (RFC 7807)

All error responses follow the RFC 7807 Problem Details format, adapted for our envelope:

```json
{
  "type": "https://api.example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "No project exists with ID 550e8400-e29b-41d4-a716-446655440000.",
  "instance": "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000"
}
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | A URI reference that identifies the error type. Use a stable URL that points to documentation. |
| `title` | Yes | A short, human-readable summary. Should be the same for all instances of this error type. |
| `status` | Yes | The HTTP status code (duplicated here for convenience when the response body is logged without headers). |
| `detail` | Yes | A human-readable explanation specific to this occurrence. Include entity IDs, field names, and context. |
| `instance` | No | The URI of the request that caused the error. Useful for tracing. |
| `errors` | No | An array of sub-errors for validation failures. Each entry has `field`, `message`, and optionally `code`. |

Validation error with multiple field failures:

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "2 validation errors occurred.",
  "instance": "/api/v1/users",
  "errors": [
    { "field": "email", "message": "must be a valid email address", "code": "format" },
    { "field": "name", "message": "is required", "code": "required" }
  ]
}
```

---

## Pagination

### Cursor-Based Pagination (Default)

Cursor-based pagination is the default for all list endpoints. It provides stable results even when data is being inserted or deleted.

**Request:**
```
GET /api/v1/tasks?limit=25
GET /api/v1/tasks?cursor=eyJpZCI6MTAwfQ&limit=25
```

**Response:**
```json
{
  "data": [ ... ],
  "meta": {
    "cursor": "eyJpZCI6MTI1fQ",
    "hasMore": true
  }
}
```

Implementation rules:
- The cursor is an opaque, base64-encoded string. Clients must not parse or construct cursors.
- When `hasMore` is `false`, the `cursor` field is `null`.
- Default `limit` is 25. Maximum `limit` is 100. Requests exceeding the maximum are clamped, not rejected.
- The cursor encodes enough state to resume pagination (typically the last seen ID and sort column value).
- Cursors should be time-limited (expire after 24 hours) to prevent stale state.

### Offset-Based Pagination

Use offset-based pagination only when the client needs to jump to arbitrary pages (e.g., admin dashboards with page numbers).

**Request:**
```
GET /api/v1/admin/users?page=3&per_page=50
```

**Response:**
```json
{
  "data": [ ... ],
  "meta": {
    "page": 3,
    "perPage": 50,
    "total": 1247,
    "totalPages": 25
  }
}
```

Trade-offs:
- Offset pagination requires a `COUNT(*)` query which is expensive on large tables.
- Results can shift if rows are inserted/deleted between page requests.
- Use only when total counts and page jumping are genuine requirements.

---

## Rate Limiting Design

### Per-Endpoint and Per-User Limits

Rate limits protect the API from abuse and ensure fair access:

| Scope | Limit | Window | Example |
|-------|-------|--------|---------|
| Global per-user | 1000 requests | 1 hour | Prevents overall abuse |
| Auth endpoints | 10 requests | 15 minutes | Prevents brute-force login |
| Write endpoints (POST/PUT/PATCH/DELETE) | 100 requests | 1 minute | Prevents spam creation |
| Read endpoints (GET) | 300 requests | 1 minute | Allows reasonable browsing |
| File upload | 20 requests | 1 hour | Prevents storage abuse |

### Response Headers

Every response includes rate limit headers:

```
X-RateLimit-Limit: 1000          # Maximum requests in the window
X-RateLimit-Remaining: 947       # Requests remaining in the current window
X-RateLimit-Reset: 1711468800    # Unix timestamp when the window resets
Retry-After: 30                  # Seconds until next request allowed (only on 429)
```

When a client exceeds the limit, respond with:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json

{
  "type": "https://api.example.com/errors/rate-limit",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 100 requests per minute for write operations.",
  "instance": "/api/v1/tasks"
}
```

### Implementation Notes

- Use a sliding window algorithm (not fixed window) to prevent burst abuse at window boundaries.
- Store rate limit counters in Redis or an equivalent in-memory store. Never in the primary database.
- Identify users by API key or JWT subject claim. Unauthenticated requests are rate-limited by IP address.
- Allow rate limit overrides for specific API keys (partner integrations, internal services).

---

## API Versioning Strategy

Use **URL path versioning** as the primary strategy:

```
/api/v1/users
/api/v2/users
```

Rules:
- The current version is `v1`. A new version is introduced only when breaking changes are unavoidable.
- Breaking changes include: removing a field, changing a field type, altering authentication flow, changing error response structure.
- Non-breaking changes do not require a version bump: adding new fields to responses, adding new optional query parameters, adding new endpoints.
- When `v2` is introduced, `v1` remains operational for a minimum of 12 months with a published deprecation timeline.
- All versions share the same underlying database. Version differences are handled at the serialization layer (different response shapes for the same data).
- Document the changelog between versions in the API specification.

Header-based versioning (`Accept: application/vnd.api+json;version=2`) is supported as an alternative but URL versioning takes precedence if both are specified.

---

## OpenAPI / Swagger Spec Generation

The API design must be captured in an OpenAPI 3.1 specification:

- Maintain the spec as a YAML file (`openapi.yaml`) in the repository root or a dedicated `docs/` directory.
- Every endpoint must be fully described: path, method, summary, description, parameters, request body schema, response schemas for all possible status codes, and security requirements.
- Use `$ref` to define reusable schemas in `components/schemas`. Every entity (User, Project, Task) has a schema. Every error type has a schema.
- Generate the spec from the design document, not from code. The spec is the source of truth during this phase. Later phases may switch to code-first generation if a framework supports it.
- Validate the spec using `swagger-cli validate` or equivalent tooling. The spec must pass validation with zero errors and zero warnings.

Example schema component:

```yaml
components:
  schemas:
    User:
      type: object
      required: [id, email, name, createdAt]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 200
        role:
          type: string
          enum: [admin, member, viewer]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    Error:
      type: object
      required: [type, title, status, detail]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
        errors:
          type: array
          items:
            $ref: '#/components/schemas/FieldError'
```

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| **API spec document** | A human-readable document listing every endpoint with its method, URL, description, parameters, request body, response body, status codes, and authorization requirements. |
| **OpenAPI schema** | A machine-readable `openapi.yaml` file that passes validation and can generate client SDKs, server stubs, and interactive documentation. |
| **Endpoint inventory** | A flat table of all endpoints: method, path, summary, auth required (yes/no), rate limit tier. Used as a quick reference and checklist during implementation. |

Example endpoint inventory:

| Method | Path | Summary | Auth | Rate Tier |
|--------|------|---------|------|-----------|
| POST | /api/v1/auth/register | Register new user | No | Auth |
| POST | /api/v1/auth/login | Authenticate user | No | Auth |
| POST | /api/v1/auth/refresh | Refresh access token | Yes | Auth |
| GET | /api/v1/users/me | Get current user | Yes | Read |
| PATCH | /api/v1/users/me | Update current user | Yes | Write |
| GET | /api/v1/projects | List projects | Yes | Read |
| POST | /api/v1/projects | Create project | Yes | Write |
| GET | /api/v1/projects/:id | Get project | Yes | Read |
| PATCH | /api/v1/projects/:id | Update project | Yes | Write |
| DELETE | /api/v1/projects/:id | Delete project | Yes | Write |
| GET | /api/v1/projects/:id/members | List project members | Yes | Read |
| POST | /api/v1/projects/:id/members | Add project member | Yes | Write |
| DELETE | /api/v1/projects/:id/members/:userId | Remove project member | Yes | Write |

---

## Validation Gate

This phase is complete when all of the following are true:

- [ ] Every endpoint is documented with its HTTP method, URL, description, and authorization requirements.
- [ ] Every endpoint has a fully defined request schema (path params, query params, request body with types and validation rules).
- [ ] Every endpoint has response schemas for all applicable status codes (success and every possible error code).
- [ ] The OpenAPI spec passes validation with zero errors.
- [ ] The endpoint inventory is complete and reviewed against Phase 1 requirements -- no user story is missing its corresponding endpoints.
- [ ] Pagination strategy is defined for every collection endpoint.
- [ ] Rate limit tiers are assigned to every endpoint.
- [ ] Error response format is consistent across all endpoints and follows RFC 7807.
- [ ] At least one consumer (frontend team or mock client) has reviewed the API design and confirmed it meets their needs.
- [ ] The OpenAPI spec can generate a working mock server that returns example responses for every endpoint.
- [ ] API versioning strategy is documented and the initial version is established.
- [ ] All query parameter conventions (filtering, sorting, field selection) are documented with examples.
