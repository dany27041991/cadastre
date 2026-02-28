-- =============================================================================
-- Seed: attribute_types + translations
-- =============================================================================
-- From docs/database/obt/types/attribute_types.md.
-- CODICE TS → secondary_type_id: 01→1, 02→2, 03→3, 25→25, 26→26, 27→27, 99→45.
-- Run after 01-init-seed-03-secondary-types.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ATTRIBUTE_TYPES (id, ts_code = Codice ATT, secondary_type_id, geom_type, description_code)
-- -----------------------------------------------------------------------------
INSERT INTO public.attribute_types (id, ts_code, secondary_type_id, geom_type, description_code)
VALUES
  -- TS 01 – PRATO
  (1, '000', 1, 'S', 'ATT_01_000'),   -- Prato generico
  (2, '016', 1, 'S', 'ATT_01_016'),   -- Prato in erba
  (3, '017', 1, 'S', 'ATT_01_017'),   -- Sterrato
  (4, '050', 1, 'S', 'ATT_01_050'),   -- Prato in carreggiabile erbosa/green paving
  (5, '051', 1, 'S', 'ATT_01_051'),   -- Prato in scarpata/fossetti
  (6, '052', 1, 'S', 'ATT_01_052'),   -- Prato in linea tramviaria
  (7, '053', 1, 'S', 'ATT_01_053'),   -- Prato su campi cimiteriali
  (8, '115', 1, 'S', 'ATT_01_115'),   -- Prato incolto
  (9, '117', 1, 'S', 'ATT_01_117'),   -- Prato marginale
  (10, '118', 1, 'S', 'ATT_01_118'),  -- Prato/campo agricolo
  (11, '119', 1, 'S', 'ATT_01_119'),  -- Prato fiorito
  (12, '120', 1, 'S', 'ATT_01_120'),  -- Prato fiorito spontaneo
  (13, '124', 1, 'S', 'ATT_01_124'),  -- Prato in fosso di confine
  (14, '126', 1, 'S', 'ATT_01_126'),  -- Area sotto siepe
  (15, '816', 1, 'S', 'ATT_01_816'),  -- Prato in banchina
  (16, '851', 1, 'S', 'ATT_01_851'),  -- Prato in banchina scarpata
  -- TS 02 – AIUOLA
  (17, '000', 2, 'S', 'ATT_02_000'),  -- Aiuola generica
  (18, '101', 2, 'S', 'ATT_02_101'),  -- Aiuola cespuglio macchia
  (19, '102', 2, 'S', 'ATT_02_102'),  -- Aiuola erbacee perenni
  (20, '103', 2, 'S', 'ATT_02_103'),  -- Aiuola erbacee annuali
  (21, '111', 2, 'S', 'ATT_02_111'),  -- Aiuola pensile intensivo
  (22, '112', 2, 'S', 'ATT_02_112'),  -- Aiuola pensile estensivo
  (23, '113', 2, 'S', 'ATT_02_113'),  -- Aiuola verde verticale
  (24, '121', 2, 'S', 'ATT_02_121'),  -- Aiuola fiorita di pregio
  (25, '122', 2, 'S', 'ATT_02_122'),  -- Aiuola fiorita perenne
  (26, '455', 2, 'S', 'ATT_02_455'),  -- Aiuola con griglia
  -- TS 03 – PIANTA
  (27, '100', 3, 'S', 'ATT_03_100_S'),  -- Bosco
  (28, '101', 3, 'S', 'ATT_03_101'),   -- Cespuglio macchia/tappezzante
  (29, '104', 3, 'L', 'ATT_03_104'),   -- Filare stradale
  (30, '105', 3, 'L', 'ATT_03_105'),   -- Filare - in area a verde o pedonale
  (31, '106', 3, 'L', 'ATT_03_106'),  -- Filare - in area a verde o pedonale con proiezione su strada
  (32, '107', 3, 'L', 'ATT_03_107'),  -- Siepe
  (33, '108', 3, 'P', 'ATT_03_108'),  -- Albero
  (34, '109', 3, 'P', 'ATT_03_109'),  -- Cespuglio singolo/arbusto
  (35, '114', 3, 'S', 'ATT_03_114'),  -- Vegetazione acquatica
  (36, '115', 3, 'S', 'ATT_03_115'),  -- Rovo/sterpaglia
  (37, '116', 3, 'L', 'ATT_03_116'),  -- Ciglio stradale
  (38, '123', 3, 'S', 'ATT_03_123'),  -- Gruppo di alberi
  (39, '125', 3, 'L', 'ATT_03_125'),  -- Rampicante
  (40, '160', 3, 'S', 'ATT_03_160'),  -- Forestazione urbana
  (41, '259', 3, 'S', 'ATT_03_259_S'), -- Cespuglio macchia in vaso/fioriera
  (42, '259', 3, 'P', 'ATT_03_259_P'), -- Pianta in vaso/fioriera
  (43, '292', 3, 'P', 'ATT_03_292'),  -- Cespuglio macchia in fioriera sospesa
  -- TS 25 – AREA DI GESTIONE
  (44, '000', 25, 'S', 'ATT_25_000'),    -- Area fittizia
  (45, '500', 25, 'S', 'ATT_25_500_S'),  -- Limite area di gestione
  (46, '500', 25, 'L', 'ATT_25_500_L'),  -- Grafo tratta stradale in gestione
  (47, '500', 25, 'P', 'ATT_25_500_P'),  -- Chilometrica stradale in gestione
  (48, '999', 25, 'S', 'ATT_25_999'),    -- Area in attesa di censimento
  -- TS 26 – AREA AD ASSEGNAZIONE TEMPORANEA
  (49, '000', 26, 'S', 'ATT_26_000'),   -- Area ad assegnazione temporanea generica
  (50, '550', 26, 'S', 'ATT_26_550'),   -- Area cantiere
  (51, '551', 26, 'S', 'ATT_26_551'),   -- Area sponsor
  (52, '800', 26, 'S', 'ATT_26_800'),   -- Area temporaneamente inaccessibile
  (53, '801', 26, 'S', 'ATT_26_801'),   -- Area in concessione
  -- TS 27 – AREA FUNZIONALE
  (54, '000', 27, 'S', 'ATT_27_000'),  -- Area funzionale generica
  (55, '450', 27, 'S', 'ATT_27_450'),  -- Area impianto di irrigazione
  (56, '552', 27, 'S', 'ATT_27_552'),  -- Area gioco
  (57, '553', 27, 'S', 'ATT_27_553'),  -- Area sport
  (58, '554', 27, 'S', 'ATT_27_554'),  -- Area cani
  (59, '555', 27, 'S', 'ATT_27_555'),  -- Area orti comunali
  (60, '556', 27, 'S', 'ATT_27_556'),  -- Area colonia felina
  (61, '557', 27, 'S', 'ATT_27_557'),  -- Area orti didattici
  (62, '562', 27, 'S', 'ATT_27_562'),  -- Area oasi insetti pronubi
  (63, '900', 27, 'S', 'ATT_27_900'),  -- Area sgombero neve
  -- TS 99 – INFORMAZIONI GEODETICHE
  (64, '600', 45, 'P', 'ATT_99_600'),  -- Vertice di stazione
  (65, '601', 45, 'P', 'ATT_99_601')   -- Vertice d'inquadramento
ON CONFLICT (id) DO UPDATE SET
  ts_code = EXCLUDED.ts_code,
  secondary_type_id = EXCLUDED.secondary_type_id,
  geom_type = EXCLUDED.geom_type,
  description_code = EXCLUDED.description_code;

-- -----------------------------------------------------------------------------
-- TRANSLATIONS for attribute_types
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('TABLE', 'public.attribute_types', 'ATT_01_000', 'description_code', 'it', 'Prato generico'),
  ('TABLE', 'public.attribute_types', 'ATT_01_000', 'description_code', 'en', 'Generic lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_016', 'description_code', 'it', 'Prato in erba'),
  ('TABLE', 'public.attribute_types', 'ATT_01_016', 'description_code', 'en', 'Grass lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_017', 'description_code', 'it', 'Sterrato'),
  ('TABLE', 'public.attribute_types', 'ATT_01_017', 'description_code', 'en', 'Unpaved / dirt surface'),
  ('TABLE', 'public.attribute_types', 'ATT_01_050', 'description_code', 'it', 'Prato in carreggiabile erbosa/green paving'),
  ('TABLE', 'public.attribute_types', 'ATT_01_050', 'description_code', 'en', 'Lawn in grass carriageway / green paving'),
  ('TABLE', 'public.attribute_types', 'ATT_01_051', 'description_code', 'it', 'Prato in scarpata/fossetti'),
  ('TABLE', 'public.attribute_types', 'ATT_01_051', 'description_code', 'en', 'Lawn on embankment / ditches'),
  ('TABLE', 'public.attribute_types', 'ATT_01_052', 'description_code', 'it', 'Prato in linea tramviaria'),
  ('TABLE', 'public.attribute_types', 'ATT_01_052', 'description_code', 'en', 'Lawn on tram line'),
  ('TABLE', 'public.attribute_types', 'ATT_01_053', 'description_code', 'it', 'Prato su campi cimiteriali'),
  ('TABLE', 'public.attribute_types', 'ATT_01_053', 'description_code', 'en', 'Lawn on cemetery grounds'),
  ('TABLE', 'public.attribute_types', 'ATT_01_115', 'description_code', 'it', 'Prato incolto'),
  ('TABLE', 'public.attribute_types', 'ATT_01_115', 'description_code', 'en', 'Uncultivated lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_117', 'description_code', 'it', 'Prato marginale'),
  ('TABLE', 'public.attribute_types', 'ATT_01_117', 'description_code', 'en', 'Marginal lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_118', 'description_code', 'it', 'Prato/campo agricolo'),
  ('TABLE', 'public.attribute_types', 'ATT_01_118', 'description_code', 'en', 'Lawn / agricultural field'),
  ('TABLE', 'public.attribute_types', 'ATT_01_119', 'description_code', 'it', 'Prato fiorito'),
  ('TABLE', 'public.attribute_types', 'ATT_01_119', 'description_code', 'en', 'Flowered lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_120', 'description_code', 'it', 'Prato fiorito spontaneo'),
  ('TABLE', 'public.attribute_types', 'ATT_01_120', 'description_code', 'en', 'Spontaneous flowered lawn'),
  ('TABLE', 'public.attribute_types', 'ATT_01_124', 'description_code', 'it', 'Prato in fosso di confine'),
  ('TABLE', 'public.attribute_types', 'ATT_01_124', 'description_code', 'en', 'Lawn in boundary ditch'),
  ('TABLE', 'public.attribute_types', 'ATT_01_126', 'description_code', 'it', 'Area sotto siepe'),
  ('TABLE', 'public.attribute_types', 'ATT_01_126', 'description_code', 'en', 'Area under hedge'),
  ('TABLE', 'public.attribute_types', 'ATT_01_816', 'description_code', 'it', 'Prato in banchina'),
  ('TABLE', 'public.attribute_types', 'ATT_01_816', 'description_code', 'en', 'Lawn on verge / shoulder'),
  ('TABLE', 'public.attribute_types', 'ATT_01_851', 'description_code', 'it', 'Prato in banchina scarpata'),
  ('TABLE', 'public.attribute_types', 'ATT_01_851', 'description_code', 'en', 'Lawn on embankment verge'),
  ('TABLE', 'public.attribute_types', 'ATT_02_000', 'description_code', 'it', 'Aiuola generica'),
  ('TABLE', 'public.attribute_types', 'ATT_02_000', 'description_code', 'en', 'Generic flower bed'),
  ('TABLE', 'public.attribute_types', 'ATT_02_101', 'description_code', 'it', 'Aiuola cespuglio macchia'),
  ('TABLE', 'public.attribute_types', 'ATT_02_101', 'description_code', 'en', 'Flower bed shrub / clump'),
  ('TABLE', 'public.attribute_types', 'ATT_02_102', 'description_code', 'it', 'Aiuola erbacee perenni'),
  ('TABLE', 'public.attribute_types', 'ATT_02_102', 'description_code', 'en', 'Perennial herbaceous flower bed'),
  ('TABLE', 'public.attribute_types', 'ATT_02_103', 'description_code', 'it', 'Aiuola erbacee annuali'),
  ('TABLE', 'public.attribute_types', 'ATT_02_103', 'description_code', 'en', 'Annual herbaceous flower bed'),
  ('TABLE', 'public.attribute_types', 'ATT_02_111', 'description_code', 'it', 'Aiuola pensile intensivo'),
  ('TABLE', 'public.attribute_types', 'ATT_02_111', 'description_code', 'en', 'Intensive green roof'),
  ('TABLE', 'public.attribute_types', 'ATT_02_112', 'description_code', 'it', 'Aiuola pensile estensivo'),
  ('TABLE', 'public.attribute_types', 'ATT_02_112', 'description_code', 'en', 'Extensive green roof'),
  ('TABLE', 'public.attribute_types', 'ATT_02_113', 'description_code', 'it', 'Aiuola verde verticale'),
  ('TABLE', 'public.attribute_types', 'ATT_02_113', 'description_code', 'en', 'Vertical green'),
  ('TABLE', 'public.attribute_types', 'ATT_02_121', 'description_code', 'it', 'Aiuola fiorita di pregio'),
  ('TABLE', 'public.attribute_types', 'ATT_02_121', 'description_code', 'en', 'Ornamental flower bed'),
  ('TABLE', 'public.attribute_types', 'ATT_02_122', 'description_code', 'it', 'Aiuola fiorita perenne'),
  ('TABLE', 'public.attribute_types', 'ATT_02_122', 'description_code', 'en', 'Perennial flower bed'),
  ('TABLE', 'public.attribute_types', 'ATT_02_455', 'description_code', 'it', 'Aiuola con griglia'),
  ('TABLE', 'public.attribute_types', 'ATT_02_455', 'description_code', 'en', 'Flower bed with grid'),
  ('TABLE', 'public.attribute_types', 'ATT_03_100_S', 'description_code', 'it', 'Bosco'),
  ('TABLE', 'public.attribute_types', 'ATT_03_100_S', 'description_code', 'en', 'Woodland / forest'),
  ('TABLE', 'public.attribute_types', 'ATT_03_101', 'description_code', 'it', 'Cespuglio macchia/tappezzante'),
  ('TABLE', 'public.attribute_types', 'ATT_03_101', 'description_code', 'en', 'Shrub clump / ground cover'),
  ('TABLE', 'public.attribute_types', 'ATT_03_104', 'description_code', 'it', 'Filare stradale'),
  ('TABLE', 'public.attribute_types', 'ATT_03_104', 'description_code', 'en', 'Street tree row'),
  ('TABLE', 'public.attribute_types', 'ATT_03_105', 'description_code', 'it', 'Filare - in area a verde o pedonale'),
  ('TABLE', 'public.attribute_types', 'ATT_03_105', 'description_code', 'en', 'Tree row in green or pedestrian area'),
  ('TABLE', 'public.attribute_types', 'ATT_03_106', 'description_code', 'it', 'Filare - in area a verde o pedonale con proiezione su strada'),
  ('TABLE', 'public.attribute_types', 'ATT_03_106', 'description_code', 'en', 'Tree row in green/pedestrian area with projection onto road'),
  ('TABLE', 'public.attribute_types', 'ATT_03_107', 'description_code', 'it', 'Siepe'),
  ('TABLE', 'public.attribute_types', 'ATT_03_107', 'description_code', 'en', 'Hedge'),
  ('TABLE', 'public.attribute_types', 'ATT_03_108', 'description_code', 'it', 'Albero'),
  ('TABLE', 'public.attribute_types', 'ATT_03_108', 'description_code', 'en', 'Tree'),
  ('TABLE', 'public.attribute_types', 'ATT_03_109', 'description_code', 'it', 'Cespuglio singolo/arbusto'),
  ('TABLE', 'public.attribute_types', 'ATT_03_109', 'description_code', 'en', 'Single shrub / bush'),
  ('TABLE', 'public.attribute_types', 'ATT_03_114', 'description_code', 'it', 'Vegetazione acquatica'),
  ('TABLE', 'public.attribute_types', 'ATT_03_114', 'description_code', 'en', 'Aquatic vegetation'),
  ('TABLE', 'public.attribute_types', 'ATT_03_115', 'description_code', 'it', 'Rovo/sterpaglia'),
  ('TABLE', 'public.attribute_types', 'ATT_03_115', 'description_code', 'en', 'Bramble / underbrush'),
  ('TABLE', 'public.attribute_types', 'ATT_03_116', 'description_code', 'it', 'Ciglio stradale'),
  ('TABLE', 'public.attribute_types', 'ATT_03_116', 'description_code', 'en', 'Road verge'),
  ('TABLE', 'public.attribute_types', 'ATT_03_123', 'description_code', 'it', 'Gruppo di alberi'),
  ('TABLE', 'public.attribute_types', 'ATT_03_123', 'description_code', 'en', 'Tree group'),
  ('TABLE', 'public.attribute_types', 'ATT_03_125', 'description_code', 'it', 'Rampicante'),
  ('TABLE', 'public.attribute_types', 'ATT_03_125', 'description_code', 'en', 'Climber'),
  ('TABLE', 'public.attribute_types', 'ATT_03_160', 'description_code', 'it', 'Forestazione urbana'),
  ('TABLE', 'public.attribute_types', 'ATT_03_160', 'description_code', 'en', 'Urban forestry'),
  ('TABLE', 'public.attribute_types', 'ATT_03_259_S', 'description_code', 'it', 'Cespuglio macchia in vaso/fioriera'),
  ('TABLE', 'public.attribute_types', 'ATT_03_259_S', 'description_code', 'en', 'Shrub in pot / planter'),
  ('TABLE', 'public.attribute_types', 'ATT_03_259_P', 'description_code', 'it', 'Pianta in vaso/fioriera'),
  ('TABLE', 'public.attribute_types', 'ATT_03_259_P', 'description_code', 'en', 'Plant in pot / planter'),
  ('TABLE', 'public.attribute_types', 'ATT_03_292', 'description_code', 'it', 'Cespuglio macchia in fioriera sospesa'),
  ('TABLE', 'public.attribute_types', 'ATT_03_292', 'description_code', 'en', 'Shrub in hanging planter'),
  ('TABLE', 'public.attribute_types', 'ATT_25_000', 'description_code', 'it', 'Area fittizia'),
  ('TABLE', 'public.attribute_types', 'ATT_25_000', 'description_code', 'en', 'Fictitious area'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_S', 'description_code', 'it', 'Limite area di gestione'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_S', 'description_code', 'en', 'Management area boundary'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_L', 'description_code', 'it', 'Grafo tratta stradale in gestione'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_L', 'description_code', 'en', 'Road segment graph in management'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_P', 'description_code', 'it', 'Chilometrica stradale in gestione'),
  ('TABLE', 'public.attribute_types', 'ATT_25_500_P', 'description_code', 'en', 'Road kilometrage in management'),
  ('TABLE', 'public.attribute_types', 'ATT_25_999', 'description_code', 'it', 'Area in attesa di censimento'),
  ('TABLE', 'public.attribute_types', 'ATT_25_999', 'description_code', 'en', 'Area awaiting census'),
  ('TABLE', 'public.attribute_types', 'ATT_26_000', 'description_code', 'it', 'Area ad assegnazione temporanea generica'),
  ('TABLE', 'public.attribute_types', 'ATT_26_000', 'description_code', 'en', 'Generic temporary assignment area'),
  ('TABLE', 'public.attribute_types', 'ATT_26_550', 'description_code', 'it', 'Area cantiere'),
  ('TABLE', 'public.attribute_types', 'ATT_26_550', 'description_code', 'en', 'Construction site area'),
  ('TABLE', 'public.attribute_types', 'ATT_26_551', 'description_code', 'it', 'Area sponsor'),
  ('TABLE', 'public.attribute_types', 'ATT_26_551', 'description_code', 'en', 'Sponsor area'),
  ('TABLE', 'public.attribute_types', 'ATT_26_800', 'description_code', 'it', 'Area temporaneamente inaccessibile'),
  ('TABLE', 'public.attribute_types', 'ATT_26_800', 'description_code', 'en', 'Temporarily inaccessible area'),
  ('TABLE', 'public.attribute_types', 'ATT_26_801', 'description_code', 'it', 'Area in concessione'),
  ('TABLE', 'public.attribute_types', 'ATT_26_801', 'description_code', 'en', 'Concession area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_000', 'description_code', 'it', 'Area funzionale generica'),
  ('TABLE', 'public.attribute_types', 'ATT_27_000', 'description_code', 'en', 'Generic functional area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_450', 'description_code', 'it', 'Area impianto di irrigazione'),
  ('TABLE', 'public.attribute_types', 'ATT_27_450', 'description_code', 'en', 'Irrigation system area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_552', 'description_code', 'it', 'Area gioco'),
  ('TABLE', 'public.attribute_types', 'ATT_27_552', 'description_code', 'en', 'Play area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_553', 'description_code', 'it', 'Area sport'),
  ('TABLE', 'public.attribute_types', 'ATT_27_553', 'description_code', 'en', 'Sports area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_554', 'description_code', 'it', 'Area cani'),
  ('TABLE', 'public.attribute_types', 'ATT_27_554', 'description_code', 'en', 'Dog area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_555', 'description_code', 'it', 'Area orti comunali'),
  ('TABLE', 'public.attribute_types', 'ATT_27_555', 'description_code', 'en', 'Municipal allotments'),
  ('TABLE', 'public.attribute_types', 'ATT_27_556', 'description_code', 'it', 'Area colonia felina'),
  ('TABLE', 'public.attribute_types', 'ATT_27_556', 'description_code', 'en', 'Cat colony area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_557', 'description_code', 'it', 'Area orti didattici'),
  ('TABLE', 'public.attribute_types', 'ATT_27_557', 'description_code', 'en', 'Educational gardens area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_562', 'description_code', 'it', 'Area oasi insetti pronubi'),
  ('TABLE', 'public.attribute_types', 'ATT_27_562', 'description_code', 'en', 'Pollinator insect oasis area'),
  ('TABLE', 'public.attribute_types', 'ATT_27_900', 'description_code', 'it', 'Area sgombero neve'),
  ('TABLE', 'public.attribute_types', 'ATT_27_900', 'description_code', 'en', 'Snow clearance area'),
  ('TABLE', 'public.attribute_types', 'ATT_99_600', 'description_code', 'it', 'Vertice di stazione'),
  ('TABLE', 'public.attribute_types', 'ATT_99_600', 'description_code', 'en', 'Station vertex'),
  ('TABLE', 'public.attribute_types', 'ATT_99_601', 'description_code', 'it', 'Vertice d''inquadramento'),
  ('TABLE', 'public.attribute_types', 'ATT_99_601', 'description_code', 'en', 'Reference / control vertex')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;
