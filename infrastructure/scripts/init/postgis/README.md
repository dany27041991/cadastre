# Init PostGIS – Schema e dati territoriali

Il database dell’applicazione è **`arboreal_green_cadastre`**, come da `POSTGRES_DB` in `infrastructure/compose/.env`.

- Viene **creato automaticamente** dall’immagine Postgres al primo avvio (volume vuoto).
- Gli script in `sql/` sono eseguiti in ordine (01–05) da `run-init.sh`; 05 crea le partizioni per regione dopo il caricamento anagrafe (04).

## Se nei log vedi: `FATAL: database "catasto_arboreo" does not exist`

Un client sta provando a connettersi al database **`catasto_arboreo`**, che **non esiste** e non va creato.

- **Cosa fare:** configurare il client (backend, tool, variabili d’ambiente) per usare il database **`arboreal_green_cadastre`**.
- Verifica che in `infrastructure/compose/.env` ci sia:
  - `POSTGRES_DB=arboreal_green_cadastre`
- I servizi in docker-compose usano già `${POSTGRES_DB:-arboreal_green_cadastre}`; se qualcosa punta ancora a `catasto_arboreo`, va corretto in quel servizio o nel suo `.env`.

## Se vedi: `ERROR: relation "public.regions" does not exist`

Lo schema non è stato applicato (es. volume già esistente e initdb.d non rieseguito).

- Applica schema e anagrafe a mano (da `infrastructure/compose`):
  - `docker compose exec -T postgis psql -U cadastre -d arboreal_green_cadastre -f - < ../scripts/init/postgis/sql/01-init-schema.sql`
  - poi 02, 03, 04, 05-create-partitions.sql nello stesso modo (05 richiede che public.regions sia popolato).
- Oppure riparti da zero: `docker compose down -v` e poi `docker compose up -d` (al primo avvio gli script in `initdb.d` applicano tutto).
