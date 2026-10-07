# zipcrm server

Express + Prisma API for zipcrm. Besides projects/tasks, it serves a CRM over the EVChamp app's data.

## ⚠️ The database is shared with EVChamp and Zeflash

zipcrm uses the same Neon database as two other apps. Their tables live in the `public` schema:

| Schema | Owner | Tables |
|---|---|---|
| `public` | EVChamp | `users`, `contact_submissions`, `test_drive_bookings`, `plan_purchases`, ... (created by `initDB` in `EVChamp/api/index.js`) |
| `public` | Zeflash | `"User"`, `"Credit"`, `"Payment"`, `"Report"`, ... |
| `crm` | **zipcrm** | `"User"`, `"Workspace"`, `"Project"`, `"Task"`, `"LeadState"`, `"LeadNote"`, ... |

Every zipcrm model has `@@schema("crm")`, so its `"User"` can never collide with Zeflash's `"User"`.

- **Never** run `prisma db push`, `prisma migrate dev` or `prisma migrate reset` against it.
- zipcrm only **reads** EVChamp tables (`crm/evchamp.js`). CRM state (status, owner, value, notes) lives in `crm."LeadState"` / `crm."LeadNote"`.
- Raw SQL must always schema-qualify table names: `public.contact_submissions` and `crm."LeadState"`. An unqualified `"User"` would hit Zeflash's table.

### Changing the schema

1. Edit `prisma/schema.prisma`.
2. Generate SQL from the schema diff alone. It can only mention zipcrm's own models:
   ```sh
   git show HEAD:server/prisma/schema.prisma > /tmp/prev.prisma
   npx prisma migrate diff --from-schema-datamodel /tmp/prev.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/sql/NNN_name.sql
   ```
3. Review it. `grep -iE 'drop|truncate' prisma/sql/NNN_name.sql` must print nothing unless you intend it. Wrap it in `BEGIN; … COMMIT;`.
4. Apply it **before** deploying code that uses it:
   ```sh
   npx prisma db execute --file prisma/sql/NNN_name.sql --schema prisma/schema.prisma
   ```

Applied so far: `001_crm_schema.sql` (2026-10-05), `002_manual_leads.sql` (2026-10-07).

## CRM

- Lead sources are the EVChamp tables in `crm/leadSources.js`. Each one maps its table onto a common lead shape.
- `/api/leads` returns leads with status/owner. `/api/leads/:source/:id` returns detail, notes and related enquiries. `/api/leads/stats` returns dashboard numbers.
- `/api/customers` returns EVChamp `users` with their `plan_purchases`.
- Access requires workspace membership, and the workspace must be listed in `CRM_WORKSPACE_IDS`. Clerk sign-up is open, so without that list anyone could create a workspace and read every lead.

## Tests

`npm test` runs the lead and customer API against an in-memory Postgres (PGlite). The database is laid out like production: EVChamp's tables from `test/fixtures/evchamp_ddl.sql`, a Zeflash-style `public."User"`, and zipcrm's tables from `prisma/sql/`. If EVChamp changes a lead table, refresh the fixture.

See `.env.example` for configuration.
