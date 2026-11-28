# PostgreSQL Database Setup

Clean PostgreSQL (v16+) instance for SOA-Hackathon. No legacy Supabase dependencies.

## Architecture

```
┌─────────────────────────────┐
│   Application (Next.js/Java) │
└──────────────┬──────────────┘
               │ DATABASE_URL
               ↓
┌─────────────────────────────┐
│  PostgreSQL 16 (Alpine)     │
│  • Host: localhost:5432     │
│  • Volume: pgdata (named)   │
│  • Network: soa_network     │
└─────────────────────────────┘
```

**Credential Schema:**
- User: `postgres` (configurable via `POSTGRES_USER`)
- Password: Environment variable only (`POSTGRES_PASSWORD`)
- Database: `soa_hackathon` (configurable via `POSTGRES_DB`)
- Port: 5432 (mapped from container, configurable)

## Quick Start

### 1. Configuration

Copy `.env.example` to `.env` and set credentials:

```bash
cp .env.example .env
# Edit .env with your secure password
```

**Required variables:**
- `POSTGRES_PASSWORD` — strong, random (never in code)
- `POSTGRES_USER` — defaults to `postgres`
- `POSTGRES_DB` — defaults to `soa_hackathon`

### 2. Start Container

```bash
docker-compose up -d
```

Wait ~5 seconds for healthcheck to pass:
```bash
docker-compose ps
```

### 3. Verify Connection

**Linux/macOS:**
```bash
chmod +x scripts/verify-postgres.sh
./scripts/verify-postgres.sh
```

**Windows:**
```powershell
scripts\verify-postgres.bat
```

Or manual test:
```bash
PGPASSWORD=your_password psql -h localhost -p 5432 -U postgres -d soa_hackathon -c "SELECT version();"
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — | Full connection string (auto-generated from others) |
| `POSTGRES_USER` | `postgres` | Database superuser |
| `POSTGRES_PASSWORD` | — | **Required. Never commit.** |
| `POSTGRES_DB` | `soa_hackathon` | Initial database name |
| `POSTGRES_HOST` | `localhost` | Network host |
| `POSTGRES_PORT` | `5432` | Network port |

### Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Example:
```
postgresql://postgres:mypassword@localhost:5432/soa_hackathon
```

## Volume Persistence

The `pgdata` named volume survives container restarts:

```bash
# View volumes
docker volume ls | grep pgdata

# Inspect volume
docker volume inspect soa_hackthon_pgdata

# Backup data
docker run --rm -v soa_hackthon_pgdata:/pgdata -v $(pwd):/backup \
  postgres:16-alpine tar czf /backup/pgdata.tar.gz -C /pgdata .

# Restore from backup
docker run --rm -v soa_hackthon_pgdata:/pgdata -v $(pwd):/backup \
  postgres:16-alpine tar xzf /backup/pgdata.tar.gz -C /pgdata --strip-components=1
```

## Healthcheck

Native `pg_isready` runs every 10 seconds:

```bash
docker-compose ps
# STATUS column shows "healthy" once ready
```

Manual check:
```bash
pg_isready -h localhost -p 5432 -U postgres
# Responds: accepting connections
```

## Security Checklist

- ✅ **Zero hardcoded secrets** — All credentials in `.env` (gitignored)
- ✅ **Non-root execution** — postgres user inside container
- ✅ **Volume isolation** — Named volume, not host path
- ✅ **Network isolation** — Custom bridge network `soa_network`
- ✅ **Healthcheck** — Native `pg_isready` validates readiness
- ✅ **.gitignore** — `.env` and `pgdata/` never committed

**Never:**
- Commit `.env` or `.env.local`
- Use `postgres` password for production
- Expose `DATABASE_URL` in logs or analytics
- Store passwords in code comments

## Cleanup & Reset

Stop container (keeps data):
```bash
docker-compose down
```

Stop and delete all data:
```bash
docker-compose down -v
```

Remove image (fetch fresh on next `up`):
```bash
docker rmi postgres:16-alpine
```

## Troubleshooting

### Connection refused
```bash
# Check container is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Verify healthcheck
docker inspect soa_postgres | grep -A 10 '"Health"'
```

### Authentication failed
- Verify `.env` password matches what you set
- Check `POSTGRES_USER` is correct (default: `postgres`)
- Restart container: `docker-compose restart postgres`

### Port already in use
Edit `.docker-compose.yml` or `.env`:
```env
POSTGRES_PORT=5433  # Use alternate port
```

Then: `docker-compose up -d`

### Slow startup on Windows
WSL2 backend may take 30s+ for healthcheck. Use:
```bash
docker-compose up
# Wait for "database system is ready"
```

## Application Integration

### Node.js (Sequelize, Prisma, etc.)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/soa_hackathon
```

### Java (JDBC)

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/soa_hackathon
spring.datasource.username=postgres
spring.datasource.password=your_password
```

### Connection Pooling

Use `PgBouncer` for high-throughput apps. See `pgbouncer.example.ini` in this repo (future).

## Next Steps

1. ✅ Start container: `docker-compose up -d`
2. ✅ Verify: `./scripts/verify-postgres.sh`
3. 📝 Create schemas and migrations
4. 🔐 Rotate credentials before production
5. 📊 Set up monitoring (pg_stat_statements, pgAdmin optional)
