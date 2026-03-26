# API Design System

> **TL;DR** — Every HTTP endpoint follows a single, predictable contract: plural-noun resources, consistent verbs, cursor-based pagination, RFC 7807 errors, and a canonical controller pattern that keeps business logic out of route handlers.

---

## Metadata

| Key | Value |
|-----|-------|
| **Covers** | REST API naming, HTTP method semantics, URL structure, query parameters, request/response envelopes, status codes, error format, pagination, rate limiting, content negotiation, bulk operations, file uploads |
| **Depends on** | `internal/02_database_patterns.md` (schema shapes inform resource structure), project OpenAPI specification |
| **Used by** | Phase 04 (Core API scaffolding), Phase 05 (Service layer build-out), Phase 08 (External integrations), Phase 10 (Security hardening) |
| **Phase** | Primarily authored during Phase 04; referenced and enforced in every subsequent phase |

---

## 1. REST API Naming Conventions

### 1.1 Resource Names

- Always **plural nouns**: `/users`, `/projects`, `/invoice-line-items`.
- Never verbs in the URL path. The HTTP method is the verb.
- Use **kebab-case** for multi-word path segments: `/project-members`, not `/projectMembers` or `/project_members`.
- Singleton resources (e.g., the authenticated user's profile) use a singular alias: `/api/v1/me/profile`.

### 1.2 Property Names in JSON Bodies

- Use **camelCase** for all JSON property names in request and response bodies: `firstName`, `createdAt`, `projectId`.
- Never mix naming conventions within a single payload. If a third-party integration returns `snake_case`, map it to `camelCase` at the integration boundary.

### 1.3 Header Names

- Standard HTTP headers use their canonical casing: `Content-Type`, `Authorization`, `X-Request-Id`.
- Custom headers use the `X-` prefix with PascalCase segments: `X-RateLimit-Limit`, `X-Correlation-Id`.

---

## 2. HTTP Method Semantics

| Method | Semantics | Idempotent | Safe | Typical Status |
|--------|-----------|------------|------|----------------|
| `GET` | Retrieve a resource or collection. Never mutates state. | Yes | Yes | 200 |
| `POST` | Create a new resource or trigger an action (e.g., send email). | No | No | 201 (create), 202 (async action) |
| `PUT` | Full replacement of a resource. Client sends the complete representation. | Yes | No | 200 or 204 |
| `PATCH` | Partial update. Client sends only the fields to change. | No* | No | 200 |
| `DELETE` | Remove a resource. Soft or hard delete depending on domain policy. | Yes | No | 204 (success), 200 (if returning deleted entity) |

*`PATCH` is idempotent if the client sends the same partial payload repeatedly and no other state changes occur. In practice, treat it as non-idempotent to be safe.

### Method Selection Rules

1. If the client is fetching data, use `GET`. Never use `POST` to fetch data unless the query itself is too complex for URL query parameters (e.g., GraphQL-style queries or search bodies exceeding 2,048 characters).
2. If the client is creating a brand-new entity, use `POST`.
3. If the client is sending the full entity to replace the current state, use `PUT`.
4. If the client is sending a partial update (e.g., changing only `status`), use `PATCH`.
5. If the client is removing an entity, use `DELETE`.

---

## 3. URL Structure

All API routes are prefixed with `/api/v{n}/` where `{n}` is the major version number.

```
Base:         /api/v1
Collection:   /api/v1/{resource}
Instance:     /api/v1/{resource}/{id}
Sub-resource: /api/v1/{resource}/{id}/{sub-resource}
Sub-instance: /api/v1/{resource}/{id}/{sub-resource}/{subId}
Actions:      /api/v1/{resource}/{id}/actions/{action}
```

### Examples

```
GET    /api/v1/users                          # List all users
POST   /api/v1/users                          # Create a user
GET    /api/v1/users/cuid_abc123              # Get a specific user
PUT    /api/v1/users/cuid_abc123              # Replace a user
PATCH  /api/v1/users/cuid_abc123              # Partially update a user
DELETE /api/v1/users/cuid_abc123              # Delete a user
GET    /api/v1/users/cuid_abc123/projects     # List a user's projects
POST   /api/v1/users/cuid_abc123/actions/ban  # Trigger ban action
```

### Nesting Depth

- Maximum nesting depth is **two levels** of resources: `/api/v1/{resource}/{id}/{sub-resource}`.
- If you need deeper nesting, flatten it: instead of `/api/v1/orgs/{orgId}/teams/{teamId}/members`, use `/api/v1/team-members?filter[teamId]=xyz`.

---

## 4. Query Parameter Conventions

### 4.1 Filtering

Use bracket notation for filter parameters:

```
GET /api/v1/users?filter[status]=active&filter[role]=admin
GET /api/v1/tasks?filter[createdAt][gte]=2025-01-01&filter[createdAt][lte]=2025-12-31
```

Supported filter operators: `eq` (default, can be omitted), `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`, `ilike`.

```
GET /api/v1/products?filter[price][gte]=10&filter[price][lte]=100
GET /api/v1/users?filter[role][in]=admin,editor
```

### 4.2 Sorting

Use the `sort` parameter with `field:direction` syntax. Multiple sort fields are comma-separated:

```
GET /api/v1/users?sort=createdAt:desc
GET /api/v1/tasks?sort=priority:asc,createdAt:desc
```

Default sort direction is `asc` if omitted: `sort=name` is equivalent to `sort=name:asc`.

### 4.3 Pagination

```
GET /api/v1/users?page[cursor]=eyJpZCI6MTAwfQ&page[size]=25
GET /api/v1/admin/users?page[offset]=0&page[limit]=50
```

See Section 9 for full pagination details.

### 4.4 Sparse Fieldsets

Use the `fields` parameter to request only specific fields:

```
GET /api/v1/users?fields=id,email,displayName
```

This reduces payload size and can improve query performance when the backend maps it to a SELECT clause.

### 4.5 Includes (Relationship Expansion)

Use the `include` parameter to embed related resources:

```
GET /api/v1/projects/abc123?include=owner,tasks
```

Limit include depth to one level. Nested includes (`include=tasks.assignee`) are supported but must be explicitly allow-listed per endpoint to prevent N+1 explosions.

---

## 5. Request Body Conventions

### 5.1 Structure Rules

- Request bodies are **flat objects** by default. Only nest when representing a genuine relationship or embedded object.
- **Never** send an array as the root of a request body. Always wrap in an object: `{ "items": [...] }`.
- Omitted fields in a `PATCH` request mean "do not change." Explicitly setting a field to `null` means "clear this field."

### 5.2 Create Request (POST)

```json
{
  "email": "ada@example.com",
  "displayName": "Ada Lovelace",
  "role": "editor",
  "organizationId": "org_xyz789"
}
```

### 5.3 Update Request (PATCH)

```json
{
  "displayName": "Ada L.",
  "bio": null
}
```

The above changes `displayName` and clears `bio`. All other fields remain untouched.

### 5.4 Relationship Handling

When creating or updating relationships, use the related resource's ID:

```json
{
  "title": "New Task",
  "projectId": "proj_abc123",
  "assigneeIds": ["user_1", "user_2"]
}
```

For M:M relationships that carry payload, nest the relationship data:

```json
{
  "members": [
    { "userId": "user_1", "role": "admin" },
    { "userId": "user_2", "role": "viewer" }
  ]
}
```

---

## 6. Response Envelope

All successful responses use a consistent envelope:

```json
{
  "data": {},
  "meta": {},
  "links": {}
}
```

### 6.1 Single Resource Response

```json
{
  "data": {
    "id": "user_abc123",
    "email": "ada@example.com",
    "displayName": "Ada Lovelace",
    "role": "editor",
    "createdAt": "2025-06-15T10:30:00Z",
    "updatedAt": "2025-06-15T10:30:00Z"
  }
}
```

### 6.2 Collection Response

```json
{
  "data": [
    { "id": "user_abc123", "email": "ada@example.com" },
    { "id": "user_def456", "email": "grace@example.com" }
  ],
  "meta": {
    "pagination": {
      "cursor": "eyJpZCI6ImRlZjQ1NiJ9",
      "hasMore": true,
      "totalCount": 142
    }
  },
  "links": {
    "self": "/api/v1/users?page[cursor]=abc&page[size]=25",
    "next": "/api/v1/users?page[cursor]=eyJpZCI6ImRlZjQ1NiJ9&page[size]=25"
  }
}
```

### 6.3 Empty Collection

```json
{
  "data": [],
  "meta": {
    "pagination": {
      "cursor": null,
      "hasMore": false,
      "totalCount": 0
    }
  }
}
```

### 6.4 No-Content Responses

`204 No Content` responses have no body. Used for successful `DELETE` operations and `PUT`/`PATCH` operations that do not need to return the updated resource.

---

## 7. Status Codes

| Code | Name | When to Use |
|------|------|-------------|
| `200` | OK | Successful GET, PUT, PATCH that returns a body. Default success code. |
| `201` | Created | Successful POST that creates a new resource. Always include a `Location` header pointing to the new resource. |
| `202` | Accepted | Request accepted for asynchronous processing. Return a job ID or status polling URL. |
| `204` | No Content | Successful DELETE, or PUT/PATCH that intentionally returns no body. |
| `301` | Moved Permanently | Resource URL has permanently changed. Include `Location` header. Use for API version retirement. |
| `304` | Not Modified | Conditional GET where ETag or Last-Modified matches. No body. |
| `400` | Bad Request | Malformed request syntax, missing required fields, or invalid field values that fail schema validation. |
| `401` | Unauthorized | No authentication credentials provided, or credentials are invalid/expired. The client must authenticate. |
| `403` | Forbidden | Authentication succeeded, but the authenticated user lacks permission for this action. |
| `404` | Not Found | The requested resource does not exist. Also used to hide the existence of resources the user cannot access (security through obscurity). |
| `409` | Conflict | The request conflicts with current resource state. Common for duplicate unique constraints or stale optimistic locks. |
| `422` | Unprocessable Entity | Request is syntactically valid but semantically wrong. Business rule violations (e.g., "cannot delete a project with active tasks"). |
| `429` | Too Many Requests | Rate limit exceeded. Include `Retry-After` header with seconds until the client can retry. |
| `500` | Internal Server Error | Unexpected server error. Log the full error internally; return a generic message to the client. |
| `503` | Service Unavailable | The service is temporarily down (maintenance, dependency failure). Include `Retry-After` header if possible. |

### Status Code Selection Rules

1. Always use the most specific applicable code. Prefer `422` over `400` when the issue is a business rule violation, not a syntax error.
2. Never return `200` for an error. If something went wrong, use a 4xx or 5xx code.
3. Never return `500` for a client error. If the client can fix the issue by changing the request, use 4xx.

---

## 8. Error Response Format (RFC 7807)

All error responses conform to RFC 7807 Problem Details:

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation. See 'errors' array for details.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address.",
      "code": "INVALID_FORMAT"
    },
    {
      "field": "displayName",
      "message": "Must be between 2 and 100 characters.",
      "code": "STRING_LENGTH"
    }
  ]
}
```

### Field-Level Error Codes

Standardize error codes across the application:

| Code | Meaning |
|------|---------|
| `REQUIRED` | Field is missing and required. |
| `INVALID_FORMAT` | Field value does not match expected format (email, URL, UUID). |
| `STRING_LENGTH` | String length is outside min/max bounds. |
| `NUMBER_RANGE` | Numeric value is outside min/max bounds. |
| `INVALID_ENUM` | Value is not one of the allowed enum values. |
| `DUPLICATE` | Value violates a uniqueness constraint. |
| `NOT_FOUND` | Referenced resource (foreign key) does not exist. |
| `IMMUTABLE` | Field cannot be changed after creation. |
| `BUSINESS_RULE` | A domain-specific business rule was violated. |

### Error Type URIs

The `type` field is a URI that uniquely identifies the error category. Maintain a registry of error types:

```
https://api.example.com/errors/validation-failed
https://api.example.com/errors/authentication-required
https://api.example.com/errors/permission-denied
https://api.example.com/errors/resource-not-found
https://api.example.com/errors/conflict
https://api.example.com/errors/rate-limit-exceeded
https://api.example.com/errors/internal-error
```

---

## 9. Pagination

### 9.1 Cursor-Based Pagination (Default)

Use cursor-based pagination for all public-facing list endpoints, feeds, timelines, and any dataset where rows can be inserted or deleted between page requests.

```
GET /api/v1/posts?page[cursor]=eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxIn0&page[size]=25
```

Response metadata:

```json
{
  "meta": {
    "pagination": {
      "cursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAyIn0",
      "hasMore": true,
      "pageSize": 25
    }
  }
}
```

Cursor implementation: encode the sort key(s) and primary key as a Base64 JSON object. Never expose raw database values in cursors.

### 9.2 Offset-Based Pagination (Admin Only)

Use offset-based pagination only for internal admin tables where total count and random page access are needed.

```
GET /api/v1/admin/users?page[offset]=100&page[limit]=50
```

Response metadata:

```json
{
  "meta": {
    "pagination": {
      "offset": 100,
      "limit": 50,
      "totalCount": 5230
    }
  }
}
```

### 9.3 Page Size Limits

- Default page size: **25**
- Minimum page size: **1**
- Maximum page size: **100**
- If the client requests a size above the maximum, clamp to 100 silently.

---

## 10. Rate Limiting

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1719500400
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum number of requests allowed in the current window. |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window. |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the rate limit window resets. |

When the limit is exceeded, return `429 Too Many Requests` with a `Retry-After` header:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719500400
```

### Default Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Public (unauthenticated) | 30 requests | 1 minute |
| Authenticated (standard) | 100 requests | 1 minute |
| Authenticated (write-heavy) | 30 requests | 1 minute |
| Admin endpoints | 200 requests | 1 minute |
| File uploads | 10 requests | 1 minute |

---

## 11. HATEOAS Links (Optional)

When enabled, responses include navigational links:

```json
{
  "data": { "id": "proj_abc", "name": "Project Alpha" },
  "links": {
    "self": "/api/v1/projects/proj_abc",
    "tasks": "/api/v1/projects/proj_abc/tasks",
    "members": "/api/v1/projects/proj_abc/members",
    "owner": "/api/v1/users/user_xyz"
  }
}
```

HATEOAS is optional. Enable it when the API is consumed by third-party clients who benefit from discoverability. For internal SPAs, it is typically unnecessary overhead.

---

## 12. Content Negotiation

- Default content type: `application/json`.
- The `Accept` header controls response format. If the server cannot produce the requested format, return `406 Not Acceptable`.
- Error responses use `application/problem+json` (RFC 7807).
- Support `application/json` as the minimum. Add `text/csv`, `application/xml`, or others as project needs dictate.

```
GET /api/v1/reports/sales
Accept: text/csv
```

---

## 13. Bulk Operations

For operations on multiple resources in a single request:

```
POST /api/v1/users/bulk
Content-Type: application/json

{
  "action": "create",
  "items": [
    { "email": "user1@example.com", "displayName": "User One" },
    { "email": "user2@example.com", "displayName": "User Two" }
  ]
}
```

### Bulk Response

Return per-item results so the client knows which succeeded and which failed:

```json
{
  "data": {
    "succeeded": 1,
    "failed": 1,
    "results": [
      { "index": 0, "status": 201, "data": { "id": "user_new1" } },
      { "index": 1, "status": 409, "error": { "code": "DUPLICATE", "message": "Email already exists." } }
    ]
  }
}
```

### Bulk Limits

- Maximum items per bulk request: **100**.
- Bulk operations are always transactional by default (all-or-nothing). If partial success is acceptable, the client must set `"atomic": false` in the request.

---

## 14. File Uploads

File uploads use `multipart/form-data`:

```
POST /api/v1/attachments
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

(binary data)
--boundary
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{ "projectId": "proj_abc", "description": "Q4 Sales Report" }
--boundary--
```

### Upload Constraints

| Constraint | Default | Override |
|------------|---------|----------|
| Max file size | 10 MB | Configurable per endpoint |
| Max files per request | 5 | Configurable per endpoint |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/csv` | Configurable per endpoint |
| Max filename length | 255 characters | Fixed |

### Upload Response

```json
{
  "data": {
    "id": "att_xyz789",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 2048576,
    "url": "https://cdn.example.com/attachments/att_xyz789/report.pdf",
    "createdAt": "2025-06-15T10:30:00Z"
  }
}
```

For files larger than 10 MB, use presigned upload URLs instead of direct multipart upload.

---

## 15. Canonical Controller Pattern

Every controller follows this structure. Business logic never lives in the controller.

```typescript
// src/controllers/users.controller.ts
import { Request, Response, NextFunction } from "express";
import { UserService } from "@/services/users.service";
import { CreateUserSchema, UpdateUserSchema, ListUsersSchema } from "@/schemas/users.schema";
import { HttpStatus } from "@/lib/http-status";
import { AppError } from "@/lib/errors";

export class UsersController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/v1/users
   * List users with filtering, sorting, and pagination.
   */
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ListUsersSchema.parse(req.query);
      const result = await this.userService.list(query);

      res.status(HttpStatus.OK).json({
        data: result.items,
        meta: { pagination: result.pagination },
        links: result.links,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/users/:id
   * Retrieve a single user by ID.
   */
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.getById(req.params.id);

      if (!user) {
        throw new AppError("RESOURCE_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
      }

      res.status(HttpStatus.OK).json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/users
   * Create a new user.
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateUserSchema.parse(req.body);
      const user = await this.userService.create(body);

      res
        .status(HttpStatus.CREATED)
        .header("Location", `/api/v1/users/${user.id}`)
        .json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/users/:id
   * Partially update a user.
   */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateUserSchema.parse(req.body);
      const user = await this.userService.update(req.params.id, body);

      res.status(HttpStatus.OK).json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/users/:id
   * Soft-delete a user.
   */
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.userService.delete(req.params.id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  };
}
```

---

## 16. Canonical Route File Pattern

Routes are registered in a dedicated file that wires controllers to paths and applies middleware.

```typescript
// src/routes/users.routes.ts
import { Router } from "express";
import { UsersController } from "@/controllers/users.controller";
import { UserService } from "@/services/users.service";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { rateLimit } from "@/middleware/rate-limit";
import { validate } from "@/middleware/validate";
import { CreateUserSchema, UpdateUserSchema } from "@/schemas/users.schema";

export function createUsersRouter(userService: UserService): Router {
  const router = Router();
  const controller = new UsersController(userService);

  // All routes require authentication
  router.use(authenticate);

  // List users — standard rate limit
  router.get(
    "/",
    rateLimit({ max: 100, windowMs: 60_000 }),
    controller.list
  );

  // Get single user
  router.get(
    "/:id",
    rateLimit({ max: 100, windowMs: 60_000 }),
    controller.getById
  );

  // Create user — admin only, write-heavy rate limit
  router.post(
    "/",
    authorize("admin"),
    rateLimit({ max: 30, windowMs: 60_000 }),
    validate(CreateUserSchema),
    controller.create
  );

  // Update user — owner or admin
  router.patch(
    "/:id",
    authorize("admin", "owner"),
    rateLimit({ max: 30, windowMs: 60_000 }),
    validate(UpdateUserSchema),
    controller.update
  );

  // Delete user — admin only
  router.delete(
    "/:id",
    authorize("admin"),
    rateLimit({ max: 30, windowMs: 60_000 }),
    controller.delete
  );

  return router;
}
```

### Route Registration at App Level

```typescript
// src/app.ts
import express from "express";
import { createUsersRouter } from "@/routes/users.routes";
import { createProjectsRouter } from "@/routes/projects.routes";
import { UserService } from "@/services/users.service";
import { ProjectService } from "@/services/projects.service";
import { errorHandler } from "@/middleware/error-handler";
import { requestLogger } from "@/middleware/request-logger";
import { correlationId } from "@/middleware/correlation-id";

const app = express();

// Global middleware
app.use(express.json({ limit: "1mb" }));
app.use(correlationId);
app.use(requestLogger);

// Versioned API routes
const v1 = express.Router();
v1.use("/users", createUsersRouter(new UserService()));
v1.use("/projects", createProjectsRouter(new ProjectService()));

app.use("/api/v1", v1);

// Global error handler (must be last)
app.use(errorHandler);
```

---

## Checklist for New Endpoints

Before shipping any new endpoint, verify:

- [ ] Resource name is a plural noun in kebab-case.
- [ ] HTTP method matches the operation semantics (see Section 2).
- [ ] URL follows the `/api/v1/{resource}` structure (see Section 3).
- [ ] Input validation runs before any business logic.
- [ ] Response uses the standard envelope (see Section 6).
- [ ] Error responses follow RFC 7807 (see Section 8).
- [ ] Correct status code is returned for every code path (see Section 7).
- [ ] Rate limiting is applied (see Section 10).
- [ ] Authentication and authorization middleware are attached.
- [ ] Pagination is cursor-based for public endpoints (see Section 9).
- [ ] Integration and unit tests cover both happy and error paths.
