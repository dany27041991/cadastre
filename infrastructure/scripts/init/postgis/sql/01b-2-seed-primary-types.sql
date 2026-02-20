-- =============================================================================
-- Seed: primary_types + translations
-- =============================================================================
-- From docs/database/area/obt/types/primary_types.md. DBT catalog root.
-- Run after 01-init-schema-public.sql and 01b-1-seed-area-level.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PRIMARY_TYPES
-- -----------------------------------------------------------------------------
INSERT INTO public.primary_types (id, tp_code, description_code)
VALUES
  (1, '1', 'TP_DESC_1'),
  (2, '2', 'TP_DESC_2'),
  (3, '3', 'TP_DESC_3'),
  (4, '4', 'TP_DESC_4')
ON CONFLICT (id) DO UPDATE SET
  tp_code = EXCLUDED.tp_code,
  description_code = EXCLUDED.description_code;

-- -----------------------------------------------------------------------------
-- TRANSLATIONS for primary_types
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('TABLE', 'primary_types', 'TP_DESC_1', 'description_code', 'it', 'Vegetazione'),
  ('TABLE', 'primary_types', 'TP_DESC_1', 'description_code', 'en', 'Vegetation'),
  ('TABLE', 'primary_types', 'TP_DESC_2', 'description_code', 'it', 'Arredo Urbano'),
  ('TABLE', 'primary_types', 'TP_DESC_2', 'description_code', 'en', 'Urban furniture'),
  ('TABLE', 'primary_types', 'TP_DESC_3', 'description_code', 'it', 'Fruizione e Gestione'),
  ('TABLE', 'primary_types', 'TP_DESC_3', 'description_code', 'en', 'Use and management'),
  ('TABLE', 'primary_types', 'TP_DESC_4', 'description_code', 'it', 'Fattori Ambientali'),
  ('TABLE', 'primary_types', 'TP_DESC_4', 'description_code', 'en', 'Environmental factors')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;
