# PRD Compliance Registry

## Purpose

`prd-revd.yaml` in this directory is the Prototype requirement compliance registry. **It is not a pure PRD-requirements file.** It contains PRD product requirements plus the linked architecture, security, and Prototype-governance controls needed to prove that a Prototype implementation actually satisfies its approved scope. The filename is kept for continuity with the PRD it primarily tracks, but every entry carries an honest `requirement_class` so it is never mistaken for a PRD-only list.

## requirement_class

Every entry is exactly one of:

* **`PRODUCT`** — requires a direct PRD source.
* **`ARCHITECTURE`** — may cite SAD, TDS, or the Codex Development Specification.
* **`SECURITY`** — may cite the repository constitution (`CLAUDE.md`), an ADR, SAD, or TDS.
* **`PROTOTYPE_GOVERNANCE`** — a newly adopted Prototype planning rule, not sourced from PRD/SAD/TDS (e.g. the demo-member mechanism, feature flags).

A non-`PRODUCT` entry is never described as "a PRD requirement."

## The four-dimensional status model

Each entry's compliance state is **four independent dimensions**, never a single mutually-exclusive `status` field:

| Dimension | Allowed values | Rule |
| :---- | :---- | :---- |
| `implementation_status` | `NOT_STARTED`, `IMPLEMENTED` | Reflects code existence only. `IMPLEMENTED` makes **no** compliance claim by itself. |
| `automated_status` | `NOT_REQUIRED`, `PENDING`, `PASSED`, `FAILED`, `STALE` | `PASSED` requires named passing evidence (`automated_evidence` populated, tied to a real `last_verified_commit`). `STALE` means `last_verified_commit` is not an ancestor of current `HEAD`. |
| `demo_status` | `NOT_REQUIRED`, `PENDING`, `PASSED`, `REJECTED`, `STALE` | `PASSED` requires Product/Ops human evidence (`demo_evidence` populated — reviewer name, date, observation note). Never satisfied by an automated test standing in for a human. |
| `disposition` | `ACTIVE`, `DEFERRED`, `BLOCKED`, `REJECTED` | `DEFERRED` requires `waiver_owner`, `deferred_reason`, and a review date in `waiver_expiry`. `BLOCKED` must name the exact blocking dependency in `deferred_reason`. `REJECTED` requires an explicit Product Owner decision recorded in `deferred_reason`. |

Automated and demo verification are never summed together as if they counted the same population — a requirement needing both must satisfy both independently; a requirement needing only one is `NOT_REQUIRED` on the other, never silently skipped.

## PROTOTYPE_COMPLIANT derivation

A requirement is **`PROTOTYPE_COMPLIANT`** (a computed value, never stored as a field) only when **all** of the following hold:

* `disposition = ACTIVE`
* `implementation_status = IMPLEMENTED`
* `automated_status` is `PASSED` or `NOT_REQUIRED`
* `demo_status` is `PASSED` or `NOT_REQUIRED`
* no evidence is `STALE`

## Evidence freshness

`last_verified_commit` records the exact commit an `automated_status`/`demo_status` result was last confirmed against. Evidence is `STALE` once `last_verified_commit` is no longer an ancestor of the current `HEAD` (checked via `git merge-base --is-ancestor`) — stale evidence does not count toward `PROTOTYPE_COMPLIANT`.

## No requirement disappears silently

Every `requirement_id`, once created, remains in the registry permanently, regardless of `requirement_class`. A requirement may move to `disposition: DEFERRED` or `disposition: REJECTED`, but it is never deleted from the file.

## Future command: `npm run prd:compliance`

**Not yet implemented.** This registry does not, by itself, prove implementation compliance — a report command is the intended future consumer. When implemented, it will report, as separate non-additive figures: total Prototype-required count; implementation coverage; automated compliance; demo compliance; fully-`PROTOTYPE_COMPLIANT` count; `BLOCKED`/`DEFERRED` counts; missing-evidence list; stale-evidence list; failing requirement IDs. CI behavior differs by branch class (Prototype branch fails only on missing P0 hard-invariant automated evidence; Pilot branch fails on all required P0 automated and operational evidence gaps; Production release fails on all mandatory compliance gaps). Product/Ops demo review is never converted into a fake automated test — `demo_status: PASSED` can only be set by a human-authored evidence record.

Until this command exists, compliance state must be read directly from `prd-revd.yaml`.
