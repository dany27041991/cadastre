-- =============================================================================
-- Seed: area_level + translations
-- =============================================================================
-- From docs/database/area/area-level-table.md.
-- Run after 01-init-schema-public.sql. Gerarchia 1-6; livelli trasversali 7-8.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AREA_LEVEL
-- -----------------------------------------------------------------------------
INSERT INTO public.area_level (level_id, level_name, hierarchy_order, description_code)
VALUES
  (1, 'MANAGEMENT_UNIT', 1, 'LEVEL_DESC_MANAGEMENT_UNIT'),
  (2, 'SUB_MANAGEMENT_UNIT', 2, 'LEVEL_DESC_SUB_MANAGEMENT_UNIT'),
  (3, 'FUNCTIONAL_SUBAREA', 3, 'LEVEL_DESC_FUNCTIONAL_SUBAREA'),
  (4, 'PHYSICAL_COMPONENT', 4, 'LEVEL_DESC_PHYSICAL_COMPONENT'),
  (5, 'LINEAR_COMPONENT', 5, 'LEVEL_DESC_LINEAR_COMPONENT'),
  (6, 'POINT_COMPONENT', 6, 'LEVEL_DESC_POINT_COMPONENT'),
  (7, 'TEMPORARY_STATE', 1, 'LEVEL_DESC_TEMPORARY_STATE'),
  (8, 'GEODETIC_REFERENCE', 1, 'LEVEL_DESC_GEODETIC_REFERENCE')
ON CONFLICT (level_id) DO UPDATE SET
  level_name = EXCLUDED.level_name,
  hierarchy_order = EXCLUDED.hierarchy_order,
  description_code = EXCLUDED.description_code;

-- -----------------------------------------------------------------------------
-- TRANSLATIONS for area_level
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('TABLE', 'public.area_level', 'LEVEL_DESC_MANAGEMENT_UNIT', 'description_code', 'it', 'Unità territoriale base gestita dall''ente. Area di competenza amministrativa del verde. Parco, giardino, viale alberato (area fittizia). Poligono radice della gerarchia.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_MANAGEMENT_UNIT', 'description_code', 'en', 'Base territorial unit managed by the authority. Administrative scope for green. Park, garden, tree-lined avenue (fictitious area). Root polygon of the hierarchy.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_SUB_MANAGEMENT_UNIT', 'description_code', 'it', 'Suddivisione amministrativa interna opzionale. Compartimenti, lotti funzionali, sotto-perimetri (es. settore nord del parco, lotto manutentivo). Non sempre presente.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_SUB_MANAGEMENT_UNIT', 'description_code', 'en', 'Optional internal administrative subdivision. Compartments, functional lots, sub-perimeters (e.g. north sector of the park, maintenance lot). Not always present.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_FUNCTIONAL_SUBAREA', 'description_code', 'it', 'Sotto-area definita dall''uso/fruizione. Spazi con funzione specifica per i cittadini: area gioco, area cani, orti, sport, oasi. Deve stare dentro una MANAGEMENT/SUB unit.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_FUNCTIONAL_SUBAREA', 'description_code', 'en', 'Sub-area defined by use. Spaces with specific function for citizens: play area, dog area, allotments, sport, oasis. Must lie within a MANAGEMENT/SUB unit.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_PHYSICAL_COMPONENT', 'description_code', 'it', 'Superficie fisica omogenea di vegetazione o arredo. Copertura materiale del suolo: prato, aiuola, pavimentazione, arredo areale. Copertura totale senza buchi né sovrapposizioni.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_PHYSICAL_COMPONENT', 'description_code', 'en', 'Homogeneous physical surface of vegetation or furniture. Material land cover: lawn, flower bed, paving, areal furniture. Total coverage with no gaps or overlaps.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_LINEAR_COMPONENT', 'description_code', 'it', 'Elemento fisico lineare gestito. Oggetti sviluppati lungo una linea: tratta stradale, siepe lineare, filare, percorso tecnico. Fondamentale per aree fittizie stradali.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_LINEAR_COMPONENT', 'description_code', 'en', 'Linear physical element under management. Objects along a line: road segment, linear hedge, tree row, technical path. Essential for street fictitious areas.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_POINT_COMPONENT', 'description_code', 'it', 'Elemento fisico puntuale. Oggetti discreti sul territorio: alberi, arredi puntuali, chilometriche, sensori. Livello inventariale minimo (foglia terminale).'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_POINT_COMPONENT', 'description_code', 'en', 'Point physical element. Discrete objects: trees, point furniture, kilometre points, sensors. Minimum inventory level (terminal leaf).'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_TEMPORARY_STATE', 'description_code', 'it', 'Stato amministrativo o di accessibilità temporaneo. Condizioni che modificano uso o gestione: cantiere, concessione, sponsor, inaccessibile, attesa censimento. Trasversale: sovrapposizione logica, non topologica.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_TEMPORARY_STATE', 'description_code', 'en', 'Temporary administrative or accessibility state. Conditions that modify use or management: construction site, concession, sponsor, inaccessible, awaiting census. Transversal: logical overlay, not topological.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_GEODETIC_REFERENCE', 'description_code', 'it', 'Riferimento topografico/cartografico. Punti di controllo del rilievo: vertici di stazione, vertici d''inquadramento. Fuori gerarchia; non rappresenta verde né fruizione.'),
  ('TABLE', 'public.area_level', 'LEVEL_DESC_GEODETIC_REFERENCE', 'description_code', 'en', 'Topographic/cartographic reference. Survey control points: station vertices, reference vertices. Outside hierarchy; does not represent green or use.')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;
