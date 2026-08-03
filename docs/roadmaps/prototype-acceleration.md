# Prototype Acceleration Roadmap

Durable governance roadmap for the Prototype Acceleration program (PROTO-001 onward). Adopted by Human Review following the Prototype Acceleration Planning Gate (two amendment passes) and materialized as this repository document once FND-004 reached durable closure. This roadmap defines: the minimum Architecture Runway required before Prototype work begins, the `G-PROTOTYPE` gate, the `PROTO-001` reference journey, the real-core/stub boundary, the vertical-slice backlog, the requirement-compliance model, the accelerated governance tiers, the exact future repository manifest, and the eight-week execution plan.

**Status: ADOPTED.** `G-PROTOTYPE` is a new gate this roadmap introduces — it does not appear in the PRD, SAD, TDS, or Codex Development Specification, and its adoption here is a Human Review governance decision, not a restatement of an existing authoritative decision.

## 1. Authoritative Sources

Source hierarchy, highest authority first:

1. **TDS v1.0 RevB Final Errata-of-Errata** (`docs/tds-revb-final.md`).
2. **Codex Development Specification v1.0 RevB.1** (`docs/codex-spec-revb1.docx.md`).
3. **SAD v1.0 RevC.1** (`docs/sad-rev-c1.md`).
4. **PRD v1.1 Final Rev D** (`docs/prd-rev-d.md`).
5. **Merged repository implementation and durable completion records** — `docs/codex-task-packages/FND-000.md` through `FND-004.md`, and `docs/adr/ADR-000.md`/`ADR-000.1.md` (both Accepted).

No `SUPERSEDED`-marked section is treated as authoritative anywhere in this roadmap. Where draw-transaction behavior is discussed, this roadmap relies on the non-superseded SAD §28.9 resolution and TDS's `Cross-schema Write Ban`/`event_outbox` sections.

**Disclosed finding**: none of the four authoritative documents (PRD/SAD/TDS/Codex Spec) contains the words "Prototype," "walking skeleton," "feature flag," or "G-PROTOTYPE." The closest existing concepts are the Codex Spec's own gate ladder (`G-ADR → G-FND → G-WAL/G-QR → G-REW → ... → G0 Cutover → Pilot Run`) and a single market-scoped configuration toggle for the "點加金" (points-plus-cash) feature — a compliance-gated market switch, not a general feature-flag system. `G-PROTOTYPE`, `PROTO-001`, and the feature-flag mechanism defined in this roadmap are new governance constructs, not restatements of an existing authoritative decision.

## 2. Foundation State (at time of adoption)

| Task | Status | Evidence |
| :---- | :---- | :---- |
| ADR-000 | Accepted | TypeScript/Node.js LTS, NestJS, PostgreSQL 16, SQL-first migrations, pg-boss-class queue, Next.js |
| ADR-000.1 | Accepted | Node 24 LTS pinned, npm workspaces, single root lockfile |
| FND-000 | Task package merged into `main` | Dev-environment/CI infra |
| FND-000.1 | Merged through PR #2 | Node 24 alignment patch |
| FND-001 | Merged through PR #1 | Repository bootstrap |
| FND-002 | Merged through PR #3 | Module package boundary enforcement |
| FND-003 | **DURABLY CLOSED, merged** | SQL-first migration framework (`node-pg-migrate@8.0.4`/`pg@8.22.0`), 48/48 tests, real-database-verified |
| FND-004 | **DURABLY CLOSED, merged** | Twelve bounded-context schemas established; PR #6, squash commit `7aa3e4d078212840daddc112b94e3558af405079` on `main`; Gate F real-database verification (30/30 evidence categories) passed |
| FND-005 through FND-013 | No task package exists yet | Referenced only in the Codex Spec roadmap as planned future tasks |

Week 1 of the eight-week plan (§10) must schedule against durable repository and merged-PR evidence, not against this roadmap's own characterization of that evidence.

## 3. Architecture Runway Classification

FND-000 through FND-013, classified into exactly four categories.

### HARD_PREREQUISITE

| Task | Why hard-prerequisite | Source |
| :---- | :---- | :---- |
| FND-000 | Dev environment (PostgreSQL 16 + pg-boss-class queue devcontainer, CI skeleton) — nothing below can run without a database and runtime environment. | Codex Spec §9, §18 |
| FND-001 | Repository bootstrap — `apps/api`/`web`/`admin`/`worker` must exist before any endpoint or page can start. | Codex Spec §9 |
| FND-002 | Module package boundaries — the code-level half of the isolation model; TDS: "Modular Monolith 只有在 package、schema、repository、read contract 和 CI fitness function 同時成立時才有意義." | Codex Spec §9; TDS |
| FND-003 | SQL-first migration framework — already shipped and merged; every subsequent schema/table change depends on it. | FND-003 Completion Record |
| FND-004 | Schema isolation — the twelve schemas PROTO-001's every DB object lives inside. **Durably closed and merged.** | FND-004 Completion Record; TDS Cross-schema Write Ban |

### MINIMUM_SUBSET_BEFORE_G_PROTOTYPE

| Task | Minimum Prototype deliverable | Explicitly deferred (full production scope) |
| :---- | :---- | :---- |
| FND-005 | `platform.event_outbox` table only, transactional-outbox write contract (same DB transaction as the domain write it accompanies) — no relay/worker delivery guarantee required beyond "the row exists after commit." | Full relay retry/DLQ, monthly partition maintenance automation, reconciliation jobs, operational dashboards. |
| FND-006 | Only the hard-invariant CI scanners: schema-write (cross-context) isolation, no-float, UTC, dependency allowlist, OpenAPI contract validation. | Load-test gates, security-review gates for QR/wallet/compliance changes, full PR evidence bundle. |
| FND-008 | Canonical error envelope (`error_code`, `message`, `details`, `correlation_id`, `retry_after_seconds`) plus only the codes PROTO-001's own slices exercise: `VALIDATION_FAILED` (400), `RESOURCE_NOT_FOUND` (404), `IDEMPOTENCY_CONFLICT` (409), `STATE_CONFLICT` (409), `RESOURCE_LOCKED` (423). | Remaining codes (`AUTH_REQUIRED`, `POLICY_BLOCKED`, `RATE_LIMITED`, `DRAW_PAUSED`) added later or stubbed to a generic 500. |
| FND-009 | Deterministic demo seed/reset builders for exactly PROTO-001's fixture set: one campaign, one demo member, 20–50 signed demo QR codes, one reward pool with three tiers, one point type, one simplified collection. | Full market/legacy/G0-cutover seed builders — out of Prototype scope entirely. |
| FND-010 | `correlation_id` propagation from API request → domain write → `event_outbox` row → log line — nothing further. | Full distributed dashboards/alerting/runbook wiring. |
| FND-013 | `docs/openapi` as contract source of truth for exactly PROTO-001's endpoints — generated client for `apps/web`/`apps/admin` limited to those routes. | Full API surface for every future epic. |

### PARALLEL_WITH_PROTOTYPE

| Task | Minimum concurrent scope |
| :---- | :---- |
| FND-007 | Only the value objects each vertical slice actually touches (integer `Money`/`Points`, `UtcTimestamp`) — built incrementally slice-by-slice. |
| FND-011 | A read-only/demo-admin authorization shell sufficient for PROTO-001H's read-only trace view — no maker/checker write-approval flow needed yet. |
| FND-012 | Full docs-lint may run in parallel without blocking Prototype slices, since it validates governance documents, not application code. |

### DEFER_TO_PILOT_OR_PRODUCTION

Full outbox relay retry/DLQ/reconciliation; full observability dashboards; full maker-checker RBAC; full provider integrations (LINE/payment/ERP/CDN); full cross-market/legal activation; production-scale load/DR/runbooks.

## 4. G-PROTOTYPE — Walking Skeleton Ready

A gate sitting between `G-FND`/the Architecture-Runway minimum subset (§3) and any future `G-WAL`/`G-QR`/Pilot-track gate.

### Runtime
* PostgreSQL 16 local environment starts (per ADR-000, devcontainer/docker-compose — FND-000 scope).
* `apps/api`, `apps/web`, `apps/admin` all start.
* `migrate:up` and `migrate:down` both pass against the local environment, using FND-003's shipped, verified framework and FND-004's twelve schemas.

### Architecture
* All eleven domain packages plus `platform` module boundaries active (FND-002).
* Exactly twelve schemas exist (FND-004, durably closed).
* No cross-context direct write — enforced by the FND-006 minimum-subset static scanner, mirroring TDS's Cross-schema Write Ban.
* SQL-first migration only — FND-003's shipped Control A validator, unmodified.
* OpenAPI contract-first rule active for PROTO-001's own endpoint set (FND-013 minimum subset).

### Core request behavior
* `correlation_id` propagates from API request through the domain write into the `event_outbox` row and the log line (FND-010 minimum subset).
* Canonical error envelope exists and returns the exact JSON shape TDS specifies for at least the five codes listed in §3's FND-008 row.
* Idempotency contract exists for POST commands — at minimum the QR-scan and draw-request routes, matching SAD's two-layer model (request-level at BFF via `client_request_id`, business-level at the owning domain context via a unique index).
* Feature flags can disable an unfinished flow (§5 below).

### Development experience
* One-command local startup, spanning all apps + DB.
* One-command test execution.
* Deterministic seed/reset procedure (FND-009 minimum subset) — same fixture data every run; the *draw* remains genuinely random, the *seed data* must not be.
* No production credential required anywhere in the Prototype path.

### Compliance
* A Prototype requirement registry exists (`docs/prd-compliance/prd-revd.yaml`), containing PRD product requirements plus the linked architecture/security/Prototype-governance controls needed to prove the Prototype implementation.
* Every Prototype slice references one or more stable requirement IDs, honestly classified by `requirement_class`.
* Implementation status, automated status, and demo status are tracked as three separate, non-additive dimensions, never conflated into one pass/fail field (§8 below).

### Explicit non-authorizations
* **`G-PROTOTYPE` does not replace `G-FND`** — `G-FND`'s own exit criteria remain the authoritative Foundation gate for anything beyond the Prototype's own minimum subset; `G-PROTOTYPE` is a narrower, additional walking-skeleton milestone, not a substitute.
* **`G-PROTOTYPE` does not authorize real customer traffic.**
* **`G-PROTOTYPE` does not authorize** production payments, real LINE messaging, ERP integration, Legal-market activation, or real prize fulfillment.
* **`G-PROTOTYPE` only authorizes** controlled internal Prototype development and Product/Ops demonstration.

## 5. Feature Flags (adopted mechanism)

**Adopted: typed environment/config feature flags with test overrides.** No feature-flag service or database table is created for the Prototype.

Rules:
* Backend enforcement is authoritative — a flag disables a flow's backend route/handler, not merely a frontend affordance.
* Production defaults off — every Prototype-only flag defaults to disabled outside the Prototype environment.
* Tests may inject overrides — test code may set a flag's value directly for a specific test run.
* Domain core never reads environment variables directly — only an application/config adapter reads the environment; the domain layer receives a typed flag interface.
* The application/config adapter supplies the typed flag interface to the domain/application layer.

## 6. PROTO-001 Reference Journey

**PROTO-001 — Campaign → Demo Member → QR → Draw → Wallet → Collection → Member Center → Admin Trace.**

| Step | User action | Real invariant exercised | Source |
| :---- | :---- | :---- | :---- |
| 1 | Open one configured TW demo campaign | Campaign state model (`Draft/Active/Ending/Archived/Hidden`) | PRD §2.6 |
| 2 | Select or create one demo member | Member identity exists (stubbed provider, §7) | SAD §28.7 PendingGrant discussion, adapted |
| 3 | Scan one signed demo QR | Cryptographically signed, non-enumerable code value | PRD §2.5; TDS `qr.code.code_hash` |
| 4 | Enforce one-code-one-successful-use | `qr.code` atomic state transition is the **sole** enforcement point, not `qr.scan_event` | TDS |
| 5 | Create a draw command with idempotency | `client_request_id`/`idempotency_key`; repeated request returns the same result, never re-draws | PRD; SAD |
| 6 | Determine result at `DrawReserved` time | Randomness decided once, at reservation; settlement never re-randomizes | SAD §28.9 (binding resolution) |
| 7 | Show the immutable result to the user | Same guarantee as step 6 | SAD |
| 8 | Post a point or prize outcome | Append-only wallet ledger entry, `unique(source_event_id, entry_type)` | TDS `wallet.ledger_entry` |
| 9 | Display wallet summary | Read via the `WalletService` domain-service interface (own-schema read of `wallet.*`), composed by the BFF in memory — not a `wallet_public` projection, since FND-004 creates no `*_public` schema | TDS `wallet.ledger_entry` |
| 10 | Unlock one collection item | `member.has_unlocked(collection_item)` visibility rule | PRD §2.6 |
| 11 | Display member-center summary | "我的點數" / "當期圖鑑" cards | PRD |
| 12 | Admin traces the full flow by `correlation_id` | Audit search by `correlation_id`/`operator_id`/`member_id` | Codex Spec ADM-006 |

**Read-composition model (binding)**: FND-004 creates exactly twelve schemas — `platform, campaign, wallet, qr, reward, notification, compliance, crm, team, ip_asset, analytics, commerce` — and explicitly **no** `<context>_public` schema of any kind. The binding Prototype read policy is: **each owning domain service reads only its own schema**; the BFF/application orchestration layer calls domain service interfaces (in-process function calls within the Modular Monolith, not HTTP); the BFF composes typed service responses in memory; caller-side SQL joins across owning schemas remain forbidden; direct cross-context source-table reads remain forbidden. Future `*_public` projections may replace these in-process service reads later, through a separately governed future task — and that future optimization must not change the external OpenAPI response shape of any of PROTO-001's committed routes.

**Fixed Prototype constraints**: one market (TW), one campaign, one reward pool, three prize tiers, one point type, one simplified collection, 20–50 demo QR codes, demo member identity, no real LINE provider, no real payment gateway, no real ERP, no real prize fulfillment, no real production member data.

**Authoritative member-facing API routes** (TDS-exact): `GET /api/v1/campaigns/current`, `POST /api/v1/qr/scan`, `POST /api/v1/reward/draws`, `GET /api/v1/reward/draws/{draw_id}`, `GET /api/v1/wallet`, `GET /api/v1/me`. Proposed, not-yet-TDS-enumerated routes requiring later contract confirmation: `GET /api/v1/collection`, `GET /admin/api/v1/audit-log?correlation_id=`. The demo-member identity mechanism (step 2) has **no** public or internal API route — it is injected via deterministic seed/session tooling only.

## 7. Real Core and Stub Boundary

### Must be real (no stub permitted anywhere in the Prototype)

| Invariant | Why it cannot be stubbed |
| :---- | :---- |
| QR atomic one-time use | The entire QR security model rests on this single enforcement point. |
| Idempotent scan | Prevents duplicate ingestion on webhook/request replay. |
| Idempotent draw | Prevents duplicate `PrizeGranted` on retry. |
| `DrawReserved`-time result, no re-randomization | Core fairness guarantee. |
| Append-only wallet ledger | Financial-grade auditability. |
| Prototype-level inventory oversell prevention | A real atomic reservation, not a mocked count. |
| Integer points/money | CLAUDE.md hard rule; no float/double anywhere. |
| UTC | CLAUDE.md hard rule; no local-timezone arithmetic. |
| `correlation_id` | Required for any future debugging/audit trail to mean anything. |
| Schema/module ownership | The entire point of FND-002/FND-004. |
| OpenAPI conformance | Contract-first is a binding CI rule. |
| Canonical errors | Consistent FE error handling depends on this from day one. |

### May be stubbed behind an interface

| Capability | Interface boundary | Prototype adapter | Future production adapter | Anti-leak rule |
| :---- | :---- | :---- | :---- | :---- |
| Member identity provider | `MemberIdentityProvider` (select/create, no auth) | In-memory/DB-seeded demo member picker, no password/session | Real auth + LINE binding | Domain draw/wallet/QR logic must never branch on "is this a demo member" |
| LINE LIFF | `SocialBindingProvider` | No-op / always-unbound stub | Real LIFF SDK binding | No LIFF-specific field leaks into `member`/`crm` schema |
| LINE/Email/SMS delivery | `NotificationDispatcher` | Log-only stub | Real Notification Broker (single egress point) | Domain events never call a delivery SDK directly — always through the outbox |
| Commerce webhook | `CommerceEventSource` | Static/manual seed data | Real COM-001 webhook ingestion | Reward/Wallet code never inspects a raw webhook payload |
| Warehouse/ERP | `FulfillmentAdapter` | No-op | Real ERP/warehouse sync | Prize-granting logic never blocks on real fulfillment status |
| CDN purge | `AssetCacheInvalidator` | No-op | Real CDN purge API call | Collection/asset-serving code never calls a CDN SDK directly |
| Legal/compliance gate | `InternalDemoComplianceGate` | Permits only the fixed TW demo configuration; unavailable outside the internal Prototype environment; returns a demo-scoped decision only; never claims legal compliance | Real maker-checker Legal+Business approval | `InternalDemoComplianceGate` must never be reachable from a non-Prototype environment and authorizes no real campaign publish or market activation of any kind |
| BI warehouse | `AnalyticsSink` | No-op or local log | Real data-warehouse export | Domain code never imports a BI SDK |
| External fraud provider | `FraudSignalProvider` | Always-pass stub | Real fraud/risk service | Draw/QR domain logic treats the fraud signal as an opaque input |

**Payment is explicitly out of scope, not a stub.** PROTO-001 has no payment flow anywhere in its 12-step journey — there is nothing for a `PaymentGateway` interface to sit behind. If a future task introduces a paid draw or paid redemption, a payment interface is designed and governed at that time, as its own Tier 0 decision.

**Anti-leak rule (general, all nine stubs)**: every stub lives behind an interface defined in the owning domain's own package (never in `apps/**`), and the domain core never imports a concrete stub or production implementation directly — only the interface.

## 8. Vertical Slice Backlog

| Slice | User outcome | Owning context | API route(s) | Real invariant | Permitted stub | Tier |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **PROTO-001A** Campaign shell | See and select the one demo TW campaign | `campaign` | `GET /api/v1/campaigns/current` | Schema ownership, OpenAPI conformance | none needed | Tier 2 |
| **PROTO-001B** Demo member identity | Pick/create a demo member | `crm` | None — deterministic seed/session tooling only | Integer IDs, UTC | Member identity provider | Tier 2 |
| **PROTO-001C** QR scan and one-time use | Scan a demo QR, see it accepted once | `qr` | `POST /api/v1/qr/scan` | QR atomic one-time use, idempotent scan, correlation_id, canonical errors | Fraud signal (always-pass) | **Tier 1** |
| **PROTO-001D** DrawReserved result | Trigger a draw, see the immutable result | `reward` | `POST /api/v1/reward/draws` | DrawReserved-time result, no re-randomization, idempotent draw, no oversell, integer points | Fraud signal (always-pass); payment explicitly out of scope | **Tier 0** |
| **PROTO-001E** Wallet grant | See the point/prize outcome posted | `wallet` | `GET /api/v1/wallet` | Append-only ledger, integer points, `unique(source_event_id, entry_type)` | none | **Tier 0** |
| **PROTO-001F** Collection unlock | See a collection item unlock | `ip_asset`/`crm` | `GET /api/v1/collection` (proposed, TDS confirmation pending) | Schema ownership, OpenAPI conformance | `InternalDemoComplianceGate` | Tier 2 |
| **PROTO-001G** Member center | See a member-center summary | `crm` (orchestrates `wallet`/`ip_asset` reads) | `GET /api/v1/me` | No cross-context direct read — composition via domain service interfaces only | none | Tier 2 |
| **PROTO-001H** Admin correlation trace | Trace the full journey by `correlation_id` | `platform`/`analytics` | `GET /admin/api/v1/audit-log?correlation_id=` (proposed, TDS confirmation pending) | `correlation_id` propagation, read-only RBAC | Full maker-checker (read-only) | Tier 2 |

Full per-slice detail (source requirement IDs, DB objects, events, feature-flag names, acceptance tests, demo evidence, explicit out-of-scope, rollback strategy) is defined in `docs/codex-task-packages/PROTO-001.md`.

## 9. Prototype Requirement Compliance Model

25 requirements, honestly classified by `requirement_class` — not every entry is a PRD requirement:

* **PRODUCT** (8): requires a direct PRD source — campaign configurability/display, QR one-code-one-use rules, inventory oversell prevention, wallet/collection/member-center display.
* **ARCHITECTURE** (11): may cite SAD/TDS/Codex Spec — scan/draw idempotency, DrawReserved immutability, no-re-randomization, append-only ledger mechanism, correlation_id, canonical error model, admin traceability, cross-schema write ban, OpenAPI-first, no direct provider send.
* **SECURITY** (4): may cite repository constitution/ADR/SAD/TDS — signed/non-enumerable QR contract, integer points/money, UTC, no production PII.
* **PROTOTYPE_GOVERNANCE** (2): a newly adopted Prototype planning rule, not sourced from PRD/SAD/TDS — demo-member mechanism, feature flags.

Full requirement list with exact source citations lives in `docs/prd-compliance/prd-revd.yaml`; field/status model and evidence rules are documented in `docs/prd-compliance/README.md`.

## 10. Accelerated Governance Tiers

| Tier | Governance path | Scope |
| :---- | :---- | :---- |
| **Tier 0** — irreversible/core | Full governance: design, threat/consistency review, implementation, integration, Human Review. | Migrations, ledger semantics, randomization, inventory authority, authentication/security, payment, destructive operations. |
| **Tier 1** — core transaction feature | Short governance: contract review, implementation, integration test, Human Review. | QR claim, point grant, draw reservation, settlement, reversal. |
| **Tier 2** — Prototype application feature | Fast path: one-page task brief, implementation, acceptance test, demo, PR. | Campaign page, member center, collection, read-only admin, query endpoints. |
| **Tier 3** — presentation/config | Fastest path: implementation, screenshot/E2E smoke, PR. | Layout, copy, display ordering, animation, demo configuration. |

**Mandatory escalation** (forces the item up to at least Tier 1, typically Tier 0, regardless of its originally assigned tier): schema change; transaction-boundary change; ledger change; randomness change; security change; cross-schema access; new dependency/provider; breaking API change; destructive data behavior.

**Maximum document size, Tier 2/3 tasks**: a Tier 2 task brief is capped at roughly **150 lines**, a Tier 3 task brief at roughly **50 lines** — deliberately far below the multi-hundred-line FND-series governance packages. This is an adopted convention, not a CI-enforced rule.

**Weekly operating cadence**: Day 1 — contract/task brief, referencing exact requirement IDs; Day 2–3 — implementation plus automated tests; Day 4 — integrated demo plus compliance-registry status update; Day 5 — Human Review scaled to the slice's tier, merge decision, next-slice planning.

## 11. Exact Future Repository Manifest

| Path | Status |
| :---- | :---- |
| `docs/roadmaps/prototype-acceleration.md` | This document |
| `docs/codex-task-packages/PROTO-001.md` | Created alongside this roadmap |
| `docs/prd-compliance/prd-revd.yaml` | Created alongside this roadmap |
| `docs/prd-compliance/README.md` | Created alongside this roadmap |

`docs/codex-task-packages/COMP-001.md` is **not** created — `npm run prd:compliance`'s implementation plan is embedded in this roadmap and in `docs/prd-compliance/README.md` instead; a dedicated `COMP-001.md` is created later only if that implementation proves large enough to need independent multi-gate governance. No frozen PRD/SAD/TDS source document is modified by this manifest.

## 12. Eight-Week Execution Plan

| Week | Dependency | Deliverable | Automated evidence | Demo evidence | Risk | Owner role | Exit decision |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Architecture Runway minimum subset (§3) landed | Land the §3 minimum-subset items (FND-005/006/008/009/010/013) | `migrate:test` green; CI guardrail scanners active | none yet | Sequencing risk if any minimum-subset item is larger than expected | Tech Lead | Go/no-go: is the minimum subset genuinely landed, or does Week 1 need to extend? |
| 2 | Week 1 exit = go | `G-PROTOTYPE` verification; deterministic seed/reset; compliance registry populated | One-command startup/test scripts pass; seed/reset produces identical fixture state twice in a row | Internal walkthrough of empty-but-running skeleton | Registry design may reveal a missing field once real data is entered | Tech Lead | Is `G-PROTOTYPE`'s own exit criteria (§4) fully met? |
| 3 | Week 2 exit = go | PROTO-001A Campaign shell + PROTO-001B demo member | Contract tests for both routes | Screenshot/demo of campaign + member picker | Low (Tier 2) | Backend/Frontend engineer | Merge decision per Tier 2 fast path |
| 4 | Week 3 merged | PROTO-001C QR scan + one-time use | Concurrent-scan and replay-scan tests green | Live demo: double-scan rejection | **Tier 1** — contract review required before merge | Backend engineer + Tech Lead | Merge decision per Tier 1 short path |
| 5 | Week 4 merged | PROTO-001D DrawReserved + result display | Concurrent-draw + idempotency-replay tests green | Live demo: repeated draw request returns same result | **Tier 0** — full governance | Tech Lead + Human Review | Explicit Human Review sign-off required before merge |
| 6 | Week 5 merged | PROTO-001E Wallet + PROTO-001F Collection + PROTO-001G Member Center | Ledger-immutability + unlock-state tests green | Live demo: full point/prize-to-wallet-to-collection-to-member-center chain | Wallet is Tier 0; Collection/Member Center are Tier 2 | Tech Lead (Wallet) + Backend/Frontend engineer | Human Review sign-off for Wallet; Tier 2 fast-path merge for the other two |
| 7 | Week 6 merged | PROTO-001H Admin trace + first automated `prd:compliance` report run | Trace integration test green; `npm run prd:compliance` produces a real report | Live demo: Admin pulls up the full PROTO-001 journey by `correlation_id` | Low (Tier 2) | Backend engineer | Merge decision per Tier 2 fast path |
| 8 | Week 7 merged | Product/Ops/Finance review of the full walking skeleton against the compliance registry | `npm run prd:compliance` final report | Full end-to-end live demo | Compliance percentage may reveal gaps not caught earlier | Product Owner + Tech Lead + Finance | Explicit Prototype gap decision: proceed to Pilot-track planning, extend Prototype, or descope |

## 13. Non-Negotiable Invariants

Restated from §7's "must be real" list, since this is the single most important thing this roadmap must not compromise: QR atomic one-time use; idempotent scan and draw; `DrawReserved`-time immutable result with no settlement re-randomization; append-only wallet ledger; Prototype-scale oversell prevention; integer points/money; UTC; `correlation_id`; schema/module ownership; OpenAPI conformance; canonical errors. None of CLAUDE.md's hard rules (GA block) is weakened anywhere in this program — the float/points-integer rule, the UTC rule, the SUPERSEDED-citation ban, the cross-schema write ban, and the "one task at a time, small changes" discipline all continue unmodified.
