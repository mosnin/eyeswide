# Service Layer Architecture

> **TL;DR:** Business logic lives exclusively in the service layer; controllers handle HTTP, repositories handle SQL, and services orchestrate everything in between.

**Category:** Backend Internal Reference
**Last Updated:** 2026-03-26
**Status:** Active
**Applies To:** All backend modules and API services

---

## Layer Responsibilities

The backend follows a strict four-layer architecture. Each layer has a single responsibility and communicates only with its immediate neighbors.

### Router / Controller

The controller is the HTTP boundary. It is responsible for:

- Parsing HTTP requests (body, params, query, headers, cookies)
- Calling the appropriate service method
- Formatting the HTTP response (status code, headers, body shape)
- Handling HTTP-specific concerns (content negotiation, redirects)

The controller must **never** contain business logic, database queries, or direct calls to external services.

```typescript
// /controllers/user.controller.ts

import { Request, Response } from "express";
import { UserService } from "@/services/user.service";

export class UserController {
  constructor(private userService: UserService) {}

  async create(req: Request, res: Response) {
    const user = await this.userService.create(req.body);
    res.status(201).json({ data: user });
  }

  async findById(req: Request, res: Response) {
    const user = await this.userService.findById(req.params.userId);
    res.status(200).json({ data: user });
  }

  async list(req: Request, res: Response) {
    const result = await this.userService.findMany(req.query);
    res.status(200).json({ data: result.items, meta: result.meta });
  }

  async update(req: Request, res: Response) {
    const user = await this.userService.update(req.params.userId, req.body);
    res.status(200).json({ data: user });
  }

  async delete(req: Request, res: Response) {
    await this.userService.delete(req.params.userId);
    res.status(204).send();
  }
}
```

### Service

The service layer is where all business logic lives. It is responsible for:

- Enforcing business rules and invariants
- Orchestrating calls to one or more repositories
- Managing database transactions
- Emitting domain events
- Calling external services (email, payment, etc.)
- Authorization checks (does the current user have permission?)

```typescript
// The service DOES:
await this.userRepo.findById(id);         // delegate to repository
await this.emailService.sendWelcome(user); // coordinate with other services
await this.eventBus.emit("user.created", user); // emit events

// The service DOES NOT:
res.status(200).json(user);  // NO -- that is the controller's job
db.query("SELECT * FROM...");  // NO -- that is the repository's job
```

### Repository

The repository is the data access boundary. It is responsible for:

- Constructing and executing database queries
- Mapping database rows to domain objects
- Handling query building, joins, and aggregations
- Abstracting the specific database or ORM in use

The repository must **never** contain business logic, HTTP concerns, or calls to external services.

```typescript
// The repository DOES:
return db.select().from(users).where(eq(users.id, id));

// The repository DOES NOT:
if (user.role !== "admin") throw new ForbiddenError();  // NO -- business logic
await emailService.send(...);  // NO -- side effects
```

### Model / Entity

The model defines the data shape and computed properties. It does not perform I/O.

```typescript
// /models/user.model.ts

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | "viewer";
  createdAt: Date;
  updatedAt: Date;
}

// Computed properties can live as pure functions
export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

export function displayName(user: User): string {
  return user.name || user.email.split("@")[0];
}
```

---

## Dependency Injection

### Constructor Injection Pattern

The simplest and most common approach. Dependencies are passed to the constructor and stored as private members.

```typescript
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService,
    private eventBus: EventBus
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const user = await this.userRepo.create(input);
    await this.emailService.sendWelcome(user);
    this.eventBus.emit("user.created", user);
    return user;
  }
}

// Wiring (in the composition root)
const userRepo = new UserRepository(db);
const emailService = new EmailService(mailer);
const eventBus = new EventBus();
const userService = new UserService(userRepo, emailService, eventBus);
```

### Factory Function Pattern

For simpler services or when you want to avoid classes entirely, use factory functions that close over dependencies.

```typescript
export function createUserService(deps: {
  userRepo: UserRepository;
  emailService: EmailService;
  eventBus: EventBus;
}) {
  return {
    async create(input: CreateUserInput): Promise<User> {
      const user = await deps.userRepo.create(input);
      await deps.emailService.sendWelcome(user);
      deps.eventBus.emit("user.created", user);
      return user;
    },

    async findById(id: string): Promise<User> {
      const user = await deps.userRepo.findById(id);
      if (!user) throw new NotFoundError("User", id);
      return user;
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
```

### Dependency Container (Larger Apps)

For applications with many services and deep dependency graphs, use a lightweight container.

```typescript
// /lib/container.ts

import { asClass, asFunction, createContainer, InjectionMode } from "awilix";

const container = createContainer({ injectionMode: InjectionMode.CLASSIC });

container.register({
  // Repositories
  userRepo: asClass(UserRepository).singleton(),
  projectRepo: asClass(ProjectRepository).singleton(),

  // Services
  userService: asClass(UserService).scoped(),
  projectService: asClass(ProjectService).scoped(),
  emailService: asClass(EmailService).singleton(),

  // Infrastructure
  db: asFunction(() => createDbPool()).singleton(),
  eventBus: asClass(EventBus).singleton(),
  cache: asClass(RedisCache).singleton(),
});

export { container };
```

---

## Service Patterns

### CRUD Service Base

Define a base that provides standard operations. Resource-specific services extend it with custom business logic.

```typescript
// /services/base.service.ts

export abstract class BaseCrudService<T, CreateInput, UpdateInput> {
  constructor(protected repo: BaseRepository<T>) {}

  async create(input: CreateInput): Promise<T> {
    await this.beforeCreate(input);
    const entity = await this.repo.create(input);
    await this.afterCreate(entity);
    return entity;
  }

  async findById(id: string): Promise<T> {
    const entity = await this.repo.findById(id);
    if (!entity) throw new NotFoundError(this.resourceName, id);
    return entity;
  }

  async findMany(query: PaginationQuery): Promise<PaginatedResult<T>> {
    return this.repo.findMany(query);
  }

  async update(id: string, input: UpdateInput): Promise<T> {
    const existing = await this.findById(id);
    await this.beforeUpdate(existing, input);
    const updated = await this.repo.update(id, input);
    await this.afterUpdate(updated, existing);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    await this.beforeDelete(existing);
    await this.repo.delete(id);
    await this.afterDelete(existing);
  }

  // Hooks -- override in subclasses
  protected abstract get resourceName(): string;
  protected async beforeCreate(_input: CreateInput): Promise<void> {}
  protected async afterCreate(_entity: T): Promise<void> {}
  protected async beforeUpdate(_existing: T, _input: UpdateInput): Promise<void> {}
  protected async afterUpdate(_updated: T, _previous: T): Promise<void> {}
  protected async beforeDelete(_entity: T): Promise<void> {}
  protected async afterDelete(_entity: T): Promise<void> {}
}
```

### Service Hooks

Hooks allow resource-specific services to inject behavior at well-defined points without overriding the core CRUD methods.

```typescript
// /services/user.service.ts

export class UserService extends BaseCrudService<User, CreateUserInput, UpdateUserInput> {
  protected get resourceName() {
    return "User";
  }

  constructor(
    userRepo: UserRepository,
    private emailService: EmailService,
    private eventBus: EventBus
  ) {
    super(userRepo);
  }

  protected async beforeCreate(input: CreateUserInput): Promise<void> {
    const existing = await (this.repo as UserRepository).findByEmail(input.email);
    if (existing) throw new ConflictError("A user with this email already exists");
  }

  protected async afterCreate(user: User): Promise<void> {
    await this.emailService.sendWelcome(user);
    this.eventBus.emit("user.created", { userId: user.id });
  }

  protected async afterUpdate(updated: User, previous: User): Promise<void> {
    if (updated.role !== previous.role) {
      this.eventBus.emit("user.role_changed", {
        userId: updated.id,
        from: previous.role,
        to: updated.role,
      });
    }
  }

  protected async beforeDelete(user: User): Promise<void> {
    if (user.role === "admin") {
      const adminCount = await (this.repo as UserRepository).countByRole("admin");
      if (adminCount <= 1) throw new BusinessRuleError("Cannot delete the last admin");
    }
  }
}
```

### Service Composition

Services may call other services, but the dependency graph must be acyclic. Use a clear rule: **higher-level services depend on lower-level services, never the reverse**.

```typescript
// UserService calls EmailService -- OK
// EmailService calls UserService -- FORBIDDEN (circular)

// If EmailService needs user data, it receives it as a parameter:
class EmailService {
  async sendWelcome(user: { email: string; name: string }): Promise<void> {
    // Uses the user data passed in, does not look it up
  }
}
```

### Circular Dependency Prevention

When two services genuinely need to react to each other's state changes, use domain events instead of direct calls.

```typescript
// Instead of: ProjectService → UserService → ProjectService (circular)

// ProjectService emits an event:
this.eventBus.emit("project.member_removed", { projectId, userId });

// UserService listens for the event:
eventBus.on("project.member_removed", async ({ userId }) => {
  await userService.recalculatePermissions(userId);
});
```

---

## Transaction Management

Transactions are started in the service layer and passed down to repository methods. The repository never starts its own transactions.

```typescript
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private inventoryRepo: InventoryRepository,
    private paymentRepo: PaymentRepository,
    private db: Database
  ) {}

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    return this.db.transaction(async (tx) => {
      // All repo calls receive the transaction
      const order = await this.orderRepo.create(input, tx);

      for (const item of input.items) {
        await this.inventoryRepo.decrementStock(item.productId, item.quantity, tx);
      }

      await this.paymentRepo.createCharge(order.id, input.paymentMethod, tx);

      return order;
    });
    // Transaction commits on success, rolls back on any thrown error
  }
}
```

### Nested Transactions with Savepoints

When a service method that uses a transaction calls another service method that also uses a transaction, use savepoints to allow partial rollback.

```typescript
export class Database {
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    // If already inside a transaction, create a savepoint instead
    if (this.currentTransaction) {
      const savepoint = await this.currentTransaction.savepoint();
      try {
        const result = await fn(this.currentTransaction);
        await savepoint.release();
        return result;
      } catch (error) {
        await savepoint.rollback();
        throw error;
      }
    }

    // Otherwise, start a new transaction
    const tx = await this.pool.beginTransaction();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
}
```

---

## Domain Events

Domain events decouple side effects from core business logic. The service emits an event after a state change, and independent handlers react to it.

### Emitting Events

```typescript
// In the service layer, after the primary operation succeeds
async create(input: CreateUserInput): Promise<User> {
  const user = await this.userRepo.create(input);

  // Emit AFTER the database write succeeds
  this.eventBus.emit("user.created", {
    userId: user.id,
    email: user.email,
    timestamp: new Date(),
  });

  return user;
}
```

### Event Handlers

```typescript
// /events/handlers/user.handlers.ts

export function registerUserEventHandlers(eventBus: EventBus, deps: Dependencies) {
  // Send welcome email
  eventBus.on("user.created", async (payload) => {
    await deps.emailService.sendWelcome(payload.email);
  });

  // Update search index
  eventBus.on("user.created", async (payload) => {
    await deps.searchService.indexUser(payload.userId);
  });

  // Invalidate cache
  eventBus.on("user.updated", async (payload) => {
    await deps.cache.delete(`user:${payload.userId}`);
  });

  // Sync to external CRM
  eventBus.on("user.created", async (payload) => {
    await deps.crmService.createContact(payload.userId);
  });
}
```

### Async Event Processing

For reliability, critical events should be published to a durable queue (e.g., Redis Streams, SQS, RabbitMQ) rather than processed in-memory.

```typescript
export class DurableEventBus implements EventBus {
  constructor(private queue: JobQueue) {}

  async emit(event: string, payload: unknown): Promise<void> {
    // Persist the event to a durable queue
    await this.queue.add("domain-events", {
      event,
      payload,
      emittedAt: new Date().toISOString(),
    });
  }
}

// Worker process picks up events from the queue
queue.process("domain-events", async (job) => {
  const { event, payload } = job.data;
  const handlers = eventRegistry.getHandlers(event);
  for (const handler of handlers) {
    await handler(payload);
  }
});
```

---

## Code Organization

```
/controllers/
  user.controller.ts
  project.controller.ts
  organization.controller.ts

/services/
  base.service.ts              # Abstract CRUD base
  user.service.ts
  project.service.ts
  organization.service.ts
  email.service.ts             # Infrastructure service
  notification.service.ts

/repositories/
  base.repository.ts           # Abstract query base
  user.repository.ts
  project.repository.ts
  organization.repository.ts

/models/
  user.model.ts
  project.model.ts
  organization.model.ts

/events/
  event-bus.ts                 # EventBus implementation
  handlers/
    user.handlers.ts
    project.handlers.ts
```

---

## Canonical Repository Class

```typescript
// /repositories/user.repository.ts

import { eq, like, and, desc, asc, SQL } from "drizzle-orm";
import { users } from "@/db/schema";
import { Database, Transaction } from "@/lib/database";
import { User } from "@/models/user.model";
import { PaginatedResult, PaginationQuery } from "@/lib/pagination";

export class UserRepository {
  constructor(private db: Database) {}

  async create(input: CreateUserInput, tx?: Transaction): Promise<User> {
    const conn = tx ?? this.db;
    const [user] = await conn.insert(users).values(input).returning();
    return user;
  }

  async findById(id: string, tx?: Transaction): Promise<User | null> {
    const conn = tx ?? this.db;
    const [user] = await conn.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async findByEmail(email: string, tx?: Transaction): Promise<User | null> {
    const conn = tx ?? this.db;
    const [user] = await conn
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  async findMany(query: PaginationQuery & UserFilters): Promise<PaginatedResult<User>> {
    const conditions: SQL[] = [];

    if (query.role) conditions.push(eq(users.role, query.role));
    if (query.search) conditions.push(like(users.name, `%${query.search}%`));
    if (query.status) conditions.push(eq(users.status, query.status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = query.sortOrder === "asc" ? asc(users.createdAt) : desc(users.createdAt);

    const offset = (query.page - 1) * query.perPage;

    const [items, [{ count }]] = await Promise.all([
      this.db.select().from(users).where(where).orderBy(orderBy).limit(query.perPage).offset(offset),
      this.db.select({ count: sql`count(*)` }).from(users).where(where),
    ]);

    return {
      items,
      meta: {
        total: Number(count),
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(Number(count) / query.perPage),
      },
    };
  }

  async update(id: string, input: Partial<User>, tx?: Transaction): Promise<User> {
    const conn = tx ?? this.db;
    const [updated] = await conn
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async delete(id: string, tx?: Transaction): Promise<void> {
    const conn = tx ?? this.db;
    await conn.delete(users).where(eq(users.id, id));
  }

  async countByRole(role: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.role, role));
    return Number(count);
  }
}
```

This architecture keeps each layer focused, testable, and replaceable. Controllers can be swapped for a different transport (GraphQL, gRPC) without touching business logic. Repositories can be swapped for a different database without touching services. Services remain the stable core where business rules are enforced.
