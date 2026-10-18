# Tasks

Backlog for building FitsMyTime one task at a time. Add new tasks below with a
unique ID and an unchecked checkbox. Refer to an ID when asking for work
(for example, "Build TASK-001"). Mark a task complete only after implementation
and verification.

Completed tasks are archived in [TASKS_COMPLETED.md](TASKS_COMPLETED.md).
Keep tasks awaiting testing or external setup here, and preserve task IDs when archiving.

## Authentication

- [ ] **TASK-003 — Support social sign-in.** Add or complete authentication
  through Google, Facebook, Apple, and Microsoft.
  **Status:** App integration implemented; provider setup and live sign-in testing pending.
  Follow [the setup guide](docs/social-sign-in.md) to configure each provider in
  Supabase and its developer console before enabling it.

## Landing page

- [ ] **TASK-005 — Refactor the landing page.** Agree on the desired layout,
  content, and behavior when starting this task, then implement the refactor.


## Translations
- [ ] **Make sure interface is translated in multiple languages ** All labels , button names, tooltip texts should be translated when user switch language.

## Audit

Plan an activity audit trail covering successful changes, failed/denied actions,
sensitive reads, and system operations. See [the audit plan](docs/audit-plan.md)
for the coverage matrix, proposed storage, privacy rules, and acceptance checks.
Recommended direction: a separate audit PostgreSQL database, fed reliably through
a transactional outbox in the application database. This is planned work, not
an implemented audit system.

- [ ] **TASK-013 — Define the audit event catalog and policies.** Inventory API
  routes, Auth/Storage operations, scheduled jobs, scripts, and direct database
  changes. Map each to events, actors, outcomes, safe fields, and retention.
  Record coverage gaps and settle hosting, reader permissions, and retention
  periods before provisioning storage. Include future features when implemented.

- [ ] **TASK-014 — Build reliable audit storage and delivery.** Add the separate
  audit database, restricted credentials, event schema, and application outbox.
  Record business changes and their events in one transaction. Add a delivery
  worker with retries, duplicate protection, backlog monitoring, and recovery.
  Test audit-database outages without losing events or stopping normal reads.

- [ ] **TASK-015 — Audit authentication, accounts, and access changes.** Capture
  sign-in/out, signup, social-auth outcomes, recovery/password changes, account
  edits, workspace switches, invitations, memberships, ownership transfers,
  account restrictions, and authorization denials. Correlate application events
  with available Supabase Auth events; never log passwords or session tokens.

- [ ] **TASK-016 — Audit business data changes.** Cover services, shared addresses,
  employees, schedules, bookings, reviews, categories, storefronts, subscriptions,
  and administrative actions. Record safe field changes and server-confirmed
  outcomes, including multi-record updates, copies, deletion, and bulk operations.

- [ ] **TASK-017 — Audit sensitive reads, integrations, and background work.**
  Cover private/admin data access, exports, protected file access, geocoding,
  embedding generation, cleanup jobs, migrations, and operational scripts.
  Add direct-database coverage where required. Keep general browsing analytics
  separate; add payments, webhooks, and notifications as those features go live.

- [ ] **TASK-018 — Add an audit viewer in Administration.** Provide server-side
  filters, pagination, event details, safe change comparisons, and request/object
  history. Restrict global access, scope any company view explicitly, and audit
  viewing/exporting audit records. Support controlled exports without exposing
  secrets or other workspaces' data.

- [ ] **TASK-019 — Verify, operate, and roll out auditing.** Test coverage,
  transaction rollback, duplicate delivery, outages, permissions, redaction,
  retention, deletion, and backup restoration. Add delivery/integrity alerts,
  review procedures, an incident runbook, and deployment/rollback instructions.
  Start with security-critical events, then complete the coverage matrix.

## Test scripts

## notifications

## quick find: I have x time available X date. What could I do? Propose activities near my current location.

## Subscribe for news. Receive invitations.

## New tasks

## Security
Encrypt network traffic. Passwords and other sensitive information
## discounts

## compaigns

## billing

## Reports

## SMS
## Terms of Use
<!-- Add the next task here using TASK-021, or place it in the relevant section. -->
