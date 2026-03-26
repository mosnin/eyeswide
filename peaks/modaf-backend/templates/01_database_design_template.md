# Database Design Document

> **Project:** [Project Name]
> **Version:** [v1.0.0]
> **Last Updated:** [YYYY-MM-DD]
> **Owner:** [Team / Engineer Name]
> **Status:** Draft | In Review | Approved

---

## 1. Database Overview

### Engine & Version

- **Database Engine:** [PostgreSQL 16 | MySQL 8 | MongoDB 7 | etc.]
- **Extensions / Plugins:** [e.g., `uuid-ossp`, `pgcrypto`, `PostGIS`, `pg_trgm`]

### Hosting

| Environment | Provider / Host                          | Instance Type     |
|-------------|------------------------------------------|-------------------|
| Local       | [Docker container / local install]       | -                 |
| Development | [AWS RDS / GCP Cloud SQL / PlanetScale]  | [db.t3.micro]     |
| Staging     | [Same as production, smaller instance]   | [db.t3.small]     |
| Production  | [AWS RDS Multi-AZ / Aurora / etc.]       | [db.r6g.large]    |

### Connection Pooling

- **Pooler:** [PgBouncer | Built-in pool | Prisma connection pool | HikariCP]
- **Mode:** [Transaction | Session | Statement]
- **Pool Size:** [Min: 5 | Max: 20 per application instance]
- **Idle Timeout:** [30 seconds]
- **Connection String Format:** `postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]`

### Naming Conventions

| Element     | Convention              | Example                    |
|-------------|-------------------------|----------------------------|
| Tables      | [snake_case, plural]    | `user_accounts`            |
| Columns     | [snake_case]            | `created_at`               |
| Primary Keys| [`id`]                  | `id`                       |
| Foreign Keys| [`[table_singular]_id`] | `user_id`                  |
| Indexes     | [`idx_[table]_[columns]`] | `idx_users_email`        |
| Unique      | [`uniq_[table]_[columns]`] | `uniq_users_email`      |
| Enums       | [PascalCase]            | `OrderStatus`              |

---

## 2. Entity Relationship Diagram

```
[Insert a text-based ERD using a notation such as the one below.
 Replace with your actual entities and relationships.]

┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   users      │       │  orders          │       │  products    │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)          │    ┌──│ id (PK)      │
│ email        │  │    │ user_id (FK)     │──┘ │  │ name         │
│ name         │  └───>│ status           │    │  │ price        │
│ role         │       │ total_amount     │    │  │ sku          │
│ created_at   │       │ created_at       │    │  │ created_at   │
│ updated_at   │       │ updated_at       │    │  │ updated_at   │
└──────────────┘       └──────────────────┘    │  └──────────────┘
                              │                │
                              │                │
                       ┌──────────────────┐    │
                       │  order_items     │    │
                       ├──────────────────┤    │
                       │ id (PK)          │    │
                       │ order_id (FK)    │────┘
                       │ product_id (FK)  │───────
                       │ quantity         │
                       │ unit_price       │
                       └──────────────────┘

Relationship Summary:
- users 1───* orders         (one user has many orders)
- orders 1───* order_items   (one order has many items)
- products 1───* order_items (one product appears in many order items)
```

---

## 3. Table Definitions

### `[table_name]`

> [Brief description of what this table represents and its role in the domain.]

**Columns:**

| Column        | Type                     | Nullable | Default            | Description                          |
|---------------|--------------------------|----------|--------------------|--------------------------------------|
| `id`          | `UUID` / `BIGSERIAL`     | No       | `gen_random_uuid()` / auto | Primary key                  |
| `[field]`     | `VARCHAR(255)`           | No       | -                  | [Description]                        |
| `[field]`     | `TEXT`                   | Yes      | `NULL`             | [Description]                        |
| `[field]`     | `INTEGER`                | No       | `0`                | [Description]                        |
| `[field]`     | `DECIMAL(10,2)`          | No       | -                  | [Description]                        |
| `[field]`     | `BOOLEAN`                | No       | `false`            | [Description]                        |
| `[field]`     | `JSONB`                  | Yes      | `'{}'::jsonb`      | [Description]                        |
| `[enum_field]`| `[EnumType]`             | No       | `'[default]'`      | [Description, reference enum below]  |
| `[fk_field]`  | `UUID` / `BIGINT`        | No       | -                  | Foreign key to `[referenced_table].id` |
| `created_at`  | `TIMESTAMPTZ`            | No       | `NOW()`            | Row creation timestamp               |
| `updated_at`  | `TIMESTAMPTZ`            | No       | `NOW()`            | Last modification timestamp          |
| `deleted_at`  | `TIMESTAMPTZ`            | Yes      | `NULL`             | Soft delete timestamp (if applicable)|

**Constraints:**

| Constraint                        | Type        | Columns / Expression                  |
|-----------------------------------|-------------|---------------------------------------|
| `[table]_pkey`                    | Primary Key | `id`                                  |
| `fk_[table]_[ref_table]`         | Foreign Key | `[fk_field]` references `[ref_table](id)` |
| `uniq_[table]_[field]`           | Unique      | `[field]`                             |
| `chk_[table]_[field]_positive`   | Check       | `[field] > 0`                         |

**Indexes:**

| Index Name                      | Columns / Expression    | Type     | Partial / Where       |
|---------------------------------|-------------------------|----------|-----------------------|
| `idx_[table]_[field]`          | `[field]`               | B-tree   | -                     |
| `idx_[table]_[field]_[field2]` | `[field], [field2]`     | B-tree   | -                     |
| `idx_[table]_[field]_gin`      | `[jsonb_field]`         | GIN      | -                     |
| `idx_[table]_active`           | `[field]`               | B-tree   | `WHERE deleted_at IS NULL` |

**Triggers:**

| Trigger Name                       | Event            | Action                                   |
|------------------------------------|------------------|------------------------------------------|
| `trg_[table]_update_timestamp`     | BEFORE UPDATE    | Set `updated_at = NOW()`                 |

---

*(Repeat the table definition block above for each table in the schema.)*

---

## 4. Enums & Constants

### `[EnumName]`

> [Description of what this enum represents.]

| Value          | Description                                     |
|----------------|-------------------------------------------------|
| `[VALUE_1]`    | [What this value means in the domain]           |
| `[VALUE_2]`    | [What this value means in the domain]           |
| `[VALUE_3]`    | [What this value means in the domain]           |

### Application Constants (not stored as DB enums)

| Constant Name            | Value   | Used In              | Description                        |
|--------------------------|---------|----------------------|------------------------------------|
| `MAX_LOGIN_ATTEMPTS`     | [5]     | [Authentication]     | [Max failed logins before lockout] |
| `DEFAULT_PAGE_SIZE`      | [20]    | [Pagination]         | [Default items per page]           |

---

## 5. Migration Strategy

### Tool

- **Migration Tool:** [Prisma Migrate | Knex | Flyway | Alembic | Liquibase | golang-migrate | TypeORM | raw SQL]
- **Migration Location:** `[path/to/migrations/]`

### Naming Convention

```
[Format for migration file names, e.g.:]
YYYYMMDDHHMMSS_[descriptive_name].[up|down].sql
  or
[sequential_number]_[descriptive_name].ts
```

**Examples:**
- `20260315120000_create_users_table.up.sql`
- `20260315120001_add_email_index_to_users.up.sql`

### Migration Rules

1. [Every migration MUST have a corresponding rollback (down migration)]
2. [Migrations must be backward-compatible with the previous application version (expand-and-contract pattern)]
3. [Never modify a migration that has been applied to staging or production]
4. [Destructive operations (DROP TABLE, DROP COLUMN) require a two-phase migration with a deprecation period]
5. [Large data migrations must be run as background jobs, not in migration files]
6. [All migrations must be tested against a copy of production data before deployment]

### Rollback Policy

- **Automated Rollback:** [Yes/No — does the deploy pipeline automatically rollback on failure?]
- **Rollback Window:** [How long after deployment can a rollback be safely executed?]
- **Data Loss Rollbacks:** [How are rollbacks handled when data has been written to new columns/tables?]

---

## 6. Seeding Strategy

### Development Seeds

- **Seed Location:** `[path/to/seeds/]`
- **Seed Command:** `[npm run seed | prisma db seed | rake db:seed]`
- **Seed Data Source:** [Hardcoded fixtures | Faker-generated | Anonymized production subset]

**Seed Datasets:**

| Dataset Name     | Description                          | Record Count | Dependencies          |
|------------------|--------------------------------------|--------------|-----------------------|
| `base`           | [Minimum data for app to function]   | [~50]        | None                  |
| `demo`           | [Realistic demo data]                | [~500]       | `base`                |
| `performance`    | [Large dataset for load testing]     | [~100,000]   | `base`                |

### Test Factories

- **Factory Library:** [Factory Bot | Fishery | @faker-js/faker | custom builders]
- **Factory Location:** `[path/to/factories/]`

**Factory Conventions:**

| Convention             | Description                                                      |
|------------------------|------------------------------------------------------------------|
| Default factory        | [Creates a valid record with minimal required fields]            |
| Traits / Variants      | [Named variations, e.g., `userFactory.admin()`, `order.paid()`]  |
| Sequences              | [Auto-incrementing values for unique fields]                     |
| Associations           | [How related records are created — inline, lazy, or explicit]    |
| Cleanup                | [How test data is cleaned up — transaction rollback, truncation] |

---

## 7. Query Patterns

### Common Query Patterns

#### [Pattern Name, e.g., "Fetch user with active orders"]

```sql
-- [Description of when and where this query is used]
SELECT u.id, u.name, o.id AS order_id, o.status
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE u.id = $1
  AND o.status = 'active'
  AND u.deleted_at IS NULL
ORDER BY o.created_at DESC;
```

**Expected Index Usage:** `idx_orders_user_id`, `idx_orders_status`
**Estimated Frequency:** [~1000 req/min]

---

*(Repeat for each significant query pattern.)*

---

### N+1 Prevention

| Strategy               | Implementation                                                     |
|------------------------|--------------------------------------------------------------------|
| Eager Loading          | [ORM includes/joins — e.g., `User.findAll({ include: [Order] })`] |
| DataLoader / Batching  | [Batch lookups by collecting IDs and issuing a single `WHERE IN`]  |
| Query Complexity Limits| [For GraphQL: max depth, max complexity score]                     |
| Monitoring             | [Query logging in dev, slow query alerts in production]            |

### Join Strategy

- **Preferred Join Types:** [INNER JOIN for required relations, LEFT JOIN for optional]
- **Join Depth Limit:** [Max N tables in a single query before refactoring to separate queries]
- **Materialized Views:** [Any pre-computed views for complex aggregations?]
- **Denormalization:** [Any intentionally denormalized fields, with update strategy?]

---

## 8. Backup & Recovery

### Backup Schedule

| Backup Type          | Frequency         | Retention Period    | Storage Location          |
|----------------------|-------------------|---------------------|---------------------------|
| Automated Snapshot   | [Daily at 02:00 UTC] | [30 days]        | [AWS S3 / GCS bucket]    |
| Point-in-Time (WAL)  | [Continuous]      | [7 days]            | [Same region, encrypted]  |
| Manual Pre-Migration | [Before each migration] | [90 days]      | [Tagged in backup storage]|
| Cross-Region Replica | [Continuous]      | [Always current]    | [Secondary region]        |

### Restore Procedure

1. [Identify the target recovery point (timestamp or snapshot ID)]
2. [Notify stakeholders and confirm maintenance window]
3. [Initiate point-in-time recovery or snapshot restore via cloud console / CLI]
4. [Verify data integrity — run validation queries, check row counts]
5. [Update application connection strings if restoring to a new instance]
6. [Run smoke tests against restored database]
7. [Resume normal traffic and confirm monitoring is green]

**RTO (Recovery Time Objective):** [Target time to restore service, e.g., < 1 hour]
**RPO (Recovery Point Objective):** [Maximum acceptable data loss, e.g., < 5 minutes]

### Disaster Recovery Notes

- [Cross-region replication details]
- [Automated failover configuration]
- [Runbook location for on-call engineers]

---

## 9. Scaling Considerations

### Read Replicas

- **Replica Count:** [N replicas per environment]
- **Read Routing:** [Application-level routing | Proxy-level (e.g., PgBouncer, ProxySQL)]
- **Replication Lag Tolerance:** [Maximum acceptable lag, e.g., < 1 second]
- **Consistency Requirements:** [Which queries must hit primary? e.g., reads immediately after writes]

### Partitioning

- **Partitioning Strategy:** [Range (by date) | Hash (by tenant_id) | List | None currently]
- **Partitioned Tables:** [List tables and their partition keys]
- **Partition Maintenance:** [How are new partitions created? Automated or manual?]

### Connection Limits

| Environment | Max Connections | Pool Size per Instance | Expected Instances | Total Pool |
|-------------|-----------------|------------------------|--------------------|------------|
| Development | [100]           | [10]                   | [1]                | [10]       |
| Staging     | [200]           | [15]                   | [2]                | [30]       |
| Production  | [500]           | [20]                   | [5-10]             | [100-200]  |

### Additional Scaling Notes

- **Caching Layer:** [Redis / Memcached — what is cached and cache invalidation strategy]
- **Archival Strategy:** [When and how old data is moved to cold storage]
- **Sharding:** [If applicable — shard key, routing strategy, cross-shard query approach]
- **Estimated Growth:** [Expected data growth rate — rows/month, storage/month]

---

## Appendix

### Changelog

| Date       | Version | Author   | Changes                               |
|------------|---------|----------|---------------------------------------|
| YYYY-MM-DD | 1.0.0   | [Author] | [Initial database design document]    |

### Open Questions

- [ ] [List any unresolved schema design decisions]
- [ ] [Questions requiring stakeholder input]
- [ ] [Performance concerns that need benchmarking]

### References

- [Link to ORM documentation]
- [Link to migration tool documentation]
- [Link to cloud database provider documentation]
- [Link to related API specification]
