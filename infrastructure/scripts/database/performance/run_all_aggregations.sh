#!/usr/bin/env bash
# =============================================================================
# Esegue tutte le aggregazioni in sequenza e genera report performance.
# Uso: ./infrastructure/scripts/database/performance/run_all_aggregations.sh
#      oppure: bash infrastructure/scripts/database/performance/run_all_aggregations.sh
# Eseguire dalla root del progetto. Docker Compose in infrastructure/compose.
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_DIR="$PROJECT_ROOT/infrastructure/compose"
cd "$COMPOSE_DIR"
source .env 2>/dev/null || true
DB_NAME="${POSTGRES_DB:-arboreal_green_cadastre}"

# Cartella logs
LOGS_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGS_DIR"

# Timestamp per questa esecuzione
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========== Benchmark aggregazioni (01..07) =========="
echo "Data: $(date)"
echo "Logs in: $LOGS_DIR"
echo ""

# Esegui ogni script e salva log separato
for f in 01_aggregations_italy.sql 02_aggregations_by_region.sql 03_aggregations_by_province.sql 04_aggregations_by_municipality.sql 06_aggregations_by_area_level.sql 07_advanced_aggregations.sql; do
  LOG_NAME="${f%.sql}_${TIMESTAMP}.log"
  LOG_PATH="$LOGS_DIR/$LOG_NAME"
  
  echo ">>> $f"
  echo "    Log: logs/$LOG_NAME"
  
  {
    echo "========== $f =========="
    echo "Data: $(date)"
    echo ""
    docker compose exec -T postgis psql -U "${POSTGRES_USER:-cadastre}" -d "$DB_NAME" -f - < "$SCRIPT_DIR/sql/$f" || true
    echo ""
    echo "========== End $f =========="
  } 2>&1 | tee "$LOG_PATH"
  
  echo ""
done

echo "========== End benchmark =========="
echo ""

# Combina tutti i log per il report finale
COMBINED_LOG="$LOGS_DIR/combined_${TIMESTAMP}.log"
cat "$LOGS_DIR"/*_${TIMESTAMP}.log > "$COMBINED_LOG" 2>/dev/null || true
LOG_FILE="$COMBINED_LOG"

# Genera report automatico
echo ""
echo "=========================================="
echo "GENERAZIONE REPORT PERFORMANCE"
echo "=========================================="
echo ""

# Estrai query con tempi (compatibile con awk BSD/macOS)
echo "=== TUTTE LE QUERY (con tempi) ==="
echo ""
grep -E "^(Q_|Time:)" "$LOG_FILE" | \
  awk '
    /^Q_/ { 
      query=$0; 
      gsub(/^Q_/, "", query);
      gsub(/:.*$/, "", query);
    }
    /^Time:/ {
      # Estrai numero dopo "Time: " (compatibile BSD awk)
      sub(/^Time: /, "");
      sub(/ ms.*$/, "");
      ms = $0 + 0;
      sec = ms / 1000;
      printf "%-50s %10.2f s\n", query, sec;
    }
  ' || echo "Nessuna query trovata"

echo ""
echo "=== QUERY LENTE (> 5 secondi) ==="
echo ""
grep -E "^(Q_|Time:)" "$LOG_FILE" | \
  awk '
    /^Q_/ { 
      query=$0; 
      gsub(/^Q_/, "", query);
      gsub(/:.*$/, "", query);
    }
    /^Time:/ {
      line = $0;
      sub(/^Time: /, "", line);
      sub(/ ms.*$/, "", line);
      ms = line + 0;
      if (ms > 5000) {
        sec = ms / 1000;
        printf "⚠️  %-45s %10.2f s\n", query, sec;
      }
    }
  ' || echo "Nessuna query lenta trovata"

echo ""
echo "=== STATISTICHE ==="
echo ""

# Conta query totali
TOTAL=$(grep -c "^Time:" "$LOG_FILE" 2>/dev/null || echo 0)
echo "Query totali eseguite: $TOTAL"

# Conta query lente (> 5s) - compatibile BSD awk
SLOW=$(grep "^Time:" "$LOG_FILE" | awk '{sub(/^Time: /, ""); sub(/ ms.*$/, ""); if ($0+0 > 5000) count++} END {print count+0}')
echo "Query lente (>5s): $SLOW"

# Tempo totale - compatibile BSD awk
TOTAL_TIME=$(grep "^Time:" "$LOG_FILE" | awk '{sub(/^Time: /, ""); sub(/ ms.*$/, ""); sum += $0+0} END {printf "%.2f", sum/1000}')
echo "Tempo totale: ${TOTAL_TIME} s"

# Query più lenta - compatibile BSD awk
echo ""
echo "=== QUERY PIÙ LENTA ==="
grep -E "^(Q_|Time:)" "$LOG_FILE" | \
  awk '
    /^Q_/ { 
      query=$0; 
      gsub(/^Q_/, "", query);
      gsub(/:.*$/, "", query);
    }
    /^Time:/ {
      line = $0;
      sub(/^Time: /, "", line);
      sub(/ ms.*$/, "", line);
      ms = line + 0;
      if (ms > max_ms) {
        max_ms = ms;
        max_query = query;
      }
    }
    END {
      if (max_ms > 0) {
        sec = max_ms / 1000;
        printf "%-50s %10.2f s\n", max_query, sec;
      }
    }
  '

echo ""
echo "=== SUGGERIMENTI OTTIMIZZAZIONE ==="
echo ""
echo "Per query lente (>5s):"
echo "  1. Verifica indici su: asset_type, geometry_type, species, green_area_id"
echo "  2. Considera viste materializzate per aggregazioni frequenti"
echo "  3. Per ST_Intersects/ST_Area: verifica indici GIST su geometry"
echo "  4. Per COUNT(DISTINCT): valuta indici su colonne aggregate"
echo "  5. Per JOIN pesanti: indici su FK (regione_id, provincia_id, istat_code)"
echo ""
echo "=========================================="
echo "Log individuali in: $LOGS_DIR/"
echo "  - 01_aggregations_italy_${TIMESTAMP}.log"
echo "  - 02_aggregations_by_region_${TIMESTAMP}.log"
echo "  - 03_aggregations_by_province_${TIMESTAMP}.log"
echo "  - 04_aggregations_by_municipality_${TIMESTAMP}.log"
echo "  - 06_aggregations_by_area_level_${TIMESTAMP}.log"
echo "  - 07_advanced_aggregations_${TIMESTAMP}.log"
echo "Log combinato: $COMBINED_LOG"
echo "=========================================="
