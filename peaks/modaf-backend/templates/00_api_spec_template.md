# API Specification

> **Project:** [Project Name]
> **Version:** [v1.0.0]
> **Last Updated:** [YYYY-MM-DD]
> **Owner:** [Team / Engineer Name]
> **Status:** Draft | In Review | Approved

---

## 1. API Overview

### Base URL

| Environment | Base URL                              |
|-------------|---------------------------------------|
| Local       | `http://localhost:[PORT]/api`          |
| Development | `https://dev-api.[domain].com`        |
| Staging     | `https://staging-api.[domain].com`    |
| Production  | `https://api.[domain].com`            |

### Versioning Strategy

- **Approach:** [URL path versioning (`/v1/`) | Header versioning (`Accept: application/vnd.api+json;version=1`) | Query parameter (`?version=1`)]
- **Current Version:** [v1]
- **Deprecation Policy:** [Deprecated versions are supported for N months after the successor is released. Deprecation is communicated via the `Sunset` header and changelog announcements.]
- **Breaking Change Definition:** [Removing a field, changing a field type, removing an endpoint, changing authentication requirements, altering error response structure]

### Authentication Method

- **Primary Auth:** [Bearer Token (JWT) | API Key | OAuth 2.0 | Session-based]
- **Header Format:** `Authorization: Bearer <token>`
- **Token Lifetime:** [Access token: 15 min | Refresh token: 7 days]
- **API Key Location:** [Header (`X-API-Key`) | Query parameter]

---

## 2. Endpoints by Resource

### Resource: [Resource Name, e.g., Users]

#### `[METHOD] [/path]`

> [Brief description of what this endpoint does.]

**Authentication:** [Required | Optional | None]
**Authorization:** [Role/permission required, e.g., `admin`, `user:read`]

**Path Parameters:**

| Parameter | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| `id`      | string | Yes      | [Resource identifier] |

**Query Parameters:**

| Parameter | Type    | Required | Default | Description                        |
|-----------|---------|----------|---------|------------------------------------|
| `page`    | integer | No       | 1       | [Page number for pagination]       |
| `limit`   | integer | No       | 20      | [Number of items per page]         |
| `sort`    | string  | No       | `created_at` | [Field to sort by]            |
| `order`   | string  | No       | `desc`  | [Sort order: `asc` or `desc`]      |
| `filter`  | string  | No       | -       | [Filter expression]                |

**Request Headers:**

| Header         | Required | Description                        |
|----------------|----------|------------------------------------|
| `Content-Type` | Yes      | `application/json`                 |
| `Authorization`| Yes      | `Bearer <token>`                   |
| `Idempotency-Key` | No   | [UUID for idempotent requests]     |

**Request Body:**

```json
{
  "field_name": "string — [description, constraints]",
  "nested_object": {
    "sub_field": "integer — [description, min/max]"
  }
}
```

**Response — `200 OK`:**

```json
{
  "data": {
    "id": "string",
    "field_name": "string",
    "created_at": "ISO 8601 datetime",
    "updated_at": "ISO 8601 datetime"
  },
  "meta": {
    "request_id": "string"
  }
}
```

**Status Codes:**

| Code | Description                                      |
|------|--------------------------------------------------|
| 200  | Success                                          |
| 201  | Created (for POST that creates a resource)       |
| 204  | No Content (for DELETE)                          |
| 400  | Bad Request — validation error                   |
| 401  | Unauthorized — missing or invalid auth           |
| 403  | Forbidden — insufficient permissions             |
| 404  | Not Found — resource does not exist              |
| 409  | Conflict — duplicate or state conflict           |
| 422  | Unprocessable Entity — semantic validation error |
| 429  | Too Many Requests — rate limit exceeded          |
| 500  | Internal Server Error                            |

**Rate Limit:** [Tier and limit, e.g., Standard — 100 req/min]

---

*(Repeat the endpoint block above for each endpoint. Group endpoints under their resource heading.)*

---

## 3. Authentication & Authorization

### Authentication Flow

```
[Describe the full auth flow, e.g.:]

1. Client sends POST /auth/login with credentials
2. Server validates credentials against [user store]
3. Server returns access_token (JWT) and refresh_token
4. Client includes access_token in Authorization header for subsequent requests
5. When access_token expires, client sends POST /auth/refresh with refresh_token
6. Server issues new access_token (and optionally rotates refresh_token)
7. On logout, client sends POST /auth/logout to invalidate refresh_token
```

### Token Format

- **Type:** [JWT | Opaque | PASETO]
- **Algorithm:** [RS256 | HS256 | EdDSA]
- **Claims / Payload Structure:**

```json
{
  "sub": "user_id",
  "iss": "[issuer]",
  "aud": "[audience]",
  "exp": "[expiration timestamp]",
  "iat": "[issued at timestamp]",
  "roles": ["admin", "user"],
  "permissions": ["resource:read", "resource:write"],
  "org_id": "[organization id, if multi-tenant]"
}
```

### Permissions Model

- **Model Type:** [RBAC | ABAC | ACL | Custom]
- **Roles:** [List defined roles and their descriptions]

| Role        | Description                              | Permissions                          |
|-------------|------------------------------------------|--------------------------------------|
| `admin`     | [Full system access]                     | `*`                                  |
| `manager`   | [Team management and read/write access]  | `resource:read`, `resource:write`, `team:manage` |
| `member`    | [Standard user access]                   | `resource:read`, `resource:write`    |
| `viewer`    | [Read-only access]                       | `resource:read`                      |

- **Permission Enforcement Point:** [Middleware | Decorator | Guard | Policy class]
- **Multi-Tenancy Isolation:** [How tenant boundaries are enforced — row-level security, schema separation, org_id scoping]

---

## 4. Error Response Format

All error responses follow [RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807).

**Content-Type:** `application/problem+json`

### Standard Error Structure

```json
{
  "type": "https://api.[domain].com/errors/[error-type]",
  "title": "Human-readable summary of the problem",
  "status": 400,
  "detail": "Specific explanation of what went wrong in this instance",
  "instance": "/resource/123",
  "trace_id": "abc-123-def-456",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "Must be a valid email address"
    }
  ]
}
```

### Error Type Registry

| Error Type Slug             | HTTP Status | Title                        | When Used                                |
|-----------------------------|-------------|------------------------------|------------------------------------------|
| `validation-error`         | 400         | Validation Error             | Request body or params fail validation   |
| `authentication-required`  | 401         | Authentication Required      | No token or invalid token provided       |
| `insufficient-permissions` | 403         | Insufficient Permissions     | Token valid but lacks required permission|
| `resource-not-found`       | 404         | Resource Not Found           | Requested entity does not exist          |
| `conflict`                 | 409         | Resource Conflict            | Duplicate entry or invalid state change  |
| `rate-limit-exceeded`      | 429         | Rate Limit Exceeded          | Too many requests in window              |
| `internal-error`           | 500         | Internal Server Error        | Unexpected server-side failure           |

---

## 5. Pagination Strategy

- **Style:** [Cursor-based | Offset-based | Keyset]
- **Default Page Size:** [20]
- **Maximum Page Size:** [100]
- **Page Size Parameter:** [`limit` | `page_size` | `per_page`]

### Cursor-Based Pagination (if applicable)

**Request:**
```
GET /resources?limit=20&cursor=eyJpZCI6MTAwfQ==
```

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ==",
    "previous_cursor": "eyJpZCI6ODB9",
    "has_next": true,
    "has_previous": true,
    "total_count": 500
  }
}
```

### Offset-Based Pagination (if applicable)

**Request:**
```
GET /resources?page=2&limit=20
```

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total_pages": 25,
    "total_count": 500
  }
}
```

### Pagination Notes

- [Whether total_count is always returned or opt-in via query param]
- [Performance considerations for large datasets]
- [Stable sort requirements for cursor pagination]

---

## 6. Rate Limiting Policy

### Tiers

| Tier         | Applies To                 | Limit              | Window    |
|--------------|----------------------------|---------------------|-----------|
| Anonymous    | Unauthenticated requests   | [30 req/min]        | Per IP    |
| Standard     | Authenticated users        | [100 req/min]       | Per user  |
| Premium      | Paid plan users            | [500 req/min]       | Per user  |
| Internal     | Service-to-service         | [1000 req/min]      | Per service |
| Burst        | [Specific endpoints]       | [10 req/sec]        | Per user  |

### Rate Limit Headers

All responses include the following headers:

| Header                  | Description                                      |
|-------------------------|--------------------------------------------------|
| `X-RateLimit-Limit`     | Maximum requests allowed in the current window   |
| `X-RateLimit-Remaining` | Requests remaining in the current window         |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets            |
| `Retry-After`           | Seconds to wait before retrying (on 429 only)    |

### 429 Response Body

```json
{
  "type": "https://api.[domain].com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of [N] requests per [window]. Please retry after [Retry-After] seconds.",
  "retry_after": 30
}
```

### Rate Limit Notes

- [How limits are enforced — sliding window, fixed window, token bucket]
- [Whether rate limits apply per endpoint or globally]
- [Any endpoints exempt from rate limiting]

---

## 7. Webhook Events

### Overview

- **Webhook Registration:** [Admin UI | API endpoint `POST /webhooks`]
- **Payload Format:** `application/json`
- **Signature Header:** `X-Webhook-Signature` — HMAC-SHA256 of the payload body using the webhook secret
- **Timeout:** [30 seconds]

### Event Types

| Event                        | Trigger                                    | Payload Root Key |
|------------------------------|--------------------------------------------|------------------|
| `resource.created`           | [A new resource is created]                | `resource`       |
| `resource.updated`           | [An existing resource is modified]         | `resource`       |
| `resource.deleted`           | [A resource is permanently removed]        | `resource`       |
| `resource.status_changed`    | [Resource status transitions]              | `resource`       |

### Payload Schema

```json
{
  "id": "evt_[unique event id]",
  "type": "resource.created",
  "created_at": "ISO 8601 datetime",
  "data": {
    "resource": {
      "id": "string",
      "field": "value"
    }
  },
  "metadata": {
    "webhook_id": "wh_[id]",
    "delivery_attempt": 1
  }
}
```

### Retry Policy

| Attempt | Delay After Previous Attempt |
|---------|-------------------------------|
| 1       | Immediate                     |
| 2       | [1 minute]                    |
| 3       | [5 minutes]                   |
| 4       | [30 minutes]                  |
| 5       | [2 hours]                     |

- **Max Retries:** [5]
- **Success Criteria:** [HTTP 2xx response within timeout]
- **Failure Handling:** [After max retries, webhook is marked as failing. After N consecutive failures, webhook is disabled and owner is notified.]
- **Idempotency:** [Consumers should use `event.id` to deduplicate deliveries]

---

## Appendix

### Changelog

| Date       | Version | Author   | Changes                        |
|------------|---------|----------|--------------------------------|
| YYYY-MM-DD | 1.0.0   | [Author] | [Initial API specification]    |

### Open Questions

- [ ] [List any unresolved design decisions]
- [ ] [Questions requiring stakeholder input]

### References

- [Link to related architecture documents]
- [Link to authentication service documentation]
- [Link to OpenAPI/Swagger spec if generated separately]
