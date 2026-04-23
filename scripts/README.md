# Scripts

Operational one-shot scripts that don't live inside the Next.js app bundle.

## Migration appliers

Both appliers read `DATABASE_URL` from `.env.local` via `dotenv`.

### `apply-all-migrations.mjs` — preferred

Walks `src/db/migrations/NNNN_*.sql` in filename order and applies every
statement through the Neon HTTP driver. Uses a dollar-quote-aware splitter
that keeps `DO $$ ... END $$;` blocks intact.

```bash
node scripts/apply-all-migrations.mjs
node scripts/apply-all-migrations.mjs --from 0012   # resume
```

Idempotent when every DDL statement in the migration uses `IF NOT EXISTS` /
`IF EXISTS` guards (the project convention — see
`src/db/migrations/README.md`).

### `apply-migration-NNNN.mjs` — one-off, discouraged

Each script applies a single migration. They exist for the same historical
reason the schema has hand-written SQL: the original `drizzle-kit generate`
workflow was abandoned at phase 11 (see `src/db/migrations/README.md` for
the `_journal.json` postmortem). New one-offs are discouraged — use
`apply-all-migrations.mjs` for every new migration.

**Convention for any one-off that must persist:**

1. **Splitter:** the simple `;\s*\n` splitter used in
   `apply-migration-0026.mjs` works for migrations containing ordinary
   DDL. It does NOT handle `DO $$ ... END $$;` function bodies — if the
   new migration needs dollar-quoting, use the generalised
   `splitStatements` helper from `apply-all-migrations.mjs` instead.
2. **Leading comments:** the splitter strips leading `-- ...` lines at
   the top of each statement before running it. Interior line comments
   between the first SQL token and the terminating `;` are left in place
   and sent to Postgres verbatim.
3. **Statement terminator:** every statement must end with `;` on its
   own line.

## Other scripts

- `apply-post-push-gaps.mjs` + `post-drizzle-push-gaps.sql` — applies the
  one-off post-push corrections that closed the drizzle-push / DB gap in
  earlier phases. Reserved for historical rebuild; new schema changes use
  the regular migration pipeline above.
