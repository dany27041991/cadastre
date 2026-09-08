# Init PostGIS – Schema e dati territoriali

Il database dell’applicazione è **`arboreal_green_cadastre`**, come da `POSTGRES_DB` in `infrastructure/compose/.env`.

- Viene **creato automaticamente** dall’immagine Postgres al primo avvio (volume vuoto).
- Gli script in `sql/` sono eseguiti in ordine da `run-init.sh`.
- **Green viz non è in PostGIS:** aree/asset/cluster vivono su MinIO (seed → lakehouse). Vedi [docs/infrastructure/minio-lakehouse.md](../../../../docs/infrastructure/minio-lakehouse.md).

## Cosa crea l’init

| Script | Contenuto |
|--------|-----------|
| `01-*` | Schema `public`: regions, provinces, municipalities, submunicipal, census, area_level, tipi DBT, … |
| `02-init-schema-cadastre.sql` | Solo `CREATE SCHEMA cadastre` (**vuoto** — nessun `green_*`) |
| `02b-*` / seed translations | Label enum in `public.translations` |
| `04` / `05` / `06` | No-op o solo admin (nessuna partizione green) |

## Se nei log vedi: `FATAL: database "catasto_arboreo" does not exist`

Un client sta provando a connettersi al database **`catasto_arboreo`**, che **non esiste** e non va creato.

- **Cosa fare:** configurare il client (backend, tool, variabili d’ambiente) per usare il database **`arboreal_green_cadastre`**.
- Verifica che in `infrastructure/compose/.env` ci sia:
  - `POSTGRES_DB=arboreal_green_cadastre`
- I servizi in docker-compose usano già `${POSTGRES_DB:-arboreal_green_cadastre}`; se qualcosa punta ancora a `catasto_arboreo`, va corretto in quel servizio o nel suo `.env`.

## Se vedi: `ERROR: relation "public.regions" does not exist`

Lo schema non è stato applicato (es. volume già esistente e initdb.d non rieseguito).

- Applica schema e anagrafe a mano (da `infrastructure/compose`), oppure riparti da zero:
  - `docker compose down -v` e poi `docker compose up -d` (al primo avvio gli script in `initdb.d` applicano tutto).
- Cutover green: wipe volumi obbligatorio — [lakehouse-cutover-runbook.md](../../../../docs/infrastructure/lakehouse-cutover-runbook.md).
