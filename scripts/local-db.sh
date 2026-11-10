#!/usr/bin/env bash
# Creates Journey's databases on a PostgreSQL you run yourself (instead of the Docker one).
# Usage: ./scripts/local-db.sh            (uses: psql postgres)
#        PSQL="sudo -u postgres psql" ./scripts/local-db.sh      (Linux, where PostgreSQL has its own user)
set -euo pipefail
PSQL="${PSQL:-psql postgres}"

$PSQL -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'journey') then
    create role journey login password 'journey' createdb;
  end if;
end $$;
select 'create database journey owner journey' where not exists (select from pg_database where datname = 'journey') \gexec
select 'create database journey_test owner journey' where not exists (select from pg_database where datname = 'journey_test') \gexec
SQL
echo "Databases 'journey' and 'journey_test' are ready (user: journey, password: journey)."
