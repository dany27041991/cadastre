# Tipi Attributi (ATT)

Gli attributi definiscono le caratteristiche manutentive degli oggetti. Il codice ATT (3 cifre) si combina con **Tipo Principale (TP)** e **Tipo Secondario (TS)** nel codice oggetto completo (es. `P103108` = punto, Pianta, albero).

Le tabelle seguenti elencano gli attributi per ciascun **Tipo Secondario (TS)**; il codice TS è la chiave in [secondary_types.md](secondary_types.md) (colonna CODICE TS).

---

## TS 01 – PRATO

*Geometria tipica: **S** (superficie).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 01 | S | 000 | Prato generico | Generic lawn |
| 01 | S | 016 | Prato in erba | Grass lawn |
| 01 | S | 017 | Sterrato | Unpaved / dirt surface |
| 01 | S | 050 | Prato in carreggiabile erbosa/green paving | Lawn in grass carriageway / green paving |
| 01 | S | 051 | Prato in scarpata/fossetti | Lawn on embankment / ditches |
| 01 | S | 052 | Prato in linea tramviaria | Lawn on tram line |
| 01 | S | 053 | Prato su campi cimiteriali | Lawn on cemetery grounds |
| 01 | S | 115 | Prato incolto | Uncultivated lawn |
| 01 | S | 117 | Prato marginale | Marginal lawn |
| 01 | S | 118 | Prato/campo agricolo | Lawn / agricultural field |
| 01 | S | 119 | Prato fiorito | Flowered lawn |
| 01 | S | 120 | Prato fiorito spontaneo | Spontaneous flowered lawn |
| 01 | S | 124 | Prato in fosso di confine | Lawn in boundary ditch |
| 01 | S | 126 | Area sotto siepe | Area under hedge |
| 01 | S | 816 | Prato in banchina | Lawn on verge / shoulder |
| 01 | S | 851 | Prato in banchina scarpata | Lawn on embankment verge |

---

## TS 02 – AIUOLA

*Geometria tipica: **S** (superficie).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 02 | S | 000 | Aiuola generica | Generic flower bed |
| 02 | S | 101 | Aiuola cespuglio macchia | Flower bed shrub / clump |
| 02 | S | 102 | Aiuola erbacee perenni | Perennial herbaceous flower bed |
| 02 | S | 103 | Aiuola erbacee annuali | Annual herbaceous flower bed |
| 02 | S | 111 | Aiuola pensile intensivo | Intensive green roof |
| 02 | S | 112 | Aiuola pensile estensivo | Extensive green roof |
| 02 | S | 113 | Aiuola verde verticale | Vertical green |
| 02 | S | 121 | Aiuola fiorita di pregio | Ornamental flower bed |
| 02 | S | 122 | Aiuola fiorita perenne | Perennial flower bed |
| 02 | S | 455 | Aiuola con griglia | Flower bed with grid |

---

## TS 03 – PIANTA

*Geometrie: **P** (punto), **L** (linea), **S** (superficie)* — a seconda dell’oggetto.

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 03 | S | 100 | Bosco | Woodland / forest |
| 03 | S | 101 | Cespuglio macchia/tappezzante | Shrub clump / ground cover |
| 03 | L | 104 | Filare stradale | Street tree row |
| 03 | L | 105 | Filare - in area a verde o pedonale | Tree row in green or pedestrian area |
| 03 | L | 106 | Filare - in area a verde o pedonale con proiezione su strada | Tree row in green/pedestrian area with projection onto road |
| 03 | L | 107 | Siepe | Hedge |
| 03 | P | 108 | Albero | Tree |
| 03 | P | 109 | Cespuglio singolo/arbusto | Single shrub / bush |
| 03 | S | 114 | Vegetazione acquatica | Aquatic vegetation |
| 03 | S | 115 | Rovo/sterpaglia | Bramble / underbrush |
| 03 | L | 116 | Ciglio stradale | Road verge |
| 03 | S | 123 | Gruppo di alberi | Tree group |
| 03 | L | 125 | Rampicante | Climber |
| 03 | S | 160 | Forestazione urbana | Urban forestry |
| 03 | S | 259 | Cespuglio macchia in vaso/fioriera | Shrub in pot / planter |
| 03 | P | 259 | Pianta in vaso/fioriera | Plant in pot / planter |
| 03 | P | 292 | Cespuglio macchia in fioriera sospesa | Shrub in hanging planter |

---

## TS 25 – AREA DI GESTIONE

*ATT 500: stesso codice, descrizione e geometria distinti per uso (superficie, linea, punto).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 25 | S | 000 | Area fittizia | Fictitious area |
| 25 | S | 500 | Limite area di gestione | Management area boundary |
| 25 | L | 500 | Grafo tratta stradale in gestione | Road segment graph in management |
| 25 | P | 500 | Chilometrica stradale in gestione | Road kilometrage in management |
| 25 | S | 999 | Area in attesa di censimento | Area awaiting census |

---

## TS 26 – AREA AD ASSEGNAZIONE TEMPORANEA

*Geometria tipica: **S** (superficie).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 26 | S | 000 | Area ad assegnazione temporanea generica | Generic temporary assignment area |
| 26 | S | 550 | Area cantiere | Construction site area |
| 26 | S | 551 | Area sponsor | Sponsor area |
| 26 | S | 800 | Area temporaneamente inaccessibile | Temporarily inaccessible area |
| 26 | S | 801 | Area in concessione | Concession area |

---

## TS 27 – AREA FUNZIONALE

*Geometria tipica: **S** (superficie).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 27 | S | 000 | Area funzionale generica | Generic functional area |
| 27 | S | 450 | Area impianto di irrigazione | Irrigation system area |
| 27 | S | 552 | Area gioco | Play area |
| 27 | S | 553 | Area sport | Sports area |
| 27 | S | 554 | Area cani | Dog area |
| 27 | S | 555 | Area orti comunali | Municipal allotments |
| 27 | S | 556 | Area colonia felina | Cat colony area |
| 27 | S | 557 | Area orti didattici | Educational gardens area |
| 27 | S | 562 | Area oasi insetti pronubi | Pollinator insect oasis area |
| 27 | S | 900 | Area sgombero neve | Snow clearance area |

---

## TS 99 – INFORMAZIONI GEODETICHE

*Geometria tipica: **P** (punto).*

| CODICE TS | Geometria | Codice ATT | Descrizione | Description (EN) |
|-----------+-----------+------------|-------------|------------------|
| 99 | P | 600 | Vertice di stazione | Station vertex |
| 99 | P | 601 | Vertice d'inquadramento | Reference / control vertex |
