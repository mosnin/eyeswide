# API Versioning

> **TL;DR:** Use URL path versioning (/api/v1/) as the default strategy; never make breaking changes within a version; deprecate with Sunset headers and a 6-month migration window.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** All public and internal REST APIs

---

## Versioning Strategies

There are three common approaches. This system defaults to URL path versioning unless a specific project requirement demands otherwise.

### URL Path Versioning (Default)

The version number is embedded directly in the URL path.

```
GET /api/v1/users
GET /api/v2/users
```

**Pros:**

- Simple and explicit -- the version is visible in every request
- Easy to test in a browser or with curl
- Cacheable by default (different URLs = different cache entries)
- Easy to route at the load balancer or gateway level
- Clear separation in server code (v1 router vs v2 router)

**Cons:**

- Changes the resource URI (purists argue this breaks REST)
- Clients must update URLs when migrating

### Header Versioning

The version is specified via a custom header or the Accept header.

```
GET /api/users
Accept: application/vnd.api+json;version=2
```

**Pros:**

- Clean URLs that do not change between versions
- Better alignment with REST principles (same resource, different representation)

**Cons:**

- Harder to test (requires setting headers manually)
- Not visible in access logs without custom configuration
- Cannot be tested in a browser address bar
- Caching requires Vary header configuration

### Query Parameter Versioning

The version is passed as a query parameter.

```
GET /api/users?version=2
```

**Pros:**

- Simple to implement
- Easy to test

**Cons:**

- Pollutes the query string namespace
- Can conflict with actual query parameters
- Inconsistent caching behavior

---

## When to Create a New Version

### Breaking Changes (Require New Version)

These changes break existing clients and must be introduced in a new version:

- **Removing a field** from a response body
- **Renaming a field** in a request or response
- **Changing a field's type** (e.g., string to number, object to array)
- **Changing the response structure** (e.g., wrapping data in a new envelope)
- **Removing an endpoint** entirely
- **Changing error response format** or error codes
- **Making a previously optional field required** without a default value
- **Changing authentication or authorization requirements** for existing endpoints

### Non-Breaking Changes (Do NOT Require New Version)

These changes are backward-compatible and can be made within the current version:

- **Adding a new field** to a response body
- **Adding a new endpoint**
- **Adding an optional request parameter** with a sensible default
- **Adding a new enum value** to an existing field (if clients handle unknown values)
- **Improving performance** without changing the contract
- **Adding new error codes** (if clients handle unknown codes gracefully)
- **Relaxing validation** (e.g., increasing a max length)

---

## Version Lifecycle

Every API version moves through three stages:

### Active

- Current version receiving full support
- All new features and bug fixes are applied
- Full documentation and support
- This is the version new clients should integrate with

### Deprecated

- Still fully functional but scheduled for retirement
- The `Sunset` header is included in every response with the retirement date
- The `Deprecation` header indicates when deprecation was announced
- Documentation is updated with deprecation notices and migration guides
- No new features are added; only critical bug fixes and security patches

### Retired

- The version no longer functions
- All endpoints return `410 Gone` with a response body containing:
  - A human-readable message explaining the version is retired
  - A link to the migration guide
  - The current active version number

```json
{
  "error": "API_VERSION_RETIRED",
  "message": "API v1 has been retired as of 2026-01-15.",
  "migrationGuide": "https://docs.example.com/api/migration/v1-to-v2",
  "currentVersion": "v2"
}
```

---

## Deprecation Timeline

The standard deprecation process follows this timeline:

| Event | Timing | Action |
|---|---|---|
| Deprecation announced | T+0 | Add Sunset/Deprecation headers, update docs, notify consumers |
| Migration guide published | T+2 weeks | Detailed guide with code examples for every breaking change |
| Reminder notifications | T+3 months | Email/Slack reminders to consumers still using deprecated version |
| Final warning | T+5 months | Aggressive warnings, rate limiting on deprecated version |
| Version retired | T+6 months | Endpoints return 410 Gone |

Minimum deprecation window: **6 months** from announcement to retirement.

---

## Implementation Patterns

### Route-Level Versioning (Recommended)

Separate router files per version. Each version has its own complete set of routes.

```typescript
// src/routes/v1/router.ts
import { Router } from "express";
import { UserControllerV1 } from "./controllers/user.controller";
import { ProjectControllerV1 } from "./controllers/project.controller";

const v1Router = Router();

v1Router.get("/users", UserControllerV1.list);
v1Router.get("/users/:id", UserControllerV1.get);
v1Router.post("/users", UserControllerV1.create);
v1Router.put("/users/:id", UserControllerV1.update);
v1Router.delete("/users/:id", UserControllerV1.delete);

v1Router.get("/projects", ProjectControllerV1.list);
v1Router.post("/projects", ProjectControllerV1.create);

export { v1Router };
```

```typescript
// src/routes/v2/router.ts
import { Router } from "express";
import { UserControllerV2 } from "./controllers/user.controller";
import { ProjectControllerV2 } from "./controllers/project.controller";

const v2Router = Router();

v2Router.get("/users", UserControllerV2.list);
v2Router.get("/users/:id", UserControllerV2.get);
v2Router.post("/users", UserControllerV2.create);
v2Router.put("/users/:id", UserControllerV2.update);
v2Router.delete("/users/:id", UserControllerV2.delete);

// New in v2: user search endpoint
v2Router.get("/users/search", UserControllerV2.search);

v2Router.get("/projects", ProjectControllerV2.list);
v2Router.post("/projects", ProjectControllerV2.create);

export { v2Router };
```

```typescript
// src/app.ts
import { v1Router } from "./routes/v1/router";
import { v2Router } from "./routes/v2/router";
import { retiredVersionHandler } from "./middleware/versioning";

const app = express();

// Active versions
app.use("/api/v2", v2Router);
app.use("/api/v1", deprecationMiddleware("2026-06-01"), v1Router);

// Retired versions (example)
// app.use("/api/v0", retiredVersionHandler("v0", "v1"));

export { app };
```

### Controller-Level Versioning

Shared services with version-specific controllers. Use when versions share most logic.

```typescript
// Shared service -- business logic does not change between versions
class UserService {
  async getUser(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organization: true, memberships: true },
    });
  }
}

// V1 controller -- returns the original response shape
class UserControllerV1 {
  static async get(req: Request, res: Response) {
    const user = await userService.getUser(req.params.id);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      orgName: user.organization.name, // flat field
    });
  }
}

// V2 controller -- returns a nested response shape
class UserControllerV2 {
  static async get(req: Request, res: Response) {
    const user = await userService.getUser(req.params.id);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      organization: {            // nested object (breaking change)
        id: user.organization.id,
        name: user.organization.name,
      },
    });
  }
}
```

### Transformer-Level Versioning

Shared controller with response transformers per version. Use when only the response shape differs.

```typescript
// Response transformers
const userTransformers = {
  v1: (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    orgName: user.organization.name,
  }),
  v2: (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
    },
  }),
};

// Middleware that selects the right transformer
function versionedResponse(transformers: Record<string, Function>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.params.version || "v2";
    res.locals.transform = transformers[version] || transformers.v2;
    next();
  };
}
```

---

## Backward Compatibility Rules

These rules apply to all changes within a version:

1. **Never remove response fields.** If a field is no longer relevant, set it to `null` and add the replacement field alongside it.
2. **Never change field types.** If `count` was a number, do not change it to a string. Add `countFormatted` as a new field.
3. **Never change error codes or formats.** Clients rely on specific error codes for programmatic handling.
4. **New required request fields must have defaults.** If you add a new required field, provide a default so existing clients that do not send it continue to work.
5. **Never change the meaning of existing fields.** If `status` used to mean "account status" and you want it to mean "subscription status," add a new field instead.
6. **Never change URL parameter names.** If `:userId` is a route parameter, do not rename it to `:id`.

---

## Response Headers

Include these headers in all API responses to communicate version information:

```typescript
function versionHeaders(version: string, sunset?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Always include the current API version
    res.setHeader("API-Version", version);

    // For deprecated versions, include sunset and deprecation dates
    if (sunset) {
      res.setHeader("Sunset", new Date(sunset).toUTCString());
      res.setHeader("Deprecation", "true");
      res.setHeader(
        "Link",
        `<https://docs.example.com/api/migration/${version}>; rel="deprecation"`
      );
    }

    next();
  };
}

// Usage
app.use("/api/v1", versionHeaders("v1", "2026-06-01"), v1Router);
app.use("/api/v2", versionHeaders("v2"), v2Router);
```

---

## Documentation

### Version-Specific Docs

Every API version must have its own documentation that includes:

- Complete endpoint reference (request/response schemas)
- Authentication requirements
- Rate limiting rules
- Changelog since the previous version

### Migration Guides

When a new version is released, publish a migration guide that includes:

- A complete list of breaking changes
- Before/after code examples for each change
- A recommended migration order (which changes to make first)
- Common pitfalls and how to avoid them
- A timeline for deprecation of the previous version

```markdown
## Migration Guide: v1 to v2

### Breaking Changes

#### 1. User response: `orgName` replaced with `organization` object

**Before (v1):**
{"id": "...", "name": "...", "orgName": "Acme Corp"}

**After (v2):**
{"id": "...", "name": "...", "organization": {"id": "...", "name": "Acme Corp"}}

**Migration:** Replace `response.orgName` with `response.organization.name`.
```

---

## Canonical Versioned Router Setup

The complete setup for a versioned API:

```typescript
// src/middleware/versioning.ts
import { Request, Response, NextFunction } from "express";

export function deprecationMiddleware(sunsetDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Sunset", new Date(sunsetDate).toUTCString());
    res.setHeader("Deprecation", "true");
    res.setHeader(
      "Link",
      `<https://docs.example.com/api/migration>; rel="deprecation"`
    );
    console.warn(
      `[DEPRECATION] ${req.method} ${req.originalUrl} -- client using deprecated API version`
    );
    next();
  };
}

export function retiredVersionHandler(
  retiredVersion: string,
  currentVersion: string
) {
  return (req: Request, res: Response) => {
    res.status(410).json({
      error: "API_VERSION_RETIRED",
      message: `API ${retiredVersion} has been retired.`,
      migrationGuide: `https://docs.example.com/api/migration/${retiredVersion}-to-${currentVersion}`,
      currentVersion,
    });
  };
}
```
