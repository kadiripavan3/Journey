#!/usr/bin/env bash
# Creates Journey's databases on a PostgreSQL you run yourself (instead of the Docker one).
# Usage: ./scripts/local-db.sh            (uses: psql postgres)
#        PSQL="sudo -u postgres psql" ./scripts/local-db.sh      (Linux, where PostgreSQL has its own user)
set -euo pipefail
PSQL="${PSQL:-psql postgres}"

# Text is sorted the way English sorts it ("cusco" next to "Cusco"), as on the Docker database and in CI, also
# where the server's own default is the bare "C" order (many Linux installs). A test that passes here then
# passes there.
ENGLISH=""
if [ "$($PSQL -Atc "select count(*) from pg_collation where collname = 'en-US-x-icu'" 2>/dev/null || echo 0)" = "1" ]; then
  ENGLISH=" template template0 locale_provider icu icu_locale 'en-US'"
fi

$PSQL -v ON_ERROR_STOP=1 -v english="$ENGLISH" <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'journey') then
    create role journey login password 'journey' createdb;
  end if;
end $$;
select 'create database journey owner journey' || :'english' where not exists (select from pg_database where datname = 'journey') \gexec
select 'create database journey_test owner journey' || :'english' where not exists (select from pg_database where datname = 'journey_test') \gexec
SQL
echo "Databases 'journey' and 'journey_test' are ready (user: journey, password: journey)."
