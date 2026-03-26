# Database Migration Strategy

> **TL;DR:** Migrations are immutable contracts with the database -- never edit an applied migration. Use zero-downtime patterns (add column nullable, backfill, then constrain) and always test migrations on staging before production.

---

**Metadata**

| Field         | Value                          |
|---------------|--------------------------------|
| ID            | `backend-internal-016`         |
| Category      | Database / Operations          |
| Audience      | Backend engineers              |
| Last reviewed | 2026-03-26                     |
| Status        | Active                         |

---

## 1. Migration Philosophy

Migrations are **immutable**. Once a migration has been applied to any shared environment (staging, production, or even a teammate's machine), it must never be edited. If you need to change what a migration did, create a new migration.

Reasons:
- Migration tools track which migrations have run by filename/checksum. Editing a previously-run migration causes checksum mismatches and deploy failures.
- Other developers have already applied the original migration. Editing it silently diverges their database from yours.
- The migration history is your database changelog. Rewriting history destroys auditability.

The only exception: if a migration has **only** been applied to your local database, you may reset and regenerate it during development.

---

## 2. Migration Tools

| Tool            | ORM / Query Builder | Migration Format       | Best For                    |
|-----------------|---------------------|------------------------|-----------------------------|
| Prisma Migrate  | Prisma              | Generated SQL files    | Default for all new projects|
| Drizzle Kit     | Drizzle ORM         | Generated SQL or TS    | Projects using Drizzle      |
| Knex migrations | Knex.js             | Raw SQL via JS/TS      | Legacy or raw-SQL-heavy     |

Prisma Migrate is the default. Use Drizzle Kit if the project uses Drizzle ORM. Use Knex only for legacy projects that already depend on it.

---

## 3. Migration Naming

All migrations follow the pattern:

```
{timestamp}_{description}
```

Examples:
- `20240101120000_create_users_table`
- `20240115093000_add_email_verified_to_users`
- `20240201140000_create_posts_table`
- `20240215110000_add_index_on_posts_created_at`
- `20240301160000_rename_posts_body_to_content`

Rules:
- Timestamp is `YYYYMMDDHHMMSS` in UTC.
- Description uses snake_case.
- Description starts with a verb: `create_`, `add_`, `remove_`, `rename_`, `alter_`, `drop_`, `seed_`.
- Keep descriptions concise but specific enough to understand without opening the file.

---

## 4. Migration Workflow

### 4.1 Development Workflow

```
Step 1: Modify schema
         |
         v
Step 2: Generate migration
         |
         v
Step 3: Review generated SQL  <---- Critical. Never skip this.
         |
         v
Step 4: Test migration (run on local/test database)
         |
         v
Step 5: Commit schema file + migration file together
         |
         v
Step 6: CI runs migration against test database
         |
         v
Step 7: On deploy, migration runs before new application code starts
```

### 4.2 Prisma Commands

```bash
# Generate a new migration (development)
npx prisma migrate dev --name add_email_verified_to_users

# Apply migrations in production/CI (does NOT generate new migrations)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (development only -- destroys all data)
npx prisma migrate reset
```

### 4.3 Drizzle Commands

```bash
# Generate migration from schema diff
npx drizzle-kit generate --name add_email_verified_to_users

# Apply pending migrations
npx drizzle-kit migrate

# View pending migrations
npx drizzle-kit status
```

### 4.4 Review the Generated SQL

Always open the generated SQL file and verify:
- The SQL does what you expect (columns, types, constraints, defaults).
- No unexpected `DROP` statements.
- Indexes are created where needed.
- Foreign keys reference the correct columns.
- No operations that will lock large tables (see section 6).

---

## 5. Zero-Downtime Migration Patterns

The goal: deploy database changes without taking the application offline. This requires careful ordering of schema changes and code deploys.

### 5.1 Add a Column

**Safe pattern:**

1. **Migration 1:** Add the column as **nullable** with no default (or a sensible default).
2. **Deploy code** that writes to the new column but does not require it.
3. **Backfill** existing rows (background job or data migration).
4. **Migration 2:** Add `NOT NULL` constraint (after all rows have values).

```sql
-- Migration 1: Add nullable column
ALTER TABLE users ADD COLUMN email_verified boolean;

-- (Deploy code, backfill data)

-- Migration 2: Add constraint after backfill
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
```

### 5.2 Rename a Column

**Never rename directly** -- Prisma treats a rename as a drop + add, which destroys data.

Safe pattern:

1. **Migration 1:** Add new column.
2. **Deploy code** that writes to both old and new columns, reads from new (with fallback to old).
3. **Backfill** old column values into new column.
4. **Deploy code** that only uses the new column.
5. **Migration 2:** Drop the old column.

```sql
-- Migration 1
ALTER TABLE posts ADD COLUMN content text;

-- (Backfill: UPDATE posts SET content = body WHERE content IS NULL)

-- Migration 2 (after code no longer references 'body')
ALTER TABLE posts DROP COLUMN body;
```

### 5.3 Remove a Column

Safe pattern:

1. **Deploy code** that no longer reads or writes the column.
2. **Migration:** Drop the column.

Never drop a column while code still references it. The deploy must happen first.

```sql
-- Only run after code no longer uses this column
ALTER TABLE users DROP COLUMN legacy_avatar_url;
```

### 5.4 Add a Table

Just add it. New tables have no existing dependencies, so there is no risk.

```sql
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 5.5 Remove a Table

Safe pattern:

1. **Deploy code** that no longer references the table.
2. **Migration 1:** Drop foreign key constraints referencing this table from other tables.
3. **Migration 2:** Drop the table.

### 5.6 Add an Index

Use `CONCURRENTLY` to avoid locking the table (PostgreSQL):

```sql
-- SAFE: does not lock the table for writes
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts (created_at);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Prisma wraps migrations in transactions by default. To use concurrent indexing in Prisma, add the migration manually and mark it with `-- CreateIndex` comment so Prisma runs it outside a transaction.

---

## 6. Dangerous Operations

These operations can cause downtime, data loss, or deploy failures. Always flag them in code review.

| Operation                                     | Risk                                      | Mitigation                                        |
|-----------------------------------------------|-------------------------------------------|---------------------------------------------------|
| `ALTER TABLE ... ADD COLUMN ... NOT NULL`     | Fails if existing rows have no value      | Add as nullable first, backfill, then constrain   |
| `DROP COLUMN`                                 | Data loss; breaks code that references it | Deploy code removal first                         |
| Rename column in Prisma schema                | Prisma generates drop + add = data loss   | Use the two-phase rename pattern                  |
| `ALTER COLUMN ... TYPE`                       | May require data conversion; locks table  | Add new column, backfill, swap, drop old          |
| `DROP TABLE` with foreign key references      | Fails due to FK constraints               | Drop FKs first, then drop table                   |
| `CREATE INDEX` (without CONCURRENTLY)         | Locks table for writes during build       | Always use `CONCURRENTLY`                         |
| Large `UPDATE` in migration                   | Locks many rows, long transaction         | Run as background job in batches                  |
| `TRUNCATE TABLE`                              | Irreversible data loss                    | Almost never appropriate in migrations            |

---

## 7. Rollback Strategy

### 7.1 Down Migrations

Every migration should have a corresponding rollback (down migration). In Prisma, down migrations are not generated automatically -- write them manually in a `down.sql` file alongside the migration.

```sql
-- migration: 20240201_add_posts_table/migration.sql
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- rollback: 20240201_add_posts_table/down.sql
DROP TABLE IF EXISTS posts;
```

In Drizzle or Knex, down migrations are first-class:

```typescript
// Knex example
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('posts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('title').notNullable();
    table.text('body').notNullable();
    table.uuid('author_id').notNullable().references('id').inTable('users');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('posts');
}
```

### 7.2 Rollback Rules

1. **Test rollback in staging** before applying the migration to production.
2. If a rollback fails, **do not force it**. Create a new forward migration to fix the issue.
3. Rollback is not always possible (e.g., after dropping a column -- the data is gone). For these cases, rely on database backups.
4. Keep rollback scripts up to date. Stale rollback scripts are worse than no rollback scripts because they create false confidence.

---

## 8. Data Migrations

Data migrations (backfilling, transforming, cleaning data) are separate from schema migrations.

Rules:
- **Never mix** schema changes and data transformations in the same migration.
- Run data migrations as **background jobs**, not in the deploy pipeline (they may take hours on large tables).
- Make data migrations **idempotent** -- safe to run multiple times.
- Process in **batches** (1000-5000 rows per batch) to avoid long-running transactions and lock contention.

```typescript
// Example: backfill email_verified column
async function backfillEmailVerified() {
  const BATCH_SIZE = 1000;
  let processed = 0;

  while (true) {
    const result = await prisma.$executeRaw`
      UPDATE users
      SET email_verified = false
      WHERE email_verified IS NULL
      AND id IN (
        SELECT id FROM users
        WHERE email_verified IS NULL
        LIMIT ${BATCH_SIZE}
      )
    `;

    processed += result;
    console.log(`Backfilled ${processed} rows`);

    if (result < BATCH_SIZE) break;

    // Pause to reduce database load
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Backfill complete. Total rows: ${processed}`);
}
```

---

## 9. Production Migration Checklist

Run through this checklist before applying any migration to production.

```
[ ] 1. Review generated SQL -- no unexpected DROP, RENAME, or TYPE changes
[ ] 2. Check for table locks -- no CREATE INDEX without CONCURRENTLY on large tables
[ ] 3. Estimate migration duration on production data volume
       - Small table (<100K rows): seconds
       - Medium table (100K-10M rows): seconds to minutes
       - Large table (>10M rows): minutes to hours -- requires special handling
[ ] 4. Run migration on staging environment first
[ ] 5. Verify staging application health after migration
[ ] 6. Take database backup (or verify automated backup is recent)
       pg_dump -Fc $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).dump
[ ] 7. Notify team in #deploys channel
[ ] 8. Run migration
       npx prisma migrate deploy
[ ] 9. Verify application health (check /health and /ready endpoints)
[ ] 10. Monitor error rates and latency for 15 minutes
[ ] 11. If issues arise, decide: rollback migration or fix forward
[ ] 12. Confirm success in #deploys channel
```

---

## 10. Canonical Migration Examples

### 10.1 Prisma Schema Change

```prisma
// schema.prisma -- adding a new field
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  emailVerified Boolean? @map("email_verified")  // nullable first
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

Generate and apply:

```bash
npx prisma migrate dev --name add_email_verified_to_users
# Review: prisma/migrations/20240115093000_add_email_verified_to_users/migration.sql
# Generated SQL:
# ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN;
```

### 10.2 Drizzle Schema Change

```typescript
// schema/users.ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified'),  // nullable first
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Generate and apply:

```bash
npx drizzle-kit generate --name add_email_verified_to_users
# Review: drizzle/0001_add_email_verified_to_users.sql
# Generated SQL:
# ALTER TABLE "users" ADD COLUMN "email_verified" boolean;

npx drizzle-kit migrate
```

### 10.3 Multi-Step Zero-Downtime Example

Scenario: Rename `posts.body` to `posts.content`.

**Step 1 -- Migration: add new column**
```sql
-- 20240301_add_content_to_posts.sql
ALTER TABLE posts ADD COLUMN content text;
```

**Step 2 -- Code deploy: write to both columns**
```typescript
// Write to both during transition
await prisma.post.create({
  data: {
    title,
    body: text,      // old column
    content: text,    // new column
  },
});

// Read from new column with fallback
const displayText = post.content ?? post.body;
```

**Step 3 -- Data migration: backfill**
```sql
UPDATE posts SET content = body WHERE content IS NULL;
```

**Step 4 -- Code deploy: use only new column**
```typescript
await prisma.post.create({
  data: { title, content: text },
});
const displayText = post.content;
```

**Step 5 -- Migration: drop old column**
```sql
-- 20240315_drop_body_from_posts.sql
ALTER TABLE posts DROP COLUMN body;
```

---

## 11. Environment-Specific Considerations

### 11.1 Local Development

- Use `prisma migrate dev` (creates the migration and applies it).
- Use `prisma migrate reset` to start fresh if your local database gets out of sync.
- Seed data with `prisma db seed` after reset.

### 11.2 CI/Test

- Use `prisma migrate deploy` (applies existing migrations; never generates new ones).
- Start from a clean database on every test run.
- Run the full migration history to verify all migrations apply cleanly in sequence.

### 11.3 Staging

- Mirror production configuration.
- Apply migrations here first to catch issues before production.
- Use a recent copy of production data (anonymized) for realistic testing.

### 11.4 Production

- Only use `prisma migrate deploy`.
- Run migrations as part of the deploy pipeline, **before** the new application code starts.
- If migration fails, the deploy should abort and the old code continues running.

---

## Summary

Database migrations require discipline and caution. The core rules: never edit an applied migration, always use zero-downtime patterns for schema changes on existing tables, review every generated SQL file, test on staging first, and keep rollback scripts ready. The extra effort prevents the 3 AM "the database is locked and the app is down" incident.
