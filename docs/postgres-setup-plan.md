# Plan: Replace the lost Supabase database with plain PostgreSQL

Status: core native PostgreSQL setup path is implemented; service-owned schemas and root environment template are now configured. Remaining checklist items: setup verification mode, service preflight, and optional Docker Compose.
Constraint: standard PostgreSQL 16+ only. No BaaS layer. Supabase stays only for Google sign-in (Auth), which is separate from the database.

## Context (verified on the dev machine, 2026-09-26)

| Fact | Evidence |
|---|---|
| The Supabase database password is lost | user statement |
| PostgreSQL 18.4 is installed natively and running | service `postgresql-x64-18`, Automatic, `pg_isready` → `localhost:5432 - accepting connections` |
| Docker is not installed | `docker: command not found`, no `C:\Program Files\Docker` |
| psql is not on PATH | lives in `C:\Program Files\PostgreSQL\18\bin` |
| Services already support Postgres | 4 `application.yml` files read `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`, fall back to H2 files in `.run/data`; `postgresql` driver in every `pom.xml` |
| All 4 services share one database | one `DB_URL`; table names do not collide (`users`, `stored_tokens`, `sensor_devices`, `telemetry_readings`, `field_watering`, `crops`, `health_snapshots`, `valves`, `irrigation_schedules`, `irrigation_events`) |
| Schema is created by Hibernate | `ddl-auto: update` in all 4 services; seeders run when tables are empty |
| `stack.ps1` loads `.env` into the process | splits on the first `=`, no quote stripping, no `${VAR}` expansion, never prints values |
| No `.env` was ever committed | `git ls-files` shows only `frontend/.env.example`; `git log -- .env` empty |
| `.gitignore` is correct | `.env`, `**/.env`, `.env.*.local` ignored; `!**/.env.example` allowed; `*.bak` ignored |

## Decisions (approved during review)

| ID | Decision | Answer |
|---|---|---|
| D1 | Target developer | Hackathon teammate on Windows running `stack.ps1` |
| D2 | Empathy baseline | Accurate as written below |
| D3 | Time-to-hello-world target | Competitive: 2-5 min (Postgres installed → 4 services on Postgres, verified) |
| D4 | Magical moment | `scripts/db-setup.ps1` end to end, finishing with live row counts |
| D5 | Review mode | DX POLISH |
| D6 | Runtime | Native Postgres is the main path; `docker-compose.yml` ships as the documented alternative on `127.0.0.1:5433` |
| D7 | Env names | `POSTGRES_*` is the single source; `DATABASE_URL` for psql/tools; H2 stays the fallback when `POSTGRES_HOST` is unset |
| D8 | Container non-root | Keep the image's own drop to uid 70 + `no-new-privileges`, localhost-only port, required password |
| D9 | Existing `.env` | Merge + backup to `.env.bak`; comment out old `DB_*` lines; never delete a line |

## Developer Persona Card

```
TARGET DEVELOPER PERSONA
========================
Who:       Hackathon teammate on a Windows laptop
Context:   Clones SOA-Hackthon, runs .\scripts\stack.ps1 start in PowerShell
Tolerance: ~5 minutes of setup before asking in chat or falling back to H2
Expects:   A root .env.example, one script, a clear "it worked" signal
```

## Developer Empathy Narrative (confirmed, D2)

"I clone SOA-Hackthon and open the README. It says the stack runs on H2 files in .run/data, and that I can point at Postgres by setting DB_URL, DB_USERNAME, DB_PASSWORD in .env. There's no .env.example at the root, so I don't know the exact format. Only frontend/.env.example exists, and that's for Supabase sign-in keys. The yml comments say 'use Supabase Postgres', whose password is gone. I'd guess a URL like postgres://user:pass@localhost/agritech, and (predicted) Spring fails on startup because it wants jdbc:postgresql://. I have Postgres installed, but nothing tells me to create a database or a user. All four services share one DB_URL. If I skip Postgres entirely it still works on H2, so I never find out Postgres is broken until the demo."

## Competitive DX Benchmark

Clock: Postgres installed + repo cloned → all 4 services running on Postgres and verified. Peer times are estimates from prior knowledge, not measured (no live research run).

| Tool | Start → result | Time (evidence) | DX choice |
|---|---|---|---|
| Rails `bin/setup` | clone → app on local Postgres | ~2-5 min (estimate) | one script creates DB, migrates, seeds |
| Laravel Sail / Supabase CLI | clone → DB running | ~3-5 min + image pull (estimate) | Docker-only, one command |
| Prisma `migrate dev` | `.env` set → schema applied | ~1-2 min (estimate) | clear error on bad URL |
| This repo today | as above | ~20-40 min (estimate), ~7 steps | no template, no bootstrap, silent H2 fallback |
| This repo after plan | as above | ~3 min (estimate, to be measured) | one script + verify, loud failure |

## Magical Moment Specification (D4)

Teammate runs one script, then starts the stack, then sees their own Postgres holding the farm:

```
PS> .\scripts\db-setup.ps1
[1/5] PostgreSQL 18.4 found at C:\Program Files\PostgreSQL\18\bin
[2/5] localhost:5432 accepting connections
[3/5] Superuser 'postgres' password: ********
      role agritech ...... created
      database agritech .. created (owner agritech)
[4/5] .env updated (backup: .env.bak). Old DB_URL/DB_USERNAME/DB_PASSWORD commented out.
[5/5] Connected as agritech to agritech (PostgreSQL 18.4)
Next: .\scripts\stack.ps1 start ; then .\scripts\db-setup.ps1 -Verify

PS> .\scripts\db-setup.ps1 -Verify
Connected as agritech to agritech (PostgreSQL 18.4)
  users            2
  sensor_devices  13
  crops            4
  valves           4
All 4 services are writing to PostgreSQL. (took 2m41s since setup)
```

Requirements:
- Idempotent: re-running changes nothing except syncing the role password to `.env`.
- Generated app password: 32 hex chars from `System.Security.Cryptography.RandomNumberGenerator` (hex avoids `=`/`#`/quote issues with the `stack.ps1` loader).
- Superuser password read with `Read-Host -AsSecureString`, passed to child `psql` via process-scoped `PGPASSWORD`, cleared afterwards. Never on a command line, never written to disk.
- App password passed to psql as a `-v` variable inside a piped script (not argv), used as `:'pw'`.
- SQL: `DO $$ ... CREATE ROLE agritech LOGIN ... $$` if missing, `ALTER ROLE ... PASSWORD`, `SELECT 'CREATE DATABASE agritech OWNER agritech' WHERE NOT EXISTS (...) \gexec`. PG15+ public schema is owned by `pg_database_owner`, so the DB owner can create tables.
- `-Verify` reads `.env`, connects as the app user, counts rows in 4 seeded tables; if a table is missing it says which service did not reach Postgres and which log to open.

## Target files

### `.env.example` (root, committed, zero secrets)

```dotenv
# PostgreSQL for all services. Run .\scripts\db-setup.ps1 to fill these in.
# Leave POSTGRES_HOST empty to run on local H2 files instead.
POSTGRES_HOST=localhost
# 5432 = native Postgres (default). 5433 = docker compose alternative.
POSTGRES_PORT=5432
POSTGRES_DB=agritech
POSTGRES_USER=agritech
# Generated by db-setup.ps1. Never commit a real value.
POSTGRES_PASSWORD=
# For psql and other tools (Spring does not read this). db-setup.ps1 writes it.
DATABASE_URL=
```

### Service config (D7)

Each of the 4 `application.yml` keeps the H2 default and gains a `postgres` profile block:

```yaml
---
spring:
  config:
    activate:
      on-profile: postgres
  datasource:
    url: jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT:5432}/${POSTGRES_DB}
    username: ${POSTGRES_USER}
    password: ${POSTGRES_PASSWORD}
```

`stack.ps1` sets `SPRING_PROFILES_ACTIVE=postgres` when `POSTGRES_HOST` is non-empty, and before launching any service runs `pg_isready`; if Postgres is not accepting connections it stops with problem + cause + fix instead of starting services. Stale "Supabase pooler" comments are updated. `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` are no longer read.

### `docker-compose.yml` (alternative path, D6 + D8)

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-agritech}
      POSTGRES_DB: ${POSTGRES_DB:-agritech}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - "127.0.0.1:5433:5432"   # localhost only; 5433 avoids a native Postgres on 5432
    volumes:
      - pgdata:/var/lib/postgresql/data
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
volumes:
  pgdata:
```

The server process runs as `postgres` (uid 70): the image's entrypoint only uses root to chown the data dir, then drops privileges via `su-exec`. `no-new-privileges` blocks re-escalation. Explicit `user: "70:70"` was rejected (D8): a new root-owned named volume fails initdb.

### Verification (spec item 3)

- Windows, either path: `.\scripts\db-setup.ps1 -Verify`
- Any OS with psql: `psql "$DATABASE_URL" -c "select current_user, current_database(), version();"`
- Compose health: `docker compose ps` shows `db` as `healthy`.

## Developer Journey Map

```
STAGE           | DEVELOPER DOES                         | FRICTION POINTS                          | STATUS
----------------|----------------------------------------|------------------------------------------|--------
1. Discover     | README "Database" section              | yml comments point at dead Supabase      | fixed (docs + comments)
2. Install      | uses installed PG, or compose on 5433  | Docker absent; port clash on 5432        | fixed (D6)
3. Hello World  | .\scripts\db-setup.ps1                 | unknown env names; JDBC vs postgres://   | fixed (D7, D4)
4. Real Usage   | stack.ps1 start, then -Verify          | silent H2 fallback                       | fixed (profile + preflight)
5. Debug        | reads problem/cause/fix messages       | dead Supabase DB_URL in .env; bad pw     | fixed (D9 + error table)
6. Upgrade      | switches from H2/Supabase              | H2 demo data not carried over            | ok (seeders rebuild demo data; documented)
```

## First-Time Developer Confusion Report (after plan)

```
Persona: Windows hackathon teammate
T+0:00  Opens README → "Database" section: "Run .\scripts\db-setup.ps1". Addressed.
T+0:20  Script asks for the postgres superuser password set in the installer. Addressed (prompt says which password).
T+0:40  Forgot that password → script prints the reset steps (pg_hba trust, ALTER USER, revert). Addressed.
T+1:00  .env merged; old Supabase DB_URL commented out, backup kept. Addressed (D9).
T+1:30  stack.ps1 start; preflight confirms Postgres before launching services. Addressed.
T+3:00  db-setup.ps1 -Verify shows row counts. Success.
```

## Error paths (Pass 3)

| Failure | Today | After plan |
|---|---|---|
| psql not found | n/a (no script) | "PostgreSQL 16+ not found in PATH or C:\Program Files\PostgreSQL. Install: `winget install PostgreSQL.PostgreSQL.16`, or use docker compose (README → Database)." |
| Service stopped | Spring stack trace, 4 services crash | "localhost:5432 is not accepting connections. Start it: `Start-Service postgresql-x64-18`." (from db-setup and stack.ps1 preflight) |
| Superuser auth fails | n/a | "Password for 'postgres' was rejected. It is the one chosen in the PostgreSQL installer. Forgot it? See README → Database → Reset postgres password." |
| Old Supabase DB_URL in .env | `password authentication failed` at startup | commented out by db-setup (D9); stack.ps1 warns if `DB_URL` is still set |
| App pw drift (.env edited by hand) | Spring auth failure | `-Verify` says "agritech password in .env does not match; re-run db-setup.ps1 to resync." |
| Tables missing after start | silent (H2 used) | `-Verify` names the missing table, its service, and `.run/<service>.log` |

## Credentials and exposure audit (requested)

- `.gitignore`: correct as is. `.env`, nested `.env`, `.env.bak` (`*.bak`) all ignored; `.env.example` allowed. No `.env` in git history.
- Secrets live only in root `.env`. `.env.example` has empty values.
- The superuser password is never stored. The app password is never on a command line (process lists are readable by other users).
- `stack.ps1` loader never echoes values. Spring does not log datasource passwords.
- Native Postgres: default `pg_hba.conf` from the Windows installer allows only 127.0.0.1/::1 with scram-sha-256. Compose publishes on 127.0.0.1 only, so the DB is not reachable from hackathon Wi-Fi.
- Persistence: native data lives in the Postgres data directory. Compose data survives `docker compose down`; `docker compose down -v` deletes the `pgdata` volume. README must say so.
- Known seeded demo passwords (admin@agritech.io etc.) in API-USAGE-GUIDE.md and the Postman env are app demo accounts, not DB credentials. Out of scope here.

## What already exists (reuse)

- `DB_*` → H2 fallback pattern in all 4 `application.yml` (becomes the profile split).
- `stack.ps1` `.env` loader (reuse; add profile switch + preflight).
- Seeders (`SeedData`, `CropSeed`, `IrrigationSeed`, `DeviceSimulator`) rebuild demo data on an empty DB.
- `.gitignore` rules (no change needed).

## NOT in scope

- Moving existing H2 or Supabase data into Postgres: the Supabase data is unreachable and seeders rebuild the demo set.
- Schema migrations (Flyway/Liquibase) replacing `ddl-auto: update`: separate change; flagged as risk below.
- One schema or database per service: tables already do not collide.
- Automating the Postgres install (winget) for a <2 min target: D3 chose 2-5 min.
- Changing Supabase Google sign-in: unaffected, it is Auth, not the DB.

## Risks to watch

- `ddl-auto: update` never drops or renames columns; entity renames leave stale columns. Fine for a hackathon, a migration tool later.
- The native path depends on the teammate knowing the installer's `postgres` password; the reset steps must be in the README.
- Mac/Linux teammates need `docker compose` + the psql one-liner; `db-setup.ps1` works under `pwsh` but is only tested on Windows.

## Implementation Tasks

- [ ] **T1 (P1, human: ~3h / CC: ~20min)**: scripts: add `scripts/db-setup.ps1` (setup + `-Verify`)
  - Surfaced by: Pass 1 / D4 magical moment
  - Files: `scripts/db-setup.ps1`
  - Verify: run twice on this machine (idempotent), then `-Verify` after `stack.ps1 start`
- [ ] **T2 (P1, human: ~1h / CC: ~10min)**: config: add root `.env.example` with POSTGRES_* + DATABASE_URL, empty secrets
  - Surfaced by: D7, empathy narrative (no root template)
  - Files: `.env.example`
  - Verify: `git check-ignore .env.example` prints nothing
- [ ] **T3 (P1, human: ~1h / CC: ~10min)**: services: `postgres` profile in 4 `application.yml`, update Supabase comments
  - Surfaced by: D7
  - Files: `auth-service`, `sensor-service`, `crop-service`, `recommendation-service`, `irrigation-service` `src/main/resources/application.yml`; `climate-service` is stateless and does not need a database schema.
  - Verify: `stack.ps1 start` logs `jdbc:postgresql://localhost:5432/agritech` in each service log
- [ ] **T4 (P1, human: ~1h / CC: ~10min)**: stack.ps1: activate profile when POSTGRES_HOST set; pg_isready preflight; warn on leftover DB_URL
  - Surfaced by: Pass 3 silent H2 fallback
  - Files: `scripts/stack.ps1`
  - Verify: stop the Postgres service → `stack.ps1 start` exits with the fix message, no service launched
- [ ] **T5 (P2, human: ~30min / CC: ~5min)**: compose: add `docker-compose.yml` per D6/D8
  - Surfaced by: user spec item 2, D6, D8
  - Files: `docker-compose.yml`
  - Verify: on a Docker machine, `docker compose up -d` → `healthy`; `psql` one-liner on 5433
- [ ] **T6 (P2, human: ~1h / CC: ~10min)**: docs: README "Database" section (native path, compose path, verify, reset postgres password, `down -v` warning)
  - Surfaced by: Pass 4, confusion report T+0:40
  - Files: `README.md`
  - Verify: follow it on a clean clone

## DX Scorecard

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  8/10  |  3/10  |  ↑     |
| API/CLI/SDK          |  8/10  |  4/10  |  ↑     |
| Error Messages       |  7/10  |  2/10  |  ↑     |
| Documentation        |  7/10  |  3/10  |  ↑     |
| Upgrade Path         |  6/10  |  3/10  |  ↑     |
| Dev Environment      |  7/10  |  4/10  |  ↑     |
| Community            |  5/10  |  5/10  |  =     |
| DX Measurement       |  4/10  |  1/10  |  ↑     |
+--------------------------------------------------------------------+
| TTHW                 | ~3 min | ~20-40 min (estimates) | ↑        |
| Competitive Rank     | Competitive                                  |
| Magical Moment       | designed via db-setup.ps1 + -Verify          |
| Product Type         | Platform (local infra / dev tooling)         |
| Mode                 | POLISH                                       |
| Overall DX           |  7/10  |  3/10  |  ↑     |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | covered (one script)                           |
| Learn by Doing     | covered (-Verify shows real data)              |
| Fight Uncertainty  | covered (error table)                          |
| Opinionated + Escape Hatches | covered (native default, compose, H2) |
| Code in Context    | covered (real services, real tables)           |
| Magical Moments    | covered                                        |
+====================================================================+
```

Pass notes: Community stays 5/10 (hackathon repo, README is the channel; nothing in scope to change). DX Measurement 4/10: `-Verify` prints elapsed time since setup; no telemetry proposed. Upgrade 6/10: data is not migrated by design.

## Unresolved Decisions

None. Outside voice was skipped (see report).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — (started, interrupted by user) | — |
| Outside Review | codex (plan-review) | Independent 2nd opinion | 0 | skipped | not run: Codex read-only mode can read the repo's `.env`, which the user declined to expose |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | issues_open | score: 3/10 → 7/10, TTHW: ~20-40 min → ~3 min (estimates) |

- **OUTSIDE COVERAGE:** codex, plan-review phase, skipped by the reviewer: a read-only Codex run can still read the ignored `.env` and send it off-machine. No outside findings.
- **VERDICT:** No reviews CLEAR yet. DX plan is ready to implement; eng review required.

NO UNRESOLVED DECISIONS
