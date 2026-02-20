# Seed database – popolamento dati

Questa cartella contiene gli script per popolare il database con aree verdi e asset (alberi, aiuole, siepi, ecc.) a livello **regionale** o per un **singolo comune**.

**Requisiti:** lo stack Docker Compose deve essere avviato (contenitore `postgis` in esecuzione). Esegui gli script **dalla root del progetto**.

---

## 1. Popolamento per regione – `run_populate_region_data.sh`

Genera aree verdi e green asset per i comuni di una o più regioni italiane (logica “extreme”: Voronoi, bulk insert, partizioni per `region_id`).

### Uso

```bash
# Dalla root del progetto

# Popola tutte le 20 regioni (ordine alfabetico)
./infrastructure/scripts/database/seed/run_populate_region_data.sh

# Popola solo le regioni indicate (slug separati da spazio)
./infrastructure/scripts/database/seed/run_populate_region_data.sh lazio lombardia veneto

# Una sola regione
./infrastructure/scripts/database/seed/run_populate_region_data.sh sicilia

# Elenco regioni disponibili e sintassi
./infrastructure/scripts/database/seed/run_populate_region_data.sh -h
```

### Regioni disponibili (slug)

`abruzzo`, `basilicata`, `calabria`, `campania`, `emilia_romagna`, `friuli_venezia_giulia`, `lazio`, `liguria`, `lombardia`, `marche`, `molise`, `piemonte`, `puglia`, `sardegna`, `sicilia`, `toscana`, `trentino_alto_adige`, `umbria`, `valle_daosta`, `veneto`.

### File coinvolti

- `populate_region_data/seed_<slug>_extreme.sql` – uno script SQL per regione (es. `seed_lazio_extreme.sql`).

---

## 2. Boost singolo comune – `run_boost_municipality.sh`

Esegue **pulizia** (eliminazione asset e aree esistenti per il comune) e **popolamento** (generazione di macro-aree, sub-aree e asset) per un solo comune. Utile per test o per “potenziare” un comune specifico (es. Roma) con molti più dati.

### Uso

```bash
# Dalla root del progetto

# Comune senza apice nel nome
./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma
./infrastructure/scripts/database/seed/run_boost_municipality.sh Milano

# Comune con apice (usare le virgolette)
./infrastructure/scripts/database/seed/run_boost_municipality.sh "L'Aquila"
```

Il nome deve coincidere con quello in `public.municipalities.name` (es. `Roma`, `Milano`, `L'Aquila`). Lo script esegue in sequenza:

1. **Clean** – `boost_municipality/municipality_clean.sql`
2. **Populate** – `boost_municipality/municipality_populate.sql`

### File coinvolti

- `boost_municipality/municipality_clean.sql` – elimina asset e aree per il comune target.
- `boost_municipality/municipality_populate.sql` – crea partizioni (se serve), macro-aree, sub-aree e inserisce gli asset.

Il comune viene passato da terminale; negli SQL si usa la variabile psql `target_municipality` impostata dallo script.

---

## Riepilogo comandi

| Obiettivo              | Comando |
|------------------------|--------|
| Popolare tutte le regioni | `./infrastructure/scripts/database/seed/run_populate_region_data.sh` |
| Popolare alcune regioni   | `./infrastructure/scripts/database/seed/run_populate_region_data.sh lazio lombardia` |
| Aiuto regioni              | `./infrastructure/scripts/database/seed/run_populate_region_data.sh -h` |
| Boost comune (es. Roma)    | `./infrastructure/scripts/database/seed/run_boost_municipality.sh Roma` |
| Boost comune con apice     | `./infrastructure/scripts/database/seed/run_boost_municipality.sh "L'Aquila"` |
