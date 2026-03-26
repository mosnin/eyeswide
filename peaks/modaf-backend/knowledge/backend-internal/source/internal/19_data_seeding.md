# Data Seeding & Test Factories

> **TL;DR:** Use system seeds for production-critical data, development seeds for realistic local data, and test factories with the builder pattern for deterministic, isolated test data.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** Database seeding, local development setup, and automated test suites

---

## Seed Categories

All seed data falls into one of three categories, each with different rules for when it runs, what it contains, and how it behaves.

| Category | Runs In | Idempotent | Deterministic | Volume |
|---|---|---|---|---|
| System seeds | All environments | Yes (required) | Yes | Minimal |
| Development seeds | Local/staging only | Yes (recommended) | Yes | Moderate (50-100 per entity) |
| Test factories | Test suites only | N/A (created per test) | Yes | Per-test (1-10 per entity) |

---

## System Seeds

System seeds create data that the application requires to function. Without this data, the app will fail to start or operate correctly.

### Rules

- **Run on every environment:** dev, staging, production
- **Idempotent:** safe to run multiple times without creating duplicates (use upsert or check-before-insert)
- **Minimal:** only include what is strictly required for the application to boot and operate
- **Version-controlled:** seed files are committed alongside the code that depends on them
- **Ordered:** seeds declare dependencies and run in the correct order (roles before users, permissions before roles)

### What Goes in System Seeds

- Default roles (admin, member, viewer)
- System permissions and their role assignments
- Application configuration records (feature flags with defaults, system settings)
- The initial admin account (with a placeholder password that must be changed)
- Required lookup tables (countries, currencies, timezones -- if not hardcoded)
- Default notification templates

### Example: System Seed

```typescript
// prisma/seeds/system/roles.seed.ts
import { PrismaClient } from "@prisma/client";

const DEFAULT_ROLES = [
  {
    slug: "admin",
    name: "Administrator",
    description: "Full system access",
    isSystem: true,
  },
  {
    slug: "member",
    name: "Member",
    description: "Standard member access",
    isSystem: true,
  },
  {
    slug: "viewer",
    name: "Viewer",
    description: "Read-only access",
    isSystem: true,
  },
];

export async function seedRoles(prisma: PrismaClient) {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log(`  Seeded ${DEFAULT_ROLES.length} system roles`);
}
```

```typescript
// prisma/seeds/system/admin.seed.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth";

export async function seedAdminUser(prisma: PrismaClient) {
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "admin" },
  });

  await prisma.user.upsert({
    where: { email: "admin@system.local" },
    update: {},
    create: {
      email: "admin@system.local",
      name: "System Admin",
      password: await hashPassword(
        process.env.ADMIN_INITIAL_PASSWORD || "change-me-immediately"
      ),
      roleId: adminRole.id,
      emailVerified: true,
    },
  });
  console.log("  Seeded admin user");
}
```

---

## Development Seeds

Development seeds create realistic sample data so developers can work with a populated database locally. They should give the feeling of a real application with real usage.

### Rules

- **Realistic data:** use real-sounding names, emails, and content (not "test1," "asdf," "foo")
- **Sufficient volume:** 50-100 records per major entity to test pagination, search, and filtering
- **Relationships maintained:** users belong to organizations, posts belong to users, comments belong to posts -- the object graph is valid
- **Deterministic:** use a seeded random number generator so the same seed produces the same data every time, making debugging reproducible
- **Quick to run:** the full dev seed should complete in under 30 seconds
- **Never run in production:** guarded by environment check

### Example: Development Seed

```typescript
// prisma/seeds/dev/users.seed.ts
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { hashPassword } from "../../../src/lib/auth";

// Seed faker for deterministic output
faker.seed(42);

const USER_COUNT = 75;

export async function seedDevUsers(prisma: PrismaClient) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seeds must not run in production");
  }

  const memberRole = await prisma.role.findUniqueOrThrow({
    where: { slug: "member" },
  });

  const password = await hashPassword("dev-password-123");

  const users = Array.from({ length: USER_COUNT }, (_, i) => ({
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    password,
    roleId: memberRole.id,
    emailVerified: faker.datatype.boolean(0.8), // 80% verified
    createdAt: faker.date.past({ years: 1 }),
    bio: faker.datatype.boolean(0.6) ? faker.lorem.paragraph() : null,
  }));

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  console.log(`  Seeded ${USER_COUNT} development users`);
}
```

```typescript
// prisma/seeds/dev/organizations.seed.ts
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

faker.seed(42);

export async function seedDevOrganizations(prisma: PrismaClient) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seeds must not run in production");
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const ORG_COUNT = 10;

  for (let i = 0; i < ORG_COUNT; i++) {
    const org = await prisma.organization.create({
      data: {
        name: faker.company.name(),
        slug: faker.helpers.slugify(faker.company.name()).toLowerCase() + `-${i}`,
        plan: faker.helpers.arrayElement(["free", "pro", "enterprise"]),
        createdAt: faker.date.past({ years: 1 }),
      },
    });

    // Assign 5-15 random users to each organization
    const memberCount = faker.number.int({ min: 5, max: 15 });
    const shuffled = faker.helpers.shuffle(users).slice(0, memberCount);

    await prisma.orgMembership.createMany({
      data: shuffled.map((user, idx) => ({
        userId: user.id,
        organizationId: org.id,
        role: idx === 0 ? "owner" : faker.helpers.arrayElement(["admin", "member", "member", "member"]),
        joinedAt: faker.date.past({ years: 1 }),
      })),
      skipDuplicates: true,
    });
  }

  console.log(`  Seeded ${ORG_COUNT} organizations with memberships`);
}
```

---

## Test Factories

Test factories are deterministic data generators used exclusively in automated tests. They produce the minimum viable data needed for each test, with sensible defaults for all fields that can be overridden for the specific scenario under test.

### Core Principles

- **Builder pattern:** `UserFactory.create({ role: "admin" })` -- override only what matters
- **Defaults for all fields:** every field has a reasonable default so tests only specify what is relevant to the assertion
- **Deterministic:** use fixed values or seeded faker; never random data that changes between runs
- **Isolated:** each test creates its own data; no factory call depends on data from a previous test
- **Cleanup:** truncate tables between tests (not after each factory call) for performance

### Simple Factory Function

The most straightforward pattern. A function that returns a database record with defaults.

```typescript
// tests/factories/user.factory.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth";

const prisma = new PrismaClient();

let userCounter = 0;

interface CreateUserOptions {
  email?: string;
  name?: string;
  password?: string;
  role?: string;
  emailVerified?: boolean;
  orgId?: string;
}

export async function createUser(overrides: CreateUserOptions = {}) {
  userCounter++;
  const defaults = {
    email: `test-user-${userCounter}@test.local`,
    name: `Test User ${userCounter}`,
    password: await hashPassword("test-password"),
    role: "member",
    emailVerified: true,
  };

  const data = { ...defaults, ...overrides };

  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      password: data.password,
      emailVerified: data.emailVerified,
      role: { connect: { slug: data.role } },
      ...(data.orgId
        ? { memberships: { create: { organizationId: data.orgId, role: "member" } } }
        : {}),
    },
    include: { role: true, memberships: true },
  });
}
```

### Builder Class Pattern

For more complex entities where you need chained configuration.

```typescript
// tests/factories/user.builder.ts
import { PrismaClient, User } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth";

const prisma = new PrismaClient();

let counter = 0;

export class UserBuilder {
  private data: Record<string, any> = {};
  private relations: Record<string, any> = {};

  constructor() {
    counter++;
    this.data = {
      email: `builder-user-${counter}@test.local`,
      name: `Builder User ${counter}`,
      password: "hashed-later",
      emailVerified: true,
    };
    this.relations.role = "member";
  }

  withEmail(email: string) {
    this.data.email = email;
    return this;
  }

  withName(name: string) {
    this.data.name = name;
    return this;
  }

  withRole(role: string) {
    this.relations.role = role;
    return this;
  }

  asAdmin() {
    this.relations.role = "admin";
    return this;
  }

  unverified() {
    this.data.emailVerified = false;
    return this;
  }

  inOrg(orgId: string, orgRole: string = "member") {
    this.relations.org = { orgId, orgRole };
    return this;
  }

  async build(): Promise<User> {
    this.data.password = await hashPassword("test-password");

    return prisma.user.create({
      data: {
        ...this.data,
        role: { connect: { slug: this.relations.role } },
        ...(this.relations.org
          ? {
              memberships: {
                create: {
                  organizationId: this.relations.org.orgId,
                  role: this.relations.org.orgRole,
                },
              },
            }
          : {}),
      },
      include: { role: true, memberships: true },
    });
  }
}

// Usage:
// const admin = await new UserBuilder().asAdmin().build();
// const orgMember = await new UserBuilder().inOrg(org.id, "admin").build();
```

### Trait Pattern

Predefined configurations for common scenarios.

```typescript
// tests/factories/user.traits.ts

export class UserFactory {
  static create(overrides: CreateUserOptions = {}) {
    return createUser(overrides);
  }

  static admin(overrides: CreateUserOptions = {}) {
    return createUser({ role: "admin", ...overrides });
  }

  static viewer(overrides: CreateUserOptions = {}) {
    return createUser({ role: "viewer", ...overrides });
  }

  static unverified(overrides: CreateUserOptions = {}) {
    return createUser({ emailVerified: false, ...overrides });
  }

  static withSubscription(overrides: CreateUserOptions = {}) {
    // Creates a user and also creates a related subscription record
    return createUserWithSubscription({ plan: "pro", ...overrides });
  }
}

// Usage in tests:
// const admin = await UserFactory.admin();
// const unverified = await UserFactory.unverified({ name: "Pending User" });
```

### Related Data Factory

Create an entire object graph in one call.

```typescript
// tests/factories/org-with-members.factory.ts

interface OrgSetupOptions {
  memberCount?: number;
  plan?: string;
  orgName?: string;
}

export async function createOrgWithMembers(options: OrgSetupOptions = {}) {
  const { memberCount = 3, plan = "pro", orgName } = options;

  const org = await prisma.organization.create({
    data: {
      name: orgName || `Test Org ${Date.now()}`,
      slug: `test-org-${Date.now()}`,
      plan,
    },
  });

  const owner = await createUser({ orgId: org.id });
  await prisma.orgMembership.update({
    where: {
      userId_organizationId: { userId: owner.id, organizationId: org.id },
    },
    data: { role: "owner" },
  });

  const members = [];
  for (let i = 0; i < memberCount - 1; i++) {
    members.push(await createUser({ orgId: org.id }));
  }

  return { org, owner, members };
}

// Usage:
// const { org, owner, members } = await createOrgWithMembers({ memberCount: 5 });
```

---

## Test Cleanup

Truncate all tables between tests for isolation. Do not delete records individually after each factory call -- that is slow and error-prone.

```typescript
// tests/helpers/cleanup.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES_TO_TRUNCATE = [
  "org_memberships",
  "users",
  "organizations",
  "roles",
  "permissions",
];

export async function cleanDatabase() {
  // Disable foreign key checks, truncate, re-enable
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(", ")} CASCADE;
  `);
}

// In test setup:
// beforeEach(async () => {
//   await cleanDatabase();
//   await seedSystemData(); // re-seed roles, permissions
// });
```

---

## Seed Runner

### File Structure

```
prisma/
  seeds/
    system/
      roles.seed.ts
      permissions.seed.ts
      admin.seed.ts
      config.seed.ts
      index.ts          # exports all system seeds in order
    dev/
      users.seed.ts
      organizations.seed.ts
      projects.seed.ts
      activities.seed.ts
      index.ts          # exports all dev seeds in order
    runner.ts           # main entry point
tests/
  factories/
    user.factory.ts
    org.factory.ts
    project.factory.ts
    helpers/
      cleanup.ts
      setup.ts
```

### Canonical Seed Runner

```typescript
// prisma/seeds/runner.ts
import { PrismaClient } from "@prisma/client";
import { seedRoles } from "./system/roles.seed";
import { seedPermissions } from "./system/permissions.seed";
import { seedAdminUser } from "./system/admin.seed";
import { seedConfig } from "./system/config.seed";
import { seedDevUsers } from "./dev/users.seed";
import { seedDevOrganizations } from "./dev/organizations.seed";
import { seedDevProjects } from "./dev/projects.seed";

const prisma = new PrismaClient();

type SeedMode = "system" | "dev" | "all";

async function main() {
  const mode: SeedMode = (process.argv[2] as SeedMode) || "all";

  console.log(`Running seeds in mode: ${mode}`);
  console.log("---");

  // System seeds always run first
  if (mode === "system" || mode === "all") {
    console.log("[System Seeds]");
    await seedRoles(prisma);
    await seedPermissions(prisma);
    await seedAdminUser(prisma);
    await seedConfig(prisma);
    console.log("System seeds complete.\n");
  }

  // Development seeds only in non-production
  if ((mode === "dev" || mode === "all") && process.env.NODE_ENV !== "production") {
    console.log("[Development Seeds]");
    await seedDevUsers(prisma);
    await seedDevOrganizations(prisma);
    await seedDevProjects(prisma);
    console.log("Development seeds complete.\n");
  }

  if (mode === "dev" && process.env.NODE_ENV === "production") {
    console.error("ERROR: Cannot run development seeds in production.");
    process.exit(1);
  }

  console.log("---");
  console.log("All seeds complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### package.json Scripts

```json
{
  "scripts": {
    "seed": "tsx prisma/seeds/runner.ts all",
    "seed:system": "tsx prisma/seeds/runner.ts system",
    "seed:dev": "tsx prisma/seeds/runner.ts dev",
    "seed:reset": "prisma migrate reset && npm run seed",
    "db:fresh": "prisma migrate reset --force && npm run seed"
  }
}
```

---

## Best Practices Summary

1. **System seeds are sacred.** They must be idempotent, minimal, and safe for production.
2. **Development seeds are disposable.** Reset them freely; they exist to make local development productive.
3. **Test factories are isolated.** Each test owns its data; never share state between tests.
4. **Determinism is non-negotiable.** Seed faker, use counters, avoid `Date.now()` in factory defaults.
5. **Speed matters.** Use `createMany` for bulk inserts. Keep the full seed under 30 seconds.
6. **Cleanup between tests.** Truncate tables, do not delete individual records.
7. **Guard against production.** Development seeds must check `NODE_ENV` and refuse to run in production.
