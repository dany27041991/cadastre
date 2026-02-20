#!/usr/bin/env bash
# =============================================================================
# Esegue i seed extreme per le regioni italiane.
# File: populate_region_data/seed_<regione>_extreme.sql
# =============================================================================
# Uso (dalla root progetto):
#   ./infrastructure/scripts/database/seed/run_populate_region_data.sh
#     → popola tutte le 20 regioni
#   ./infrastructure/scripts/database/seed/run_populate_region_data.sh lazio lombardia veneto
#     → popola solo Lazio, Lombardia, Veneto
#   ./infrastructure/scripts/database/seed/run_populate_region_data.sh -h
#     → elenca le regioni disponibili
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
DATA_DIR="$SCRIPT_DIR/populate_region_data"
cd "$COMPOSE_DIR"
source .env 2>/dev/null || true
DB_NAME="${POSTGRES_DB:-arboreal_green_cadastre}"
DB_USER="${POSTGRES_USER:-cadastre}"

# Tutte le regioni (slug -> file)
ALL_REGIONS=(
  abruzzo
  basilicata
  calabria
  campania
  emilia_romagna
  friuli_venezia_giulia
  lazio
  liguria
  lombardia
  marche
  molise
  piemonte
  puglia
  sardegna
  sicilia
  toscana
  trentino_alto_adige
  umbria
  valle_daosta
  veneto
)

usage() {
  echo "Uso: $0 [regione1 [regione2 ...]]"
  echo "  Senza argomenti: popola tutte le 20 regioni."
  echo "  Con argomenti: popola solo le regioni indicate (slug)."
  echo ""
  echo "Regioni disponibili (slug):"
  for r in "${ALL_REGIONS[@]}"; do echo "  - $r"; done
  echo ""
  echo "Esempio: $0 lazio lombardia veneto"
}

# -h / --help
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# Se ci sono argomenti, usali come lista regioni; altrimenti tutte
if [[ $# -gt 0 ]]; then
  TO_RUN=()
  for slug in "$@"; do
    slug_lower=$(echo "$slug" | tr '[:upper:]' '[:lower:]')
    file="seed_${slug_lower}_extreme.sql"
    if [[ -f "$DATA_DIR/$file" ]]; then
      TO_RUN+=("$file")
    else
      echo "Errore: regione '$slug' non valida o file mancante ($file)." >&2
      echo "Usa $0 -h per l'elenco delle regioni." >&2
      exit 1
    fi
  done
else
  TO_RUN=()
  for r in "${ALL_REGIONS[@]}"; do
    TO_RUN+=("seed_${r}_extreme.sql")
  done
fi

TOTAL=${#TO_RUN[@]}
n=0
for f in "${TO_RUN[@]}"; do
  n=$((n + 1))
  label="${f#seed_}"
  label="${label%_extreme.sql}"
  echo ""
  echo "=============================================="
  echo "$n/$TOTAL POPULATE REGION: $label"
  echo "=============================================="
  docker compose exec -T postgis psql -U "$DB_USER" -d "$DB_NAME" -f - < "$DATA_DIR/$f"
done

echo ""
echo "=============================================="
echo "POPULATE REGION DATA COMPLETATO ($TOTAL regioni)"
echo "=============================================="
