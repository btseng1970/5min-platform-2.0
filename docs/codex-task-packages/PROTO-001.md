# PROTO-001｜Campaign → Demo Member → QR → Draw → Wallet → Collection Walking Skeleton

Governance task package drafted per the repository's Task Package Standard (Codex Development Spec v1.0 RevB.1 §7). This document defines PROTO-001's whole-task scope and constraints. **It does not itself authorize any implementation.** Each of PROTO-001's eight vertical slices (§10) requires its own separate Human Review gate sequence, scaled to its accelerated-governance Tier, per `docs/roadmaps/prototype-acceleration.md` §10 — mirroring the gate discipline FND-003 and FND-004 followed (Gate A design approval before any Gate B+ implementation work).

---

## 1. Task ID

`PROTO-001`

## 2. Objective

Build one complete, browser-operable, real-invariant-preserving walking skeleton demonstrating the platform's core transaction pattern end to end: a demo member opens a TW demo campaign, scans a signed demo QR code exactly once, triggers an idempotent draw whose result is fixed at `DrawReserved` time and never re-randomized, receives a point or prize outcome posted to an append-only wallet ledger, sees a collection item unlock, views a member-center summary, and has the entire journey traceable by an Admin operator via `correlation_id`. The purpose is to prove the architecture pattern (schema isolation, idempotency, immutable draw results, append-only ledgers, canonical errors, contract-first API) works end to end before committing to full production-scope implementation of any single domain.

## 3. Source of Truth

Source hierarchy, highest authority first: **TDS v1.0 RevB Final Errata-of-Errata** (`docs/tds-revb-final.md`) → **Codex Development Specification v1.0 RevB.1** (`docs/codex-spec-revb1.docx.md`) → **SAD v1.0 RevC.1** (`docs/sad-rev-c1.md`) → **PRD v1.1 Final Rev D** (`docs/prd-rev-d.md`) → merged repository implementation (`docs/codex-task-packages/FND-000.md` through `FND-004.md`, `docs/adr/ADR-000.md`/`ADR-000.1.md`) → `docs/roadmaps/prototype-acceleration.md` (this program's own adopted roadmap) → `docs/prd-compliance/prd-revd.yaml` (the exact requirement list this task must satisfy).

## 4. Active TDS Sections

* §2.3 Common Error Model (canonical error envelope and codes).
* §3 Module Boundary, Package Layout and Schema Ownership (schema/owner table, versioning conventions — `/api/v1/...`, `/admin/api/v1/...`, `/internal/api/v1/...`).
* API route tables for `/api/v1/me`, `/api/v1/campaigns/current`, `/api/v1/qr/scan`, `/api/v1/qr/pending-grants/**`, `/api/v1/reward/draws`, `/api/v1/reward/draws/{draw_id}`, `/api/v1/wallet`.
* Cross-schema Write Ban (`platform.event_outbox` is the sole exception).
* `event_outbox` key-field definition (`event_id`, `event_type`, `aggregate_type/id/version`, `payload_json`, `status`, `correlation_id`, `causation_id`).
* §31 CI/CD Guardrails and Architecture Fitness Functions.
* `qr.code` atomic one-time-use state-transition resolution (the sole enforcement point, not `qr.scan_event`).
* SAD §28.9 binding resolution (`DrawReserved`-time randomness, no settlement re-randomization).
* SAD's two-layer idempotency model (request-level at BFF via `client_request_id`; business-level at the owning domain context via a unique index).

## 5. Superseded to Ignore

* TDS line 383 and line 528 — legacy `DrawReserved`/draw-command pseudocode blocks, explicitly marked `[SUPERSEDED by 36.1 / 41.1 — DO NOT IMPLEMENT]`.
* TDS §13's original `reward.draw_ledger`/`reward.pity_counter` table definitions — superseded in place; any future Reward-epic DDL task must reference §36.2/§36.3, not §13.
* Codex Spec §15's illustrative nested migration path (`migrations/platform/0001_schemas.sql`) — non-authoritative digest illustration; FND-003's actual shipped flat filename grammar (`migrations/YYYYMMDDHHMMSS_<slug>.sql`) is authoritative, per FND-004's own settled adjudication.
* Any PendingGrant/anonymous-scan funnel content — real for production, explicitly out of PROTO-001's scope (§9 below); the demo member always exists before scanning in this walking skeleton.

## 6. Allowed & Forbidden Files

**This document authorizes no file creation or modification of any kind.** The following describes the *eventual* scope each Tier-gated slice implementation will draw from, once separately authorized:

**Eventually allowed** (per-slice, gated separately): `apps/api/**` (routes/controllers/services for the eight slices' endpoints), `apps/web/**` and `apps/admin/**` (member-facing and Admin-trace UI), `packages/domain/{campaign,crm,qr,reward,wallet,ip_asset}/**` (domain services and the stub interfaces in §7 of the roadmap), `packages/shared/**` (value objects actually touched, per FND-007's minimum-subset scope), `docs/openapi/**` (contract-first OpenAPI definitions, updated before route implementation per Codex Spec's binding API-task rule), test files colocated with the above.

**Permanently forbidden to PROTO-001**: any new database schema (FND-004 already created the exact twelve; none may be added), `scripts/migrate/**`, `migrations/README.md`, `migrations/template.sql`, `docs/adr/**`, any FND-00x governance task package, `docs/roadmaps/prototype-acceleration.md` and `docs/prd-compliance/**` (owned by the Prototype Acceleration program itself, updated only via their own governance process — e.g. `prd-revd.yaml` status-field updates as slices land), `.github/workflows/**` (FND-006's exclusive scope), any real payment/LINE/ERP provider SDK.

**The compliance stub is named `InternalDemoComplianceGate`.** It is available only in the internal Prototype environment; it permits only the fixed TW demo configuration defined in §13; it does not assert or prove legal compliance in any log, UI, or report it produces. It cannot authorize real campaign publication, market activation, or production traffic of any kind. It must be unavailable whenever Prototype-only feature flags are disabled (§5 of the roadmap — production defaults off). No second compliance adapter or gateway exists.

## 7. DB & API Changes

**No new schema.** FND-004 already created and durably closed all twelve bounded-context schemas; PROTO-001 creates zero additional schemas.

**Possible future domain tables** (exact DDL is a future, separately Tier-0-gated design task per slice, not specified here): a `qr.code`/`qr.scan_event` pair (if not already present from a future QR-schema task), a minimal `reward.draw_ledger`/`reward.prize_pool` pair (Prototype-minimal shape — no pity-counter, no multi-market complexity), `wallet.ledger_entry` (append-only, `unique(source_event_id, entry_type)`), a simplified `ip_asset` unlock-state table, and demo-only rows in `crm.member`. Every such table's exact DDL, migration file, and privilege grants require their own Gate-A-through-Gate-H sequence (mirroring FND-004's exact discipline), scaled by Tier (§10).

**Authoritative member-facing API routes** (exact, TDS-sourced, no bare `/v1/...` form): `GET /api/v1/campaigns/current`, `POST /api/v1/qr/scan`, `POST /api/v1/reward/draws`, `GET /api/v1/reward/draws/{draw_id}`, `GET /api/v1/wallet`, `GET /api/v1/me`.

**Proposed routes requiring later contract confirmation** (not yet enumerated in TDS's own route table — extrapolated from its `/api/v1/<domain>` and `/admin/api/v1/...` conventions): `GET /api/v1/collection`; `GET /admin/api/v1/audit-log?correlation_id=`.

**No public or internal API route exists for demo-member creation/selection.** The demo member is injected via deterministic seed/session tooling only (§13).

**Binding read-composition model** (a restatement of already-approved governance, not a new architecture decision): each owning domain service reads only its own schema; the BFF calls typed domain-service interfaces; the BFF composes typed responses in memory; caller-side SQL joins across owning schemas are forbidden; direct cross-context source-table reads are forbidden. PROTO-001 has no dependency on any `*_public` schema. Future `*_public` projections require a separately governed task, and any such future optimization must not change the external OpenAPI response shape of any of PROTO-001's committed routes.

## 8. Domain Events

`QRCodeScanned`, `DrawReserved`, `PrizeGranted`, `PointGranted`, `PrizeUnlocked` (optional), `MemberCreated` (optional, seed-time only) — each written to `platform.event_outbox` in the same database transaction as its originating domain write, per the Cross-schema Write Ban's sole exception.

## 9. Full GA Block

Binding hard rules from `CLAUDE.md`, applicable to every implementation step under this task without exception:

* 金額與點數用整數最小單位，全面禁止 float/double（Money and points use integer minor units — float/double are forbidden everywhere）。
* 所有時間比較用 UTC，禁止 local timezone 運算（All time comparisons use UTC — no local-timezone arithmetic）。
* 不得引用文件中標註 SUPERSEDED 的段落（Never cite a section marked SUPERSEDED — see §5 above）。
* 跨 schema 禁止寫入（outbox 除外）（Cross-schema writes are forbidden except `platform.event_outbox`）。
* Phase 1 禁止 Redis/memory TokenSource，抽獎用 DB SKIP LOCKED（Phase 1 forbids Redis/in-memory TokenSource; draws use DB `SKIP LOCKED`）。
* 每個任務必須附測試；測試紅燈時不得弱化測試來過關（Every task must ship with tests; a failing test may never be weakened to pass）。
* 不確定時停下來問我，不得自行發明架構決策（When uncertain, stop and ask — never invent an architecture decision unilaterally）。
* 一次只做一個 task，改動保持小（One task at a time; keep changes small）。

## 10. Implementation Steps

**No implementation step below is authorized to begin by this document.** Each is its own separately Human-Review-gated unit, sequenced per `docs/roadmaps/prototype-acceleration.md` §12 (the eight-week plan), Tier-scaled per §10 of that roadmap:

1. **PROTO-001A** Campaign shell — Tier 2.
2. **PROTO-001B** Demo member identity (seed/session tooling, no API route) — Tier 2.
3. **PROTO-001C** QR scan and one-time use — **Tier 1** (contract review required).
4. **PROTO-001D** DrawReserved result — **Tier 0** (full governance, explicit Human Review sign-off).
5. **PROTO-001E** Wallet grant — **Tier 0** (ledger semantics).
6. **PROTO-001F** Collection unlock — Tier 2.
7. **PROTO-001G** Member center — Tier 2.
8. **PROTO-001H** Admin correlation trace — Tier 2.

Mandatory escalation to at least Tier 1 (typically Tier 0) applies regardless of a slice's default tier if it involves: a schema change, a transaction-boundary change, a ledger change, a randomness change, a security change, cross-schema access, a new dependency/provider, a breaking API change, or destructive data behavior.

## 11. Acceptance Criteria

PROTO-001 as a whole is accepted only when: all eight slices have individually passed their own Tier-appropriate gate sequence; every must-be-real invariant (QR one-time-use atomicity, idempotent scan/draw, `DrawReserved`-time result with no re-randomization, append-only wallet posting, integer value handling, UTC, no oversell, `correlation_id` propagation, canonical error envelope, schema/module ownership boundaries) is demonstrated with real, non-stubbed behavior; every `G-PROTOTYPE` exit criterion (`docs/roadmaps/prototype-acceleration.md` §4) is met; and the full twelve-step reference journey (§2 above) is demonstrable end to end in a browser against the deterministic demo seed data.

## 12. Tests Required

Per slice, at minimum: a contract test against its OpenAPI definition; for Tier 0/1 slices, a concurrency/idempotency-replay test (e.g. concurrent-scan yields exactly one success, repeated draw request returns the identical prior result); a static scan confirming no direct cross-schema `SELECT`/write outside the approved domain-service interface; and, for any slice touching a ledger or one-time-use resource, an immutability/replay test confirming no duplicate posting or re-grant is possible. Full per-slice acceptance-test and demo-evidence detail lives in `docs/roadmaps/prototype-acceleration.md` §8.

## 13. Seed Data

Deterministic, non-production seed/reset builders (FND-009 minimum subset) producing exactly: one TW demo campaign, one deterministic demo member identity mechanism (seed/session-injected, no production auth), 20–50 signed demo QR codes, one reward pool with three prize tiers, one point type, one simplified collection. Same fixture data every run — no hidden randomness in seed generation itself (the *draw* remains genuinely random; the *seed data* must not be). No production PII of any kind — no real member identifier, phone number, email, or payment identifier anywhere in seed data.

## 14. Observability

`correlation_id` propagates from API request → domain write → the resulting `platform.event_outbox` row → the log line (FND-010 minimum subset) — nothing further (no distributed dashboard/alerting/runbook wiring in Prototype scope). PROTO-001H's Admin trace view is the human-facing consumer of this propagation.

## 15. Rollback

No schema-level rollback risk — FND-004's twelve schemas are already durably closed and are never modified by PROTO-001. Any future domain table a slice's Tier-0-gated design introduces inherits FND-004's own established rollback/forward-fix discipline exactly: no `CASCADE` ever, destructive rollback (`DROP TABLE`/`DROP SCHEMA`) permitted only while the object remains empty and was created solely by that slice's own migration, forward-fix-only once any downstream data exists. At the application level, every slice ships behind its own feature flag (§5 of the roadmap — typed environment/config flag, backend-enforced, production-default-off); rollback of a misbehaving slice is disabling its flag, not reverting shared infrastructure.

## 16. Human Review

This task package itself requires Human Review approval as a Gate-A-equivalent design document before any slice's own implementation gate sequence may begin — consistent with the discipline FND-003 and FND-004 followed throughout. Each of the eight vertical slices then proceeds through its own separate gate sequence, scaled by its accelerated-governance Tier (`docs/roadmaps/prototype-acceleration.md` §10): Tier 0 slices (PROTO-001D, PROTO-001E) require the full FND-004-style multi-gate sequence (design, threat/consistency review, implementation, integration, real-database verification where applicable, Human Review at every gate); Tier 1 (PROTO-001C) requires contract review, implementation, integration test, and Human Review; Tier 2 (PROTO-001A/B/F/G/H) follows the fast path (one-page task brief, implementation, acceptance test, demo, PR). No slice's implementation begins without its own explicit, separate Human Review authorization — this document's approval authorizes planning continuity only, never code.
