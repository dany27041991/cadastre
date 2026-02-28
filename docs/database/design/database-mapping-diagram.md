```mermaid
erDiagram
    %% =====================================================
    %% TERRITORIAL HIERARCHY
    %% Traversable: REGIONS → PROVINCES → MUNICIPALITIES → SUBMUNICIPAL_AREA (level 1 → 2 → 3 via parent_id)
    %% =====================================================

    REGIONS {
        SERIAL id PK "Unique identifier"
        VARCHAR code UK "Unique region code"
        VARCHAR name "Region name"
        GEOMETRY geometry "Region boundary (EPSG:4326)"
    }

    PROVINCES {
        SERIAL id PK "Unique identifier"
        VARCHAR code "Province code"
        VARCHAR name "Province name"
        INTEGER region_id FK "Reference to REGIONS.id"
        GEOMETRY geometry "Province boundary (EPSG:4326)"
    }

    MUNICIPALITIES {
        SERIAL id PK "Unique identifier"
        VARCHAR istat_code UK "Unique ISTAT municipality code"
        VARCHAR name "Municipality name"
        INTEGER province_id FK "Reference to PROVINCES.id"
        GEOMETRY geometry "Municipality boundary (EPSG:4326)"
    }

    SUBMUNICIPAL_AREA {
        SERIAL id PK "Unique identifier"
        INTEGER municipality_id FK "Reference to MUNICIPALITIES.id"
        INTEGER parent_id FK "Reference to SUBMUNICIPAL_AREA.id. NULL for level 1 (root)"
        SMALLINT level "Hierarchy level: 1 (e.g. Circoscrizione/Quartiere), 2 (e.g. Zona Statistica), 3 (e.g. Zona Urbanistica). Source: ISTAT ASC_Liv_1/2/3"
        VARCHAR code "Sub-municipal area code (e.g. COM_ASC / COD_ASC from ISTAT, unique per municipality+level)"
        VARCHAR name "Sub-municipal area name"
        VARCHAR area_type "Optional type label from source (e.g. Circoscrizione, Quartiere, Zona Statistica, Zona Urbanistica). Source: TIPO_ASC"
        GEOMETRY geometry "Sub-municipal area boundary (EPSG:4326)"
    }

    CENSUS_SECTION {
        SERIAL id PK "Unique identifier"
        INTEGER municipality_id FK "Reference to MUNICIPALITIES.id"
        VARCHAR code "Census section or locality code (e.g. section number)"
        VARCHAR name "Section number or locality name"
        ENUM layer_type "Allowed: census_section, locality. Source sections.geojson uses 'sezione'→census_section, 'località'→locality"
        GEOMETRY geometry "Census section or locality boundary (EPSG:4326)"
    }

    AREA_LEVEL {
        BIGINT level_id PK "Unique identifier of the hierarchical level"

        VARCHAR level_name
        "Abstract hierarchical level of the green asset system.
         Examples: MANAGEMENT_UNIT, SUB_MANAGEMENT_UNIT, FUNCTIONAL_SUBAREA,
         PHYSICAL_COMPONENT, LINEAR_COMPONENT, POINT_COMPONENT,
         TEMPORARY_STATE, GEODETIC_REFERENCE"

        INTEGER hierarchy_order
        "Order within the logical spatial hierarchy (root = 1)."

        VARCHAR description_code
        "Code for the level description. Localized text (IT, EN, ...) is stored in TRANSLATIONS:
         entity_type=TABLE, entity_name=area_level, key = value of this column,
         column = 'description_code'. Use TRANSLATIONS.translation for the localized text."
    }

    %% =====================================================
    %% DBT OBJECT CATALOG
    %% =====================================================

    PRIMARY_TYPES {
        BIGINT id PK "Numeric primary key"
        CHAR(1) tp_code "Unique DBT primary type code (1–4)"
        VARCHAR description_code "Code for localized label/description. Resolved via TRANSLATIONS (entity_name=primary_types, key=description_code, column=description_code)."
    }

    SECONDARY_TYPES {
        BIGINT id PK "Numeric primary key"
        CHAR(2) ts_code "Unique DBT secondary type code"
        BIGINT primary_type_id FK "Reference to PRIMARY_TYPES.id"
        VARCHAR description_code "Code for localized label/description. Resolved via TRANSLATIONS (entity_name=secondary_types, key=description_code, column=description_code)."
    }

    ATTRIBUTE_TYPES {
        BIGINT id PK "Numeric primary key"
        CHAR(3) ts_code "Unique DBT attribute type code"
        BIGINT secondary_type_id FK "Reference to SECONDARY_TYPES.id"
        ENUM geom_type "P=Point, L=Line, S=Surface"
        VARCHAR description_code "Code for localized label/description. Resolved via TRANSLATIONS (entity_name=attribute_types, key=description_code, column=description_code)."
    }

    TRANSLATIONS {
        BIGINT id PK "Translation record identifier"

        VARCHAR entity_type
        "Type of translated source:
         TABLE → record belonging to a database table
         ENUM  → value belonging to a database ENUM"

        VARCHAR entity_name
        "Name of the source entity:
         - table name (e.g., area_level, primary_types)
         - enum name (e.g., operational_status, health_status)"

        VARCHAR key
        "Identifier of the translated element:
         - primary key value for TABLE records
         - enum literal value for ENUM entries"

        VARCHAR column
        "For TABLE only: name of the column/slot being translated (e.g. description_code, help_text).
         NULL when the entity has a single translatable value or for ENUM."

        CHAR(2) lang
        "ISO language code (it, en, fr, ...)"

        TEXT translation
        "Localized text (generic: label, description or other translatable content)."
    }

    %% =====================================================
    %% GREEN AREAS (TP = 3 and green area)
    %% =====================================================

    ASSET_AREA {
        BIGINT id PK
        "Progressive unique object identifier (OBJ_ID)"

        %% ---------- Technical partitioning & security ----------
        BIGINT region_id FK
        "Reference to REGIONS.id. Technical partitioning key for region-level sharding/partition pruning.
         NOT authoritative administrative boundary source."

        BIGINT province_id FK
        "Reference to PROVINCES.id. Technical partitioning key for province-level partitioning and row-level security."

        BIGINT municipality_id FK
        "Reference to MUNICIPALITIES.id. Municipality (comune) owner / logical tenant identifier."

        BIGINT sub_municipal_area_id FK
        "Reference to SUBMUNICIPAL_AREA.id. Optional sub-municipal partition (zone, borough).
         Used for performance and access control, not as official boundary definition."

        %% ---------- Hierarchy ----------
        BIGINT level_id FK
        "Reference to AREA_LEVEL.level_id defining the semantic hierarchy level."

        BIGINT parent_area_id FK
        "Self-reference to ASSET_AREA.id representing containment hierarchy."

        %% ---------- Internal identification ----------
        VARCHAR(255) area_name
        "Human-readable name (e.g., 'Parco Sempione')."

        BIGINT attribute_type_id FK
        "Reference to ATTRIBUTE_TYPES.id (DBT classification: geometry + primary + secondary + attribute)."

        %% ---------- Survey / operational identification (ID_ZRIL) ----------
        VARCHAR(80) zril_identifier
        "Identifier of the surveyed portion of territory (ID_ZRIL).
         Operational survey unit, not administrative: distinguishes survey lots,
         census campaigns, or park portions surveyed at different times.
         Typical use: subdivide a large park into sectors (e.g., A, B, C).
         Defined by survey contract, census team, or GIS provider. Not in ISTAT."

        %% ---------- Susceptibility & fruition ----------
        BIGINT susceptibility_classification_area_id
        "Area susceptibility to tree fall or structural instability."

        ENUM intensity_of_fruition
        "Allowed: NONE, LOW, MEDIUM, HIGH."

        %% ---------- Geometry ----------
        ENUM geometry_type
        "Allowed: P, L, S (OBT: point, line, surface).
         Must be consistent with the stored geometry type."

        GEOMETRY geometry
        "Spatial geometry in official national CRS
         (recommended: ETRF2000 / EPSG:7791–7794).
         Geometry validity and topology must be enforced at DB level."

        %% ---------- Perimeter semantics ----------
        ENUM perimeter_type
        "Allowed: REAL, FICTITIOUS.
         REAL → physically usable green space.
         FICTITIOUS → administrative container (e.g., road tree corridor)."

        %% ---------- Administrative & operational status ----------
        ENUM administrative_status
        "IN_DESIGN, PLANNED, APPROVED, ACTIVE, DISMISSED, MERGED, RECLASSIFIED."

        ENUM operational_status
        "IN_MANAGEMENT, UNDER_MAINTENANCE, TEMPORARILY_CLOSED, EMERGENCY, NOT_ACCESSIBLE."

        ENUM survey_status
        "NOT_SURVEYED, SURVEY_PENDING, PARTIALLY_SURVEYED, SURVEYED,
         IMPORTED_DBT, TO_BE_VERIFIED."

        %% ---------- Lifecycle ----------
        TIMESTAMP valid_from
        "Start of validity (nullable)."

        TIMESTAMP valid_to
        "End of validity (nullable, NULL = active)."

        TIMESTAMP start_date_of_management
        "Start date of public management."

        TIMESTAMP end_date_of_management
        "End date of management."

        TIMESTAMP last_update_at
        "Last modification timestamp."

        TIMESTAMP deleted_at
        "Logical deletion timestamp (soft delete)."

        %% ---------- Operator ----------
        VARCHAR(80) last_modified_by
        "Responsible operator or system user."

        %% ---------- Flexible attributes ----------
        JSONB attributes
        "Non-structured thematic attributes.
         Must NOT duplicate structured columns.
         Reserved for optional TP-specific data."

        %% ---------- Media ----------
        JSONB media
        "Linked digital resources (images, PDFs, technical reports, documents).
         Each item may include: type, URL, title, author, date."

        %% ---------- Notes ----------
        TEXT note
    }

    %% ---------- Asset area history (temporal snapshots) ----------
    ASSET_AREA_HISTORY {
        BIGINT history_id PK

        BIGINT asset_area_id FK "Reference to ASSET_AREA.id"

        BIGINT region_id FK
        "Reference to REGIONS.id. Technical partitioning key for region-level sharding/partition pruning.
         NOT authoritative administrative boundary source."

        BIGINT province_id FK
        "Reference to PROVINCES.id. Technical partitioning key for province-level partitioning and row-level security."

        BIGINT municipality_id FK
        "Reference to MUNICIPALITIES.id. Municipality (comune) owner / logical tenant identifier."

        BIGINT sub_municipal_area_id FK
        "Reference to SUBMUNICIPAL_AREA.id. Optional sub-municipal partition (zone, borough).
         Used for performance and access control, not as official boundary definition."

        JSONB snapshot "Full asset snapshot; validity inside JSONB: valid_from NOT NULL, valid_to nullable NULL = active, plus area_name, level_id, geometry, statuses, attributes, media, note, etc."
    }

    %% =====================================================
    %% GREEN ASSETS (TP = 1)
    %% =====================================================

    ASSET_GREEN {
        BIGINT id PK "Progressive unique object identifier (OBJ_ID)"

        %% ---------- Relation to area ----------
        BIGINT area_id FK "Reference to ASSET_AREA.id (validated by spatial containment)"

        %% ---------- Administrative identifiers ----------
        BIGINT region_id FK
        "Reference to REGIONS.id. Technical partitioning key for region-level sharding/partition pruning.
         NOT authoritative administrative boundary source."

        BIGINT province_id FK
        "Reference to PROVINCES.id. Technical partitioning key for province-level partitioning and row-level security."

        BIGINT municipality_id FK
        "Reference to MUNICIPALITIES.id. Municipality (comune) owner / logical tenant identifier."

        BIGINT sub_municipal_area_id FK
        "Reference to SUBMUNICIPAL_AREA.id. Optional sub-municipal partition (zone, borough).
         Used for performance and access control, not as official boundary definition."

        %% ---------- DBT classification ----------
        BIGINT attribute_type_id FK "Reference to ATTRIBUTE_TYPES.id"

        %% ---------- Geometry ----------
        ENUM geometry_type "Allowed: P,L,S"
        GEOMETRY geometry "GEOMETRY(GEOMETRY, 4326) geometry Point, LineString, or Polygon geometry in WGS84 (EPSG:4326)"

        %% ---------- Biological / physical attributes ----------
        VARCHAR(80) family "Botanical family grouping related genera (e.g., 'Platanaceae', 'Fagaceae', 'Oleaceae')"
        VARCHAR(50) genus "Plant genus, first part of the scientific name (e.g., 'Platanus', 'Quercus', 'Olea')"
        VARCHAR(50) species "Plant species, second part of the scientific name (e.g., 'acerifolia', 'ilex', 'europaea')"
        VARCHAR(50) variety "Plant variety or subspecific designation, if present (e.g., 'Austriaca' in 'Pinus nigra var. Austriaca')"
        JSONB attributes
        "Non-geometric properties such as:
         height_meters, trunk_diameter_centimeters,
         crown_diameter_meters, vegetation_width_meters."

        %% ---------- Lifecycle ----------
        TIMESTAMP start_date_of_management "Start date of management"
        TIMESTAMP end_date_of_management "End date of management"
        TIMESTAMP planting_date "Planting date"
        TIMESTAMP last_update_at "Last update timestamp"
        TIMESTAMP deleted_at "Cancellation date"

        %% ---------- Status ----------
        ENUM health_status "Allowed: UNKNOWN, HEALTHY, DEGRADED, DECLINING, SICK, DECEASED"
        ENUM stability_status "Allowed: STABLE, PARTIALLY_UNSTABLE, UNSTABLE, FALLEN"
        ENUM structural_defect "Allowed: NONE, ROOT, TRUNK, BRANCH, MULTIPLE"
        ENUM risk_level "Allowed: NONE, LOW, MEDIUM, HIGH, EXTREME"
        ENUM maintenance_priority "Allowed: NONE, LOW, MEDIUM, HIGH, URGENT"
        ENUM intervention_type "Allowed: NONE, PRUNING, CONSOLIDATION, TREATMENT, REMOVAL, REPLACEMENT"
        ENUM growth_stage "Allowed: YOUNG, SEMI_MATURE, MATURE, OVERMATURE, DEAD"
        ENUM origin "Allowed: NATIVE, EXOTIC, INVASIVE, CULTIVAR"
        ENUM protection_status "Allowed: NONE, PROTECTED, MONUMENTAL, HISTORICAL"
        ENUM asset_status "Allowed: PLANNED, INSTALLED, ACTIVE, TEMPORARILY_OUT_OF_SERVICE, REMOVED"

        %% ---------- Monitoring ----------
        ENUM monitoring_required "Allowed: NONE, PERIODIC, URGENT"
        TIMESTAMP next_inspection_date "Scheduled next inspection"
        VARCHAR(120) managing_entity "Responsible managing organization"
        VARCHAR(80) last_modified_by "Responsible operator"
        TIMESTAMP survey_date "Survey date"
        VARCHAR(120) survey_method "Survey method or source (e.g., field survey, drone, import)"
        ENUM priority_level_evaluation "Allowed: NONE, LOW, MEDIUM, HIGH"

        %% ---------- Media ----------
        JSONB media
        "Collection of linked digital resources (images, PDFs, reports, documents)."

        %% ---------- Topology ----------
        TEXT note
    }

    %% ---------- Asset green history (temporal snapshots) ----------
    ASSET_GREEN_HISTORY {
        BIGINT history_id PK

        BIGINT asset_green_id FK "Reference to ASSET_GREEN.id"

        BIGINT region_id FK
        "Reference to REGIONS.id. Technical partitioning key for region-level sharding/partition pruning.
         NOT authoritative administrative boundary source."

        BIGINT province_id FK
        "Reference to PROVINCES.id. Technical partitioning key for province-level partitioning and row-level security."

        BIGINT municipality_id FK
        "Reference to MUNICIPALITIES.id. Municipality (comune) owner / logical tenant identifier."

        BIGINT sub_municipal_area_id FK
        "Reference to SUBMUNICIPAL_AREA.id. Optional sub-municipal partition (zone, borough).
         Used for performance and access control, not as official boundary definition."

        JSONB snapshot "Full green asset snapshot; validity inside JSONB: valid_from NOT NULL, valid_to nullable NULL = active, plus area_id, geometry, species, statuses, lifecycle, monitoring, media, note, etc."
    }

    %% =====================================================
    %% RELATIONSHIPS
    %% =====================================================

    %% Territorial hierarchy – parent/child
    REGIONS         ||--o{ PROVINCES     : contains
    PROVINCES       ||--o{ MUNICIPALITIES : contains
    MUNICIPALITIES  ||--o{ SUBMUNICIPAL_AREA : contains
    SUBMUNICIPAL_AREA ||--o{ SUBMUNICIPAL_AREA : parent
    MUNICIPALITIES  ||--o{ CENSUS_SECTION : contains

    %% Territorial references on assets
    REGIONS           ||--o{ ASSET_AREA    : region_id
    PROVINCES         ||--o{ ASSET_AREA    : province_id
    MUNICIPALITIES    ||--o{ ASSET_AREA    : municipality_id
    SUBMUNICIPAL_AREA ||--o{ ASSET_AREA    : sub_municipal_area_id

    REGIONS           ||--o{ ASSET_GREEN   : region_id
    PROVINCES         ||--o{ ASSET_GREEN   : province_id
    MUNICIPALITIES    ||--o{ ASSET_GREEN   : municipality_id
    SUBMUNICIPAL_AREA ||--o{ ASSET_GREEN   : sub_municipal_area_id

    PRIMARY_TYPES   ||--o{ SECONDARY_TYPES : contains
    SECONDARY_TYPES ||--o{ ATTRIBUTE_TYPES : classifies

    AREA_LEVEL ||--o{ ASSET_AREA : defines_level
    ASSET_AREA ||--o{ ASSET_AREA : parent_child
    ASSET_AREA ||--o{ ASSET_AREA_HISTORY : asset_area_id
    ASSET_AREA ||--o{ ASSET_GREEN : contains

    ASSET_GREEN ||--o{ ASSET_GREEN_HISTORY : asset_green_id

    ATTRIBUTE_TYPES ||--o{ ASSET_AREA  : coded_as
    ATTRIBUTE_TYPES ||--o{ ASSET_GREEN : coded_as
```

---

## Mapping dalle fonti GeoJSON (infrastructure/data)

Le entità della gerarchia territoriale (righe 8-49 del diagramma) sono popolate o mappabili dai seguenti file GeoJSON. La tabella riporta il mapping proprietà → colonna/entità.

| File GeoJSON | Entità | Mapping proprietà → colonna / note |
|--------------|--------|-------------------------------------|
| **region/regions.geojson** | REGIONS | `COD_REG` → code (codice regione, es. 1–20). `DEN_REG` → name. `geometry` → geometry (EPSG:4326). |
| **province/provinces.geojson** | PROVINCES | `COD_REG` → per risolvere region_id (JOIN su regions.code). `COD_PROV` / `COD_UTS` → code. `DEN_UTS` o `DEN_CM` → name (nome provincia/CM). `geometry` → geometry. |
| **municipality/municipalities.geojson** | MUNICIPALITIES | `PRO_COM_T` → istat_code (codice comune ISTAT 6 cifre, es. "001272"). `COMUNE` → name. `COD_PROV`/`COD_UTS` → per risolvere province_id. `geometry` → geometry. |
| **section/sections.geojson** | CENSUS_SECTION | `istat_code` → per risolvere municipality_id. `name` → name (numero sezione o nome località). `layer_type` → layer_type: valore `"sezione"` → census_section, `"località"` → locality. `geometry` → geometry. `code` può essere derivato (es. numero sezione da name dove layer_type = census_section). |
| **submunicipal/area_submunicipal_lv1.geojson** | SUBMUNICIPAL_AREA | `COD_REG` + `COD_UTS` + `PRO_COM` → municipality_id (istat_code = prime 3 cifre = ordinale provincia nella regione, ultime 3 = `PRO_COM % 1000`). level = 1. `COD_ASC1_T` o `COM_ASC1` → code. `DEN_ASC1` → name. `TIPO_ASC1` → area_type. `geometry` → da EPSG:32632 a 4326. parent_id = NULL. |
| **submunicipal/area_submunicipal_lv2.geojson** | SUBMUNICIPAL_AREA | Come sopra: `COD_REG`+`COD_UTS`+`PRO_COM` → municipality_id. Suffisso 2: `COD_ASC2_T`/`COM_ASC2` → code, `DEN_ASC2` → name, `TIPO_ASC2` → area_type. level = 2. parent_id = NULL (da popolare in seguito se necessario). |
| **submunicipal/area_submunicipal_lv3.geojson** | SUBMUNICIPAL_AREA | Come sopra: `COD_REG`+`COD_UTS`+`PRO_COM` → municipality_id. Suffisso 3: `COD_ASC3_T`/`COM_ASC3` → code, `DEN_ASC3` → name, `TIPO_ASC3` → area_type. level = 3. parent_id = NULL. |

**Note:** I file submunicipal usano CRS EPSG:32632 (UTM 32N); in caricamento va applicata trasformazione a EPSG:4326 per la colonna `geometry`. Le province usano `DEN_UTS` quando è una provincia (COD_CM=0) e `DEN_CM` per città metropolitane (es. Torino, Genova). Il codice provincia in tabella è tipicamente `COD_UTS` (codice UTS 3 cifre), allineato all’ISTAT.

---

## Note: aree subcomunali a 3 livelli (ISTAT ASC)

Le basi territoriali ISTAT “Aree subcomunali” sono fornite in **tre livelli** (shapefile `ASC_Liv_1_WGS84`, `ASC_Liv_2_WGS84`, `ASC_Liv_3_WGS84`), con gerarchia tipica:

| Livello | Esempi (TIPO_ASC) | Contenuto |
|--------|--------------------|-----------|
| 1 | Circoscrizione, Quartiere | Suddivisione amministrativa di primo livello |
| 2 | Zona Statistica | Dettaglio statistico sotto il livello 1 |
| 3 | Zona Urbanistica | Dettaglio più fine (ove presente) |

**Scelta di modellazione:** una **sola tabella** `SUBMUNICIPAL_AREA` con:

- **`level`** (1, 2, 3): allineato ai tre shapefile e ai CSV `ASC_Liv_*_2021.csv`.
- **`parent_id`** (FK su se stessa): livello 1 senza parent; livelli 2 e 3 riferiti all’area di livello superiore (risoluzione del parent in fase di import, es. per contenimento spaziale o prefisso del codice ISTAT COM_ASC).

Vantaggi: un’unica tabella da mantenere, una sola geometria, vincoli e query per livello o per albero gerarchico semplici; gli asset continuano a riferire `sub_municipal_area_id` senza dover scegliere il livello a priori. In fase di import andrà popolato `parent_id` per Liv_2 e Liv_3 (es. da `ST_Contains` tra geometrie o da convenzione sui codici ISTAT).

**Esplosione gerarchica:** la catena **Regione → Provincia → Comune → Area subcomunale** è percorribile in entrambe le direzioni: in discesa tramite `region_id`, `province_id`, `municipality_id` e (solo per le subcomunali) `parent_id`; in risalita leggendo le stesse FK al contrario. Esempio top-down: da una regione si ottengono le province (`province.region_id`), da una provincia i comuni (`municipality.province_id`), da un comune le aree subcomunali di livello 1 (`sub_municipal_area.municipality_id` e `level = 1`), da un’area di livello 1 le figlie con `sub_municipal_area.parent_id`.
