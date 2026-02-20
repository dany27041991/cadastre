# Clean Code e Clean Architecture – Linee Guida

Linee guida per mantenere il codice leggibile, manutenibile e allineato all’architettura del progetto (backend Clean Architecture, frontend modulare). Da usare insieme a [Trunk Based Development](./tbd.md) e alle strutture ufficiali: [backend – folder structure](../../backend/docs/folders-structure-be.md), [backend – struttura modulare](../../backend/docs/modular-package-structure.md), [frontend – folder structure](../../frontend/docs/folders-structure-fe.md), [frontend – struttura modulare](../../frontend/docs/modular-package-structure.md).

---

# 📌 Scopo

- **Clean Code**: nomi chiari, funzioni piccole, assenza di duplicazione, codice autoesplicativo.
- **SOLID**: principi di progettazione (Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion) per moduli e classi.
- **Clean Architecture**: separazione dei livelli (domain, application, infrastructure), dipendenze verso il dominio, testabilità.

Obiettivo: codice che si capisce subito, si modifica senza paura e si integra bene con il resto del progetto.

---

# ✍️ Clean Code

## Naming

- **Nomi che rivelano intento**: variabili, funzioni e tipi devono dire *cosa* rappresentano e *perché* esistono.
- **Evitare abbreviazioni oscure**: `reg` invece di `region` solo se il contesto è brevissimo e univoco; preferire `region`, `province`, `municipality`.
- **Funzioni**: verbi o frasi brevi. Es. `get_regions`, `build_feature_collection`, `load_green_areas`.
- **Booleani**: prefissi tipo `is_`, `has_`, `can_`. Es. `is_feature_enabled`, `has_geometry`.

**Backend (Python)**  
- Moduli/package: snake_case.  
- Classi: PascalCase.  
- Funzioni e variabili: snake_case.

**Frontend (TypeScript)**  
- File: kebab-case o camelCase coerente con la convenzione del modulo (es. `greenAreas.api.ts`).  
- Tipi/interfacce: PascalCase.  
- Funzioni e variabili: camelCase.

---

## Funzioni e metodi

- **Piccole**: una responsabilità per funzione; se serve un commento “e poi fa anche…”, spezzare.
- **Pochi argomenti**: preferire 0–2; oltre è un segnale per introdurre un DTO/oggetto parametro.
- **Niente effetti collaterali nascosti**: il nome deve descrivere tutto ciò che la funzione fa (side-effect incluso).
- **Un solo livello di astrazione**: dentro una funzione non mescolare dettagli di basso livello (es. SQL o formattazione) con orchestrazione di alto livello; estrarre in funzioni con nome esplicito.

---

## Commenti e documentazione

- **Il codice è la documentazione principale**: preferire nomi e strutture chiari a commenti lunghi.
- **Commentare il “perché”**, non il “cosa”: evitare ridondanza con il codice; spiegare vincoli, eccezioni di business, riferimenti a issue/ticket.
- **TODO/FIXME**: ammessi solo con contesto e, se possibile, riferimento (es. `TODO(issue-123): …`); da ripulire prima del merge su `main`.
- **Docstring/ JSDoc**: per API pubbliche (use case, endpoint, funzioni esportate da moduli condivisi); sintesi in una riga + parametri/ritorno dove utile.

---

## DRY e riuso

- **Non ripetere la stessa logica**: estrarre in funzione/helper/modulo condiviso; attenzione a non creare accoppiamenti inutili (es. shared solo per tipi e utilità davvero trasversali).
- **Duplicazione accettabile** quando evita dipendenze sbagliate: es. non far dipendere `shared` da `features` o da `api` solo per evitare una copia di un tipo.

---

## Gestione errori e edge case

- **Errori espliciti**: preferire eccezioni tipizzate (backend) e tipi di errore chiari (frontend); evitare errori generici senza contesto.
- **Fail fast**: validare input e precondizioni all’ingresso; non propagare stati invalidi in profondità.
- **Niente magic number/string**: costanti con nome significativo (config, constanti di dominio, enum dove ha senso).

---

## Testabilità

- **Funzioni pure dove possibile**: stesse entrate → stesse uscite; logica di business isolata da I/O (DB, HTTP, file).
- **Dipendenze iniettate**: use case che ricevono repository/servizi dal costruttore o da factory (come in `core.api.container`); evita accoppiamento diretto a implementazioni concrete nei layer applicativi.
- **Test**: almeno i percorsi critici (use case, mapping, validazioni); i test sono parte del “clean code” (nomi chiari, un assert per concetto dove possibile).

---

# 🔷 Principi SOLID

I principi SOLID guidano la progettazione di classi e moduli: rendono il codice estendibile senza stravolgimenti e allineato alla Clean Architecture.

---

## S – Single Responsibility (Responsabilità singola)

- **Una classe, un motivo di cambiamento**: ogni modulo/classe ha un solo compito ben definito (es. un use case fa una sola operazione; un repository gestisce un solo aggregato/entità).
- **Backend**: use case in `application/usecases/query/` (letture) e `usecases/command/` (scritture); controller in `infrastructure/web/` solo per HTTP; repository solo per persistenza. Non mescolare in una sola classe “validazione + chiamata DB + costruzione risposta”.
- **Frontend**: componenti UI vs hook vs layer API separati; un file `*.api.ts` per un ambito (es. green areas), non un unico client che fa tutto.

---

## O – Open/Closed (Aperto/chiuso)

- **Aperto alle estensioni, chiuso alle modifiche**: estendere il comportamento con nuovo codice (nuove classi, nuovi use case) senza modificare quello esistente.
- **Backend**: nuovi livelli territoriali o nuovi tipi di area come nuovi use case/repository, non branch `if tipo == X` dentro codice già stabile. Nuovi adapter (mapper, repository) aggiunti senza cambiare i use case.
- **Frontend**: nuove feature come nuovi moduli in `features/`, nuovi endpoint come nuove funzioni in `api/`, senza stravolgere shared o componenti esistenti. Preferire composizione e props a “if (featureX) …” nei componenti core.

---

## L – Liskov Substitution (Sostituibilità di Liskov)

- **I sottotipi devono essere sostituibili ai tipi base**: dove si usa un’interfaccia o una classe base, qualsiasi implementazione concreta deve rispettare il contratto (stessi pre/post-condizioni, nessun comportamento a sorpresa).
- **Backend**: se un use case dipende da un “repository di regioni”, qualsiasi implementazione (mock, PostGIS, in-memory) deve poter essere usata al suo posto senza rompere il use case.
- **Frontend**: componenti che ricevono callback o interfacce (es. `onSelect`, `MapHandler`) devono poter essere sostituiti con implementazioni diverse senza che il chiamante debba conoscere il dettaglio.

---

## I – Interface Segregation (Segregazione delle interfacce)

- **Interfacce piccole e specifiche**: i client non devono dipendere da metodi che non usano. Preferire più interfacce mirate a una sola interfaccia “grassissima”.
- **Backend**: use case che ricevono solo i repository di cui hanno bisogno (es. solo `RegionRepository`), non un “TerritoryService” con decine di metodi. DTO input/output specifici per endpoint, non DTO giganti riutilizzati ovunque.
- **Frontend**: tipi e hook esposti per ambito (es. tipi per la mappa, tipi per le aree verdi); evitare tipi “globali” con decine di campi opzionali. API client con funzioni specifiche (`getGreenAreas`, `getRegions`) invece di un unico `request(path, body)` generico dove possibile.

---

## D – Dependency Inversion (Inversione delle dipendenze)

- **Dipendere da astrazioni, non da implementazioni**: i layer interni (domain, application) non dipendono dai dettagli (DB, HTTP); sono i layer esterni (infrastructure) a dipendere dalle astrazioni e a fornire le implementazioni.
- **Backend**: use case dipendono da repository (iniettati da `core.api.container`), non da `Session` o da modelli SQLAlchemy. Il domain non conosce PostGIS; l’infrastructure implementa “come” si persiste.
- **Frontend**: le feature dipendono da `api` (astrazione “dati dal backend”) e da tipi in `shared`, non da `fetch` o URL sparsi. L’api nasconde il dettaglio HTTP; eventuali mock sostituiscono il client senza toccare le feature.

---

# 🏛️ Clean Architecture (allineamento al progetto)

## Principio di base

Le dipendenze puntano **verso il dominio**: il dominio non dipende da DB, HTTP o framework. L’infrastruttura dipende dall’application; l’application dipende dal domain.

---

## Backend (territory, core, shared)

Struttura di riferimento: [backend – Folder structure](../../backend/docs/folders-structure-be.md) e [backend – Struttura modulare](../../backend/docs/modular-package-structure.md).

| Livello | Ruolo | Dove vive |
|--------|--------|-----------|
| **Domain** | Entità, value object, tipi di dominio (es. GeoJSONFeatureCollection) | `territory/{geo,areas,assets}/domain/entities/` |
| **Application** | Use case: **query** (letture) e **command** (scritture); orchestrazione, nessun dettaglio HTTP/DB | `territory/{geo,areas,assets}/application/usecases/query/` e `.../usecases/command/` |
| **Infrastructure** | DTO (input/output), repository, mapper, route HTTP | `territory/.../infrastructure/dto/`, `repository/`, `web/` |

**Query e Command (letture vs scritture):** ogni sottomodulo (geo, areas, assets) separa i use case in due cartelle: **usecases/query/** per le **letture** (es. GetRegions, CatalogGreenArea, CatalogGreenAsset) e **usecases/command/** per le **scritture** (creazione, aggiornamento, cancellazione). Route GET → use case da query; route POST/PUT/PATCH/DELETE → use case da command. Nessun use case che mescoli lettura e scrittura nello stesso flusso.

Regole operative:

- **Domain**: nessun import da application o infrastructure; nessun riferimento a FastAPI, Redis o a dettagli di sessione/query (la persistenza è in infrastructure). Entità e value object; in **geo** è definito **GeoJSONFeatureCollection**; areas/assets re-esportano da `territory.geo.domain.entities`.
- **Application**: use case in **usecases/query/** (solo letture) e **usecases/command/** (solo scritture); ricevono repository concreti (iniettati da `core.api.container`); nessun DTO HTTP nelle signature (i DTO restano in infrastructure). Versione “soft”: no porte formali, use case usano i repository concreti.
- **Infrastructure**: **dto/input/** e **dto/output/** per request/response; **repository/** (persistenza PostGIS); **mapper/** (in geo: feature_collection_mapper; areas/assets: green_area/asset_feature_collection_mapper); **web/** (controller FastAPI, es. region_ctrl, green_area_ctrl); le route usano **core.api.dependencies** per i use case.
- **core**: **config**, **database/** (session factory, Base), **builders/** (se usati per GeoJSON), **api/container.py** (crea repository e use case), **api/dependencies.py** (factory per i route handler). Dipende da shared e territory, non il contrario.
- **shared**: riservato a tipi/utility trasversali futuri; **non** dipende da core o territory. GeoJSON e mapper vivono in **territory/geo**, non in shared.

Uso dei **mapper**: la costruzione di GeoJSON (feature collection) vive in `territory.geo.infrastructure.mapper`; i repository di areas/assets la riusano. Il tipo GeoJSON di dominio resta in `territory.geo.domain.entities`. Dipendenze tra moduli: areas/assets → geo; core orchestra e monta i router da **territory** (es. `main.py` include il router territory con prefisso `/api/territory`). Riferimento: [modular-package-structure – backend](../../backend/docs/modular-package-structure.md) per il grafo di dipendenze e le regole.

---

## Frontend (api, shared, features, components)

Struttura di riferimento: [frontend – Struttura cartelle](../../frontend/docs/folders-structure-fe.md) e [frontend – Struttura modulare](../../frontend/docs/modular-package-structure.md).

| Area | Ruolo | Dipendenze |
|------|--------|------------|
| **api/** | Client HTTP, fetcher, contratti API (tipi request/response). Es. `client.ts`, `territory/`, `areas/greenAreas.api.ts`, `assets/greenAssets.api.ts`. | Può usare **shared** (costanti, tipi). Non importare da **features** o **components**. |
| **shared/** | Costanti, tipi (`types/` per territory, geojson, api, navigation, map), config, stili globali, hook condivisi (useTerritoryMap, useTerritoryNavigation), factory/loaders. | **Nessun** import da **features**, **api** o **components**. Solo tipi/utility generici. |
| **features/** | Componenti e logica per feature (es. **features/map**: MapHeader, GreenPalette, tipi UI). Stato e uso di api/shared. | Può usare **api**, **shared** e **components**. **Non** importare da altre features. |
| **components/** | Layout e UI riutilizzabili (sidebar, main-content, map-breadcrumbs). Presentazionali o layout puri. | Solo **shared** (tipi, costanti, stili). Nessuna chiamata API né stato di dominio. |

Regole operative:

- **shared** è il “nucleo” condiviso: niente dipendenze da features, api o components; solo tipi, utilità e configurazione stabile. Gli hook territorio ricevono l’API iniettata dal chiamante (es. App).
- **api** incapsula tutto ciò che parla con il backend (client, URL, tipi di risposta); le feature consumano l’api, non costruiscono richieste raw.
- **features**: non si importano tra loro; preferire composizione e props/handlers chiari. Allineamento con backend: `api/territory` riflette geo, areas, assets.
- **components**: nessuna logica di dominio né chiamate API; solo shared per tipi/costanti/stili.

Naming e file: coerenza con la struttura esistente (es. `*.api.ts` per layer API, barrel `index.ts` per re-export). Riferimento: [modular-package-structure – frontend](../../frontend/docs/modular-package-structure.md) per il grafo di dipendenze e “cosa vive dove”.

---

# 🔗 Allineamento con le altre linee guida

- **TBD**: commit piccoli e atomici, `main` sempre funzionante; il clean code riduce il rischio di regressioni quando si integra spesso. Vedi [tbd.md](./tbd.md).
- **Feature flag**: per feature incomplete, nessun comportamento parzialmente funzionante esposto; il codice dietro flag deve comunque rispettare naming e livelli. Vedi sezione “Feature Incomplete” in [tbd.md](./tbd.md).
- **CI**: codice compilabile, testabile e deployabile; Clean Architecture e funzioni piccole facilitano test e refactoring senza bloccare la pipeline.

---

# 📏 Checklist rapida

Prima di concludere una modifica:

- [ ] Nomi chiari (variabili, funzioni, tipi/file).
- [ ] Funzioni piccole e con una sola responsabilità (SRP).
- [ ] Nessuna duplicazione non giustificata (DRY).
- [ ] Estensioni senza modificare codice stabile (OCP); dipendenze da astrazioni, non da implementazioni (DIP).
- [ ] Backend: use case letture in **usecases/query/**, scritture in **usecases/command/**; logica di dominio in domain/application; DTO e HTTP in infrastructure.
- [ ] Frontend: shared senza import da features, api o components; features → api, shared, components (no feature → feature); components solo shared.
- [ ] Commenti solo dove servono “perché” o vincoli; niente codice commentato da mergiare.
- [ ] Test presenti dove serve (use case, mapping, validazioni critiche).
