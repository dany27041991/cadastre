#!/usr/bin/env bash
# =============================================================================
# Boost dati per un singolo comune: clean + populate.
# Il nome del comune si passa da terminale (es. Roma, Milano, L'Aquila).
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
#   ./infrastructure/scripts/database/seed/run_boost_municipality.sh Milano
#   ./infrastructure/scripts/database/seed/run_boost_municipality.sh "L'Aquila"
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
BOOST_DIR="$SCRIPT_DIR/boost_municipality"
cd "$COMPOSE_DIR"
source .env 2>/dev/null || true
DB_NAME="${POSTGRES_DB:-arboreal_green_cadastre}"
DB_USER="${POSTGRES_USER:-cadastre}"

if [[ -z "${1:-}" ]]; then
  echo "Uso: $0 <nome_comune>" >&2
  echo "Esempio: $0 Roma" >&2
  echo "         $0 \"L'Aquila\"" >&2
  exit 1
fi

# Nome comune: escape apice per SQL (' -> '') e per sed (\, &)
MUNICIPALITY_RAW="$1"
SQL_VALUE="${MUNICIPALITY_RAW//\'/\'\'}"
SED_SAFE=$(printf '%s' "$SQL_VALUE" | sed 's/[\\&]/\\&/g')

echo "=============================================="
echo "1/2 BOOST COMUNE - PULIZIA: $MUNICIPALITY_RAW"
echo "=============================================="
sed "s/__TARGET_MUNICIPALITY__/$SED_SAFE/g" "$BOOST_DIR/municipality_clean.sql" | docker compose exec -T postgis psql -U "$DB_USER" -d "$DB_NAME" -f -

echo ""
echo "=============================================="
echo "2/2 BOOST COMUNE - POPOLAMENTO: $MUNICIPALITY_RAW"
echo "=============================================="
sed "s/__TARGET_MUNICIPALITY__/$SED_SAFE/g" "$BOOST_DIR/municipality_populate.sql" | docker compose exec -T postgis psql -U "$DB_USER" -d "$DB_NAME" -f -

echo ""
echo "=============================================="
echo "BOOST COMPLETATO: $MUNICIPALITY_RAW"
echo "=============================================="
