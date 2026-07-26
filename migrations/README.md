# Migrations

## 1. Purpose

This directory holds SQL-first migrations for the `platform` schema and the
11 domain schemas (`campaign`, `wallet`, `qr`, `reward`, `notification`,
`compliance`, `crm`, `team`, `ip_asset`, `analytics`, `commerce`). FND-003
established this framework — directory/naming conventions, the header
convention, a template, and validation tooling. It creates zero real
migrations. FND-004 (schema isolation) and FND-005 (event outbox base)
author the first real migrations using this framework.

## 2. Directory layout

This directory is flat — no subdirectories:

- `migrations/README.md` — this file.
- `migrations/template.sql` — the non-executable migration template.
- `migrations/<timestamp>_<slug>.sql` — real migrations, authored via
  `npm run migrate:create` (see §8), starting with FND-004.

## 3. Filename convention

Every real migration filename matches exactly:

```
YYYYMMDDHHMMSS_<slug>.sql
```

- The 14-digit prefix is a **UTC** timestamp — never local time.
- **The 14-digit timestamp prefix is the uniqueness key**, not the full
  filename — two files with the same prefix collide even if their slugs
  differ.
- `<slug>` is lowercase `[a-z0-9]`, hyphen-separated, up to 60 characters.

Exact regex (basename only):

```
^\d{14}_[a-z0-9]+(?:-[a-z0-9]+)*\.sql$
```

Valid examples: `20260101000000_create_placeholder.sql`,
`20260315143022_add-index-note.sql`.

Invalid examples: `2026010100000_x.sql` (13 digits), `20260101000000_.sql`
(empty slug), `20260101000000_Create.sql` (uppercase), `20261301000000_bad.sql`
(month 13), `create.sql` (no timestamp prefix).

On a timestamp-prefix collision, `migrate:create` does not auto-increment or
retry with a different timestamp — it fails and asks you to retry, which will
naturally produce a later timestamp.

## 4. Header convention

Every real migration begins with exactly these four fields, in this exact
order, each appearing exactly once:

```
-- owning_context: <value>
-- description: <value>
-- rollback_notes: <value>
-- forward_fix_notes: <value>
```

**`owning_context` allowlist (exact, 12 values):**

```
platform, campaign, wallet, qr, reward, notification, compliance, crm, team, ip_asset, analytics, commerce
```

No other value is permitted. In particular, `foundation`, `shared`, `core`,
and `system` are **forbidden** — no repository document defines any of them
as a valid schema or migration-owning context.

**`rollback_notes` and `forward_fix_notes` are both always mandatory** — they
represent two different operational obligations ("how would I revert this
locally" and "how would I correct this once it has reached a shared
environment"), not alternatives to each other. A bare `N/A`, `none`, `TBD`,
`later`, or blank value is rejected. A value of the form:

```
not_applicable: <reason>
```

is accepted only if a non-empty reason follows the prefix.

## 5. Up/Down markers

Every real migration contains exactly these two marker lines, in this exact
order:

```
-- Up Migration
```

and, later in the file:

```
-- Down Migration
```

Both are required. `-- Down Migration` appearing before `-- Up Migration` is
rejected.

## 6. Deterministic ordering and immutability

Migration filenames encode a strictly monotonic, collision-free ordering key
(the UTC timestamp prefix). Once a migration has reached a shared
environment, do not edit or reverse it — write a new forward migration.

## 7. Forward-fix policy

Once a migration has reached a shared (non-local, non-ephemeral) environment,
defects are corrected by a new forward migration, not by editing or
reverse-applying the original. Document the correction in the new migration's
`forward_fix_notes` field.

## 8. Local developer commands

| Command | Purpose | DATABASE_URL required? |
| :---- | :---- | :---- |
| `npm run migrate:validate` | Validates the real `migrations/` directory | No |
| `npm run migrate:test` | Runs the full fixture + function-level test suite | No |
| `npm run migrate:create -- <slug> --owning-context=<context> --description="<text>" --rollback-notes="<text>" --forward-fix-notes="<text>"` | Creates a new migration file. **Never invokes node-pg-migrate** — this is a repository-owned command that generates the filename, copies and parameterizes `migrations/template.sql`, and validates the result before placing it. | No |
| `npm run migrate:up [-- --dry-run]` | Applies all pending migrations | Yes |
| `npm run migrate:down` | Reverts exactly one migration | Yes |
| `npm run migrate:redo` | Reverts exactly one migration, then reapplies it — implemented as two separate, repository-orchestrated invocations (`down` then `up`), **never** node-pg-migrate's own `redo` action, and **not** one atomic transaction across both steps. If the down-half succeeds but the up-half fails, the database remains at the down (rolled-back) state and the command prints an explicit recovery diagnostic. | Yes |

`DATABASE_URL` must be set in the environment for `up`/`down`/`redo`, and
must **never** point at a shared, staging, or production database — always
use a local or ephemeral instance (see `docs/codex-task-packages/FND-000.md`
for this repository's existing ephemeral-environment convention).

## 9. CI integration note

CI wiring for `migrate:validate` is owned by FND-006 and is not present yet.
This repository's own `npm run migrate:validate` is the only currently
enforced check.

## 10. Scope note

FND-003 introduces no real migration. `migrations/template.sql` contains no
executable DDL. Real schema work begins at FND-004.

## 11. Non-migration files in this directory

`README.md` (this file) and `template.sql` are repository metadata/template
files, not migrations. The `migrate:up`, `migrate:down`, and `migrate:redo`
wrappers exclude them from node-pg-migrate's own migration-file scan using a
fixed, exact `--ignore-pattern` (`^(README\.md|template\.sql)$`). This
pattern cannot be configured, broadened, or overridden by any user-facing
flag — it is not exposed on any wrapper's command line.

This ignore pattern exists only to keep node-pg-migrate's own file-loading
step from crashing on these two files; it does not replace or narrow this
repository's own validator (Control A), which still runs before every real
migration action and still rejects any unexpected file, nested path, symlink,
invalid filename, or invalid header placed anywhere in `migrations/`.

Do not add any other non-migration file to this directory. Documentation or
template files must not be added here without a future governance amendment
to this section.

## Stale temporary directory

`migrate:create` creates a transient working directory at repository root
with the prefix `.fnd003-migrate-create-` while it validates a new migration
before placing it, and removes that directory itself when it finishes,
whether it succeeds or fails cleanly. If a `migrate:create` process is ever
killed mid-run, a directory matching `.fnd003-migrate-create-*` may be left
behind at repository root — it will be visible via
`git status --short --untracked-files=all`, since this directory lives
inside the repository rather than in an OS temp location. It is never real
migration content, is never referenced by any committed path, and is safe to
inspect and manually remove. No command in this repository automatically
reuses or recursively deletes another invocation's leftover directory.
