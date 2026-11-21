#!/usr/bin/env bash
# Installs the PostgreSQL server binaries of one major from the PostgreSQL apt repository (PGDG) on an Ubuntu runner,
# to /usr/lib/postgresql/<major>/bin, without creating or starting a cluster: tests start their own (PG_BIN_DIR).
# Production runs PostgreSQL 18, and CI proves the server tests on it (docs/v9/ENGINEERING.md, Built for the factory).
set -euo pipefail

major=${1:?usage: postgres.sh <major>}
codename=$(lsb_release -cs)

sudo install -d /usr/share/postgresql-common/pgdg /etc/postgresql-common
sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $codename-pgdg main" |
    sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
# No main cluster: the package would otherwise create and start one.
echo 'create_main_cluster = false' | sudo tee -a /etc/postgresql-common/createcluster.conf >/dev/null
# Only the PGDG list is refreshed; the runner's own lists are current enough for the dependencies.
sudo apt-get update -qq -o Dir::Etc::sourcelist=sources.list.d/pgdg.list -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=0
sudo apt-get install -y -qq --no-install-recommends "postgresql-$major" >/dev/null
"/usr/lib/postgresql/$major/bin/postgres" --version
