# Input Validation System

> **TL;DR:** Validate all data at system boundaries using Zod schemas; trust internal data that has already passed validation.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** All API endpoints, webhook handlers, and job processors

---

## Validation Philosophy

The core principle is: **validate at system boundaries, trust internal data**. Every piece of data entering the system from an external source must be validated before it reaches business logic. Once data has been validated and accepted, internal services trust it without re-validation.

System boundaries where validation is mandatory:

- **API input** -- request body, query parameters, URL parameters, headers
- **Webhook payloads** -- incoming events from third-party services
- **Job payloads** -- data passed to background job processors
- **File uploads** -- size, type, and content constraints
- **External API responses** -- data returned from third-party services (validate shape, not business rules)

Internal boundaries where validation is NOT required:

- Service-to-service calls within the same process
- Repository return values (the database is a trusted source)
- Event payloads emitted and consumed within the same system

---

## Schema Library: Zod (Default)

Zod is the default validation library for all new code. It provides TypeScript-first schema declaration with static type inference, meaning you define the schema once and get both runtime validation and compile-time types.

```typescript
import { z } from "zod";

// Define the schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]),
});

// Infer the TypeScript type from the schema
type CreateUserInput = z.infer<typeof CreateUserSchema>;
// Result: { email: string; name: string; role: "admin" | "member" | "viewer" }
```

For legacy code that uses **Joi** or **Yup**, follow the same organizational patterns described below. Migration to Zod is encouraged but not mandatory for existing endpoints.

---

## Common Validation Patterns

### String Validations

```typescript
const StringSchemas = {
  // Email with normalization
  email: z.string().email("Invalid email address").toLowerCase().trim(),

  // URL requiring HTTPS
  url: z.string().url("Invalid URL").startsWith("https://", "URL must use HTTPS"),

  // UUID v4
  uuid: z.string().uuid("Invalid UUID format"),

  // Length-constrained string
  name: z.string().min(1, "Name is required").max(255, "Name is too long").trim(),

  // Regex-validated string
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format (lowercase, hyphens only)"),

  // Optional string that converts empty string to undefined
  optionalString: z
    .string()
    .trim()
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
};
```

### Number Validations

```typescript
const NumberSchemas = {
  // Positive integer (e.g., database IDs)
  positiveInt: z.number().int().positive(),

  // Bounded number
  bounded: z.number().min(0).max(1000),

  // Percentage (0-100)
  percentage: z.number().min(0).max(100),

  // Price in cents (integer, non-negative)
  priceCents: z.number().int().nonnegative(),

  // Port number
  port: z.number().int().min(1).max(65535),
};
```

### Date Validations

```typescript
const DateSchemas = {
  // ISO 8601 date string
  isoDate: z.string().datetime({ message: "Must be a valid ISO 8601 date" }),

  // Date that must be in the future
  futureDate: z.coerce.date().refine((date) => date > new Date(), {
    message: "Date must be in the future",
  }),

  // Date that must be in the past
  pastDate: z.coerce.date().refine((date) => date < new Date(), {
    message: "Date must be in the past",
  }),

  // Date range (start must be before end)
  dateRange: z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    })
    .refine((data) => data.startDate < data.endDate, {
      message: "Start date must be before end date",
      path: ["endDate"],
    }),
};
```

### Enum Validations

```typescript
// From a literal union
const StatusEnum = z.enum(["active", "inactive", "pending", "archived"]);
type Status = z.infer<typeof StatusEnum>; // "active" | "inactive" | "pending" | "archived"

// From a native TypeScript enum
enum Priority {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}
const PrioritySchema = z.nativeEnum(Priority);
```

### Array Validations

```typescript
const ArraySchemas = {
  // Array with min/max items
  tags: z.array(z.string().min(1)).min(1, "At least one tag required").max(20, "Too many tags"),

  // Unique items (using refine)
  uniqueIds: z
    .array(z.string().uuid())
    .refine((items) => new Set(items).size === items.length, {
      message: "Array must contain unique items",
    }),

  // Non-empty array
  nonEmpty: z.array(z.string()).nonempty("Must have at least one item"),
};
```

### Object Validations

```typescript
const ObjectSchemas = {
  // Nested object with optional fields
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().default("US"),
    apartment: z.string().optional(),
  }),

  // Strict object -- rejects unknown keys
  strictConfig: z
    .object({
      key: z.string(),
      value: z.string(),
    })
    .strict(),
};
```

### Pagination Schemas

```typescript
// Cursor-based pagination
const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

// Offset-based pagination
const OffsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
```

### File Upload Validation

```typescript
const FileUploadSchema = z.object({
  size: z.number().max(10 * 1024 * 1024, "File must be under 10MB"),
  mimetype: z.enum(
    ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    { errorMap: () => ({ message: "Unsupported file type" }) }
  ),
  originalname: z.string().min(1),
  width: z.number().int().positive().max(8192).optional(),
  height: z.number().int().positive().max(8192).optional(),
});

// Validate image dimensions when present
const ImageUploadSchema = FileUploadSchema.extend({
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
}).refine(
  (data) => data.width * data.height <= 25_000_000,
  { message: "Image resolution too high (max 25 megapixels)" }
);
```

---

## Request Validation Pattern

Validate body, params, and query as separate schemas. Each is parsed independently so errors are scoped to the correct source.

### Validation Middleware

```typescript
import { z, ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { ValidationError } from "@/lib/errors";

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Record<string, z.ZodError> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) errors.body = result.error;
      else req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) errors.params = result.error;
      else req.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) errors.query = result.error;
      else req.query = result.data;
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError("Validation failed", errors);
    }

    next();
  };
}
```

### Schema Per Endpoint

```typescript
// /lib/validations/user.ts

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  metadata: z.record(z.string()).optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ email: true });

export const listUsersQuerySchema = OffsetPaginationSchema.extend({
  role: z.enum(["admin", "member", "viewer"]).optional(),
  search: z.string().max(255).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const userParamsSchema = z.object({
  userId: z.string().uuid(),
});
```

### Applying to Routes

```typescript
import { Router } from "express";
import { validate } from "@/middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  userParamsSchema,
} from "@/lib/validations/user";
import { UserController } from "@/controllers/user.controller";

const router = Router();

router.post("/users", validate({ body: createUserSchema }), UserController.create);

router.get("/users", validate({ query: listUsersQuerySchema }), UserController.list);

router.patch(
  "/users/:userId",
  validate({ params: userParamsSchema, body: updateUserSchema }),
  UserController.update
);

router.delete(
  "/users/:userId",
  validate({ params: userParamsSchema }),
  UserController.delete
);
```

---

## Schema Organization

All validation schemas live in `/lib/validations/`, organized by resource:

```
/lib/validations/
  common.ts           # Shared schemas (pagination, sorting, date range)
  user.ts             # User-related schemas
  project.ts          # Project-related schemas
  organization.ts     # Organization-related schemas
  file.ts             # File upload schemas
  webhook.ts          # Webhook payload schemas
  index.ts            # Re-exports
```

---

## Schema Reuse with .pick(), .omit(), .extend()

Define a base schema once and derive create/update/query schemas from it. This prevents duplication and ensures consistency.

```typescript
// Base schema -- the canonical shape of a User at the validation layer
const UserBaseSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
  preferences: z.object({
    emailNotifications: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
  }),
});

// Create: all required fields must be present
export const createUserSchema = UserBaseSchema;

// Update: all fields optional (partial), email cannot be changed
export const updateUserSchema = UserBaseSchema.partial().omit({ email: true });

// Patch preferences only
export const updatePreferencesSchema = UserBaseSchema.pick({ preferences: true });

// Admin create: extends base with admin-only fields
export const adminCreateUserSchema = UserBaseSchema.extend({
  verified: z.boolean().default(false),
  quotaOverride: z.number().int().positive().optional(),
});
```

---

## Coercion

Query parameters and URL params arrive as strings. Use `z.coerce` to parse them into the correct type:

```typescript
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),       // "3" → 3
  active: z.coerce.boolean().default(true),                // "false" → false
  since: z.coerce.date(),                                  // "2026-01-01" → Date
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
```

---

## Custom Validators

```typescript
// Password strength
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

// Slug format
const slugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Slug must start with a letter, end with a letter or digit, and contain only lowercase letters, digits, and hyphens");

// Phone number (E.164 format)
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +14155552671)");
```

---

## Error Messages

Validation errors are returned in a consistent, user-friendly format. Each field error includes a translatable message key and a human-readable default message.

```typescript
// Error response shape
interface ValidationErrorResponse {
  status: 422;
  code: "VALIDATION_ERROR";
  message: "Validation failed";
  errors: Array<{
    field: string;       // dot-notated path: "preferences.theme"
    message: string;     // human-readable: "Must be one of: light, dark, system"
    code: string;        // machine key: "invalid_enum_value"
    received?: unknown;  // the value that was rejected
  }>;
}

// Transform Zod errors into this format
function formatZodError(error: z.ZodError): ValidationErrorResponse["errors"] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
    received: "received" in issue ? issue.received : undefined,
  }));
}
```

For internationalization, use the `code` field as a translation key, and fall back to `message` for untranslated locales.

---

## Canonical Validation Middleware (Full Example)

```typescript
// /middleware/validate.ts

import { z, ZodSchema, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

export class ValidationError extends Error {
  public readonly status = 422;
  public readonly code = "VALIDATION_ERROR";
  public readonly errors: Array<{
    source: "body" | "params" | "query";
    field: string;
    message: string;
    code: string;
  }>;

  constructor(zodErrors: Record<string, ZodError>) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = [];

    for (const [source, zodError] of Object.entries(zodErrors)) {
      for (const issue of zodError.issues) {
        this.errors.push({
          source: source as "body" | "params" | "query",
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        });
      }
    }
  }
}

interface Schemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Record<string, ZodError> = {};

    for (const [key, schema] of Object.entries(schemas)) {
      if (!schema) continue;
      const source = key as keyof Schemas;
      const result = schema.safeParse(req[source]);
      if (result.success) {
        (req as any)[source] = result.data;
      } else {
        errors[source] = result.error;
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(new ValidationError(errors));
    }

    next();
  };
}
```

This middleware parses and replaces the raw request data with validated, typed data. Downstream handlers can trust the shape of `req.body`, `req.params`, and `req.query` without additional checks.
