# Database migrations

Migrations are managed with the Supabase CLI (run via `npx supabase`, no
global install needed). SQL files live in `supabase/migrations/` and are
applied in filename order.

## Workflow

```sh
npm run db:new <name>    # create supabase/migrations/<timestamp>_<name>.sql
npm run db:push          # apply pending migrations to the linked project
npm run db:reset         # recreate the local database from migrations
npm run db:diff          # diff local schema against migrations
```

Link the remote (Sydney) project once per machine:

```sh
npx supabase link --project-ref <project-ref>
```

## Rules (from CLAUDE.md)

- RLS policies ship **with** their tables in the same migration.
- Every migration that touches access control gets a SQL/pgTAP isolation test.
- Cross-org access is always an explicit grant row, never a default.
