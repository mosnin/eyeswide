# Backend Phase Workflow Skill

Orchestrates a 12-phase backend build process. Each phase has prerequisites, deliverables, and a validation gate.

## Phases

### Phase 0: Requirements Gathering
- **Prerequisites:** None
- **Deliverables:** Requirements doc, entity list, integration inventory, NFR doc
- **Gate:** All deliverables confirmed by user
- **Read:** phase_00_requirements.md

### Phase 1: Architecture Planning
- **Prerequisites:** Phase 0 complete
- **Deliverables:** Architecture doc, tech stack doc, folder structure, service map
- **Gate:** Architecture reviewed and approved
- **Read:** phase_01_architecture.md, 06_service_architecture.md, 02_database_patterns.md, 01_api_design_system.md

### Phase 2: Database Design
- **Prerequisites:** Phase 1 complete
- **Deliverables:** Schema file, initial migration, seed files, ERD
- **Gate:** Migration runs clean, seeds populate, FKs have indexes
- **Read:** phase_02_database.md, 02_database_patterns.md, 16_migration_strategy.md

### Phase 3: API Design
- **Prerequisites:** Phase 2 complete
- **Deliverables:** API spec, OpenAPI schema, endpoint inventory
- **Gate:** All endpoints documented with request/response schemas
- **Read:** phase_03_api_design.md, 01_api_design_system.md, 05_validation_schemas.md

### Phase 4: Auth & Security
- **Prerequisites:** Phase 3 complete
- **Deliverables:** Auth middleware, authorization helpers, security config, RBAC schema
- **Gate:** Auth flow works E2E, protected routes reject unauthorized
- **Read:** phase_04_auth_security.md, 03_auth_authorization.md, 14_security_hardening.md

### Phase 5: Core Services
- **Prerequisites:** Phase 4 complete
- **Deliverables:** All core services, repository layer, shared utilities
- **Gate:** Services have unit tests, API endpoints return correct data
- **Read:** phase_05_core_services.md, 06_service_architecture.md, 04_error_handling.md

### Phase 6: External Integrations
- **Prerequisites:** Phase 5 complete
- **Deliverables:** Provider modules, webhook handlers, integration tests
- **Gate:** Integrations work with sandbox credentials
- **Read:** phase_06_integrations.md, 10_webhooks_events.md, 09_file_storage.md

### Phase 7: Queues & Background Jobs
- **Prerequisites:** Phase 5 complete (can parallel with Phase 6)
- **Deliverables:** Queue config, job definitions, worker setup, scheduled jobs
- **Gate:** Jobs process successfully, retries work, DLQ catches failures
- **Read:** phase_07_queues_jobs.md, 08_queue_job_system.md

### Phase 8: Testing
- **Prerequisites:** Phases 5-7 complete
- **Deliverables:** Test setup, factories, unit tests, integration tests, CI config
- **Gate:** All tests pass, coverage >80% for services
- **Read:** phase_08_testing.md, 13_testing_strategy.md, 19_data_seeding.md

### Phase 9: Observability
- **Prerequisites:** Phase 5 complete
- **Deliverables:** Logging middleware, health check, metrics, error tracking
- **Gate:** Logs structured JSON, health check works, errors tracked
- **Read:** phase_09_observability.md, 12_logging_monitoring.md

### Phase 10: Deployment
- **Prerequisites:** Phase 8 complete
- **Deliverables:** Dockerfile, docker-compose, CI/CD pipeline, env config
- **Gate:** CI passes, staging deploy works, health check responds
- **Read:** phase_10_deployment.md, 15_deployment_infra.md

### Phase 11: Hardening
- **Prerequisites:** Phase 10 complete
- **Deliverables:** Performance report, security audit, load tests, documentation
- **Gate:** P95 <200ms, no critical security issues, docs complete
- **Read:** phase_11_hardening.md, 17_performance_optimization.md, 14_security_hardening.md

## Phase Detection
To determine current phase, check in order:
1. No project docs? → Phase 0
2. No schema/migrations? → Phase 2
3. No API routes? → Phase 3
4. No auth middleware? → Phase 4
5. No service layer? → Phase 5
6. No external integrations? → Phase 6
7. No background jobs? → Phase 7
8. No tests? → Phase 8
9. No structured logging? → Phase 9
10. No CI/CD? → Phase 10
11. No load tests/security audit? → Phase 11
12. All complete → Maintenance mode

## Execution Rules
1. Never skip a phase
2. Complete validation gate before proceeding
3. Read the phase file AND referenced internal docs before starting
4. Update active_context.md after each phase completion
5. Log phase completion to progress_log.md
