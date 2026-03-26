# Phase 8: Testing

## Purpose

Establish comprehensive test coverage across the backend to catch regressions early, validate business logic correctness, and provide confidence when refactoring or deploying. Testing is not an afterthought -- it is a first-class engineering discipline that directly determines the reliability of the system.

By the end of this phase, every service, validator, API endpoint, and critical user flow must have corresponding tests. The test suite must run automatically on every pull request and block merging when failures occur.

---

## Testing Pyramid

The testing strategy follows the classic testing pyramid, weighted toward fast, isolated unit tests at the base and fewer, slower end-to-end tests at the top.

### Unit Tests (70% of total test count)

Unit tests target pure business logic in complete isolation. They are fast (milliseconds each), deterministic, and never touch external systems like databases or network services.

**What to unit test:**
- Service methods (with mocked repositories/dependencies)
- Validators and schema definitions (valid inputs, invalid inputs, edge cases)
- Utility functions (formatters, parsers, calculators, transformers)
- Domain model methods and computed properties
- Authorization logic (permission checks, role evaluations)
- Error construction and error message formatting

### Integration Tests (20% of total test count)

Integration tests verify that components work together correctly. They use a real test database, exercise actual HTTP endpoints, and validate the full request-response cycle through middleware, controllers, services, and data access layers.

**What to integration test:**
- API endpoint request/response contracts
- Database queries and repository methods against real data
- Authentication and authorization flows end-to-end
- Middleware behavior (rate limiting, validation, error handling)
- External service interactions (via mocked HTTP responses)

### E2E Tests (10% of total test count)

End-to-end tests exercise critical user flows that span multiple endpoints and state changes. They simulate real user behavior and validate that the system works as a whole.

**What to E2E test:**
- Signup -> email verification -> login -> access protected resource
- CRUD lifecycle for core entities (create -> list -> read -> update -> delete)
- Payment or billing flows (if applicable)
- Any flow where a failure would constitute a critical business incident

---

## Unit Testing

### Structure and Naming

Organize unit tests to mirror the source directory structure. Every file at `src/services/user.service.ts` should have a corresponding test at `src/services/__tests__/user.service.test.ts` or `tests/unit/services/user.service.test.ts` depending on project convention.

Use descriptive, behavior-oriented naming:

```
describe("UserService", () => {
  describe("createUser", () => {
    it("should create a user when valid input is provided", async () => { ... });
    it("should throw ValidationError when email is already taken", async () => { ... });
    it("should hash the password before storing", async () => { ... });
    it("should assign the default role when no role is specified", async () => { ... });
  });

  describe("deactivateUser", () => {
    it("should set isActive to false when user exists", async () => { ... });
    it("should throw NotFoundError when user does not exist", async () => { ... });
    it("should revoke all active sessions on deactivation", async () => { ... });
  });
});
```

### Mocking Strategy

Mock all external dependencies at the boundary. Services receive repositories via dependency injection, so tests can supply mock implementations.

```
// Create mock repository
const mockUserRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Inject into service
const userService = new UserService(mockUserRepo, mockEmailService);

// Configure mock behavior per test
mockUserRepo.findByEmail.mockResolvedValue(null); // email not taken
mockUserRepo.create.mockResolvedValue({ id: "usr_123", email: "test@example.com" });
```

**Rules for mocking:**
- Never mock the unit under test itself
- Mock at the nearest boundary (repository, external client, event emitter)
- Prefer explicit mock return values over auto-mocking
- Assert that mocks were called with expected arguments, not just that the function returned correctly

### Testing Validators

Validators deserve thorough testing because they are the front line of defense against bad data.

```
describe("CreateUserValidator", () => {
  it("should accept valid input", () => { ... });
  it("should reject when email is missing", () => { ... });
  it("should reject when email format is invalid", () => { ... });
  it("should reject when password is shorter than 8 characters", () => { ... });
  it("should reject when password has no uppercase letter", () => { ... });
  it("should reject when name exceeds 200 characters", () => { ... });
  it("should trim whitespace from string fields", () => { ... });
  it("should reject unexpected additional fields in strict mode", () => { ... });
});
```

Test every validation rule, every boundary condition (min length, max length, exact boundary), and every error message.

### Testing Utilities

Utility functions are typically pure functions and the easiest to test. Cover normal cases, edge cases, and error cases.

```
describe("slugify", () => {
  it("should convert spaces to hyphens", () => { ... });
  it("should lowercase all characters", () => { ... });
  it("should remove special characters", () => { ... });
  it("should handle empty string input", () => { ... });
  it("should collapse consecutive hyphens", () => { ... });
  it("should trim leading and trailing hyphens", () => { ... });
});
```

---

## Integration Testing

### API Endpoint Testing

Each endpoint needs tests for the happy path, validation failures, authentication/authorization failures, and not-found scenarios.

```
describe("POST /api/v1/users", () => {
  it("should return 201 and the created user on valid input", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "new@example.com", password: "SecurePass1!", name: "Test" });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.email).toBe("new@example.com");
  });

  it("should return 400 when email is missing", async () => { ... });
  it("should return 401 when no auth token is provided", async () => { ... });
  it("should return 403 when non-admin attempts to create a user", async () => { ... });
  it("should return 409 when email already exists", async () => { ... });
});
```

### Auth Flow Testing

Test the complete authentication lifecycle as an integration test:

```
describe("Authentication Flow", () => {
  it("should allow signup, login, and access to protected routes", async () => {
    // 1. Sign up
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "flow@test.com", password: "SecurePass1!", name: "Flow" });
    expect(signupRes.status).toBe(201);

    // 2. Log in
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "flow@test.com", password: "SecurePass1!" });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.accessToken;

    // 3. Access protected route
    const protectedRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body.data.email).toBe("flow@test.com");
  });
});
```

### CRUD Operation Testing

For every resource, test the full create-read-update-delete cycle:

```
describe("Projects CRUD", () => {
  let projectId: string;

  it("should create a project", async () => {
    const res = await authedRequest("POST", "/api/v1/projects", { name: "Test Project" });
    expect(res.status).toBe(201);
    projectId = res.body.data.id;
  });

  it("should read the created project", async () => {
    const res = await authedRequest("GET", `/api/v1/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Test Project");
  });

  it("should update the project", async () => {
    const res = await authedRequest("PATCH", `/api/v1/projects/${projectId}`, { name: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated");
  });

  it("should delete the project", async () => {
    const res = await authedRequest("DELETE", `/api/v1/projects/${projectId}`);
    expect(res.status).toBe(204);
  });

  it("should return 404 after deletion", async () => {
    const res = await authedRequest("GET", `/api/v1/projects/${projectId}`);
    expect(res.status).toBe(404);
  });
});
```

### Pagination, Filtering, and Sorting

```
describe("GET /api/v1/users (list)", () => {
  beforeAll(async () => {
    // Seed 25 users via test factories
    await factory.createMany("user", 25);
  });

  it("should return paginated results with default page size", async () => {
    const res = await authedRequest("GET", "/api/v1/users");
    expect(res.body.data.length).toBe(20); // default page size
    expect(res.body.meta.total).toBe(25);
    expect(res.body.meta.page).toBe(1);
  });

  it("should return second page when page=2", async () => {
    const res = await authedRequest("GET", "/api/v1/users?page=2");
    expect(res.body.data.length).toBe(5);
  });

  it("should filter by status", async () => { ... });
  it("should sort by createdAt descending", async () => { ... });
  it("should combine filtering and sorting", async () => { ... });
});
```

---

## Test Infrastructure

### Test Database Setup and Teardown

Use a dedicated test database that is structurally identical to the development database but isolated.

**Setup strategy:**
1. Before the entire test suite: run all migrations on the test database
2. Before each test file or describe block: truncate all tables (fast) or use transactions that roll back
3. After the entire test suite: drop the test database or leave it for debugging

```
// test/setup.ts
beforeAll(async () => {
  await runMigrations(testDatabaseUrl);
});

afterEach(async () => {
  await truncateAllTables(testDatabaseUrl);
});

afterAll(async () => {
  await closeConnection();
});
```

Prefer truncation over dropping/recreating because it is significantly faster. If using transactions for isolation, wrap each test in a transaction and roll back at the end -- this is the fastest approach but requires care with tests that inspect committed data.

### Test Factories

Test factories generate realistic, deterministic test data. They eliminate the fragility of hard-coded test fixtures and make tests self-documenting.

```
// test/factories/user.factory.ts
import { faker } from "@faker-js/faker";

let sequence = 0;

export function buildUser(overrides: Partial<UserInput> = {}): UserInput {
  sequence++;
  return {
    email: `user-${sequence}@test.com`,
    password: "TestPassword1!",
    name: faker.person.fullName(),
    role: "member",
    ...overrides,
  };
}

export async function createUser(overrides: Partial<UserInput> = {}): Promise<User> {
  const input = buildUser(overrides);
  return await userRepository.create(input);
}

export async function createMany(count: number, overrides: Partial<UserInput> = {}): Promise<User[]> {
  return Promise.all(Array.from({ length: count }, () => createUser(overrides)));
}
```

**Factory guidelines:**
- Use deterministic sequences (not random UUIDs) for reproducible tests
- Use faker for realistic-looking but non-sensitive data
- Support overrides so individual tests can customize specific fields
- Provide both `build` (in-memory object) and `create` (persisted to database) variants

### API Test Client

Wrap your HTTP testing library with helpers for authentication and common patterns:

```
// test/helpers/api.ts
import supertest from "supertest";
import { app } from "../../src/app";

const api = supertest(app);

export async function authedRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  token?: string
) {
  const resolvedToken = token ?? (await getTestAdminToken());
  const req = api[method.toLowerCase()](path)
    .set("Authorization", `Bearer ${resolvedToken}`)
    .set("Accept", "application/json");

  if (body) req.send(body);
  return req;
}

let cachedAdminToken: string | null = null;

async function getTestAdminToken(): Promise<string> {
  if (cachedAdminToken) return cachedAdminToken;
  const admin = await createUser({ role: "admin" });
  const loginRes = await api.post("/api/v1/auth/login").send({
    email: admin.email,
    password: "TestPassword1!",
  });
  cachedAdminToken = loginRes.body.data.accessToken;
  return cachedAdminToken;
}
```

### Mocking External Services

External HTTP calls must be intercepted and mocked so tests remain fast and deterministic.

**Using MSW (Mock Service Worker):**

```
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.post("https://api.sendgrid.com/v3/mail/send", () => {
    return HttpResponse.json({ statusCode: 202 });
  }),
  http.post("https://api.stripe.com/v1/charges", () => {
    return HttpResponse.json({ id: "ch_test_123", status: "succeeded" });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Setting `onUnhandledRequest: "error"` ensures that any unmocked external call causes the test to fail, preventing accidental real network requests.

### Environment Setup

Maintain a `.env.test` file (committed to the repo with safe values) that configures the test environment:

```
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/modaf_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-do-not-use-in-production
LOG_LEVEL=silent
RATE_LIMIT_ENABLED=false
```

Load this file before any test runs, either via a test setup script or a jest/vitest `globalSetup` module.

---

## CI Integration

### Pipeline Configuration

Tests must run on every pull request. The CI pipeline should:

1. **Provision services**: start a test database (PostgreSQL) and Redis via service containers
2. **Install dependencies**: `npm ci` for deterministic installs
3. **Run migrations**: apply all database migrations to the test database
4. **Run linting**: fail fast on code style violations before tests
5. **Run unit tests**: `npm run test:unit` with coverage reporting
6. **Run integration tests**: `npm run test:integration` with coverage reporting
7. **Upload coverage**: send coverage report to Codecov, Coveralls, or similar
8. **Enforce thresholds**: fail the build if coverage drops below configured minimums

```yaml
# .github/workflows/test.yml
name: Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: modaf_test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run lint
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration -- --coverage
      - run: npm run test:coverage:check
```

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:coverage:check": "vitest run --coverage --coverage.thresholds.lines=80"
  }
}
```

---

## Deliverables

At the completion of Phase 8, the following must exist:

1. **Test setup and configuration**: vitest/jest config files, global setup/teardown scripts, environment configuration
2. **Test factories**: factory functions for every core domain entity (User, Project, and all others) with both `build` and `create` variants
3. **API test helpers**: authenticated request helper, token caching, response assertion utilities
4. **Unit tests**: covering all service methods, validators, and utility functions
5. **Integration tests**: covering all API endpoints (happy path, error cases, auth, pagination)
6. **External service mocks**: MSW or equivalent handlers for all external API calls
7. **CI configuration**: GitHub Actions (or equivalent) workflow that runs the full test suite on every PR

---

## Validation Gate

Phase 8 is complete when all of the following criteria are met:

- All unit tests pass with zero failures
- All integration tests pass with zero failures
- Code coverage for service layer is at or above **80%**
- Code coverage for validators is at or above **90%**
- Code coverage for utility functions is at or above **85%**
- CI pipeline runs tests automatically on every pull request
- CI pipeline fails and blocks merge when any test fails
- CI pipeline fails and blocks merge when coverage drops below thresholds
- Test factories exist for all core domain entities
- No test relies on external network calls (all external services are mocked)
- Tests are deterministic (running the suite twice produces the same result)
- Test suite completes in under 5 minutes for unit tests, under 15 minutes total
