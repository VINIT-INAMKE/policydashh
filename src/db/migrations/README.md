# Migrations — hand-written SQL is the source of truth

This project does **not** use `drizzle-kit generate` to manage migrations. Every SQL file in this directory was authored by hand. The old `meta/_journal.json` drizzle-kit metadata was deleted on 2026-04-23 because it drifted to `idx: 11 / 0011_cal_com_workshop_register` and lied about the current migration floor (every migration 0012–0026 was applied by a one-off script that does not touch the journal).

## Conventions

- **Filename format:** `NNNN_short_description.sql` (four-digit zero-padded).
- **Idempotency:** every DDL statement uses `IF NOT EXISTS` / `IF EXISTS` / `ADD COLUMN IF NOT EXISTS` where Postgres supports it, so re-running a migration on an already-applied DB is a no-op.
- **Statement terminator:** every SQL statement MUST end with `;` on its own line (the `;\s*\n` splitter in `scripts/apply-migration-*.mjs` relies on this).
- **Comments:** leading `-- ...` lines are fine at the top of a statement (the applier strips them before execution), but do NOT intersperse line comments between the first SQL token and the terminating `;` — the splitter will leave them attached.
- **`DO $$ ... END $$` blocks:** only the generalised applier (`scripts/apply-all-migrations.mjs`) handles these correctly. The per-migration `apply-migration-NNNN.mjs` scripts use a simpler splitter that will mangle dollar-quoted blocks.

## Applying migrations

**Whole set (prefer this):**

```bash
node scripts/apply-all-migrations.mjs
# resume from a specific file:
node scripts/apply-all-migrations.mjs --from 0012
```

**Single file:** use `scripts/apply-migration-NNNN.mjs` only for one-off hotfixes. New migrations should rely on `apply-all-migrations.mjs` — see B8-5 in `docs/superpowers/reviews/2026-04-23-workshop-redesign-punchlist.md`.

Both scripts dial `DATABASE_URL` via the Neon HTTP driver (no pooled connection required).

## Adding a migration

1. Pick the next unused `NNNN_` prefix.
2. Write the DDL in plain SQL. Do not import drizzle-kit output unless you also run it through the idempotency-check above.
3. Run `node scripts/apply-all-migrations.mjs --from NNNN` against a scratch DB (or your local Neon branch) to confirm it applies cleanly.
4. Commit the `.sql` file together with the corresponding schema edits in `src/db/schema/`.
