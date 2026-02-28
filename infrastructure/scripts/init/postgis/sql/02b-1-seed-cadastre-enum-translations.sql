-- =============================================================================
-- Seed: translations for cadastre schema ENUMs
-- =============================================================================
-- Localized labels for all cadastre.* ENUM types (ASSET_AREA + ASSET_GREEN).
-- entity_type='ENUM', entity_name='cadastre.<type>', key=enum value, column_name='' (single-slot).
-- Run after 02-init-schema-cadastre.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- intensity_of_fruition (ASSET_AREA)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.intensity_of_fruition', 'NONE', '', 'it', 'Nessuna'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'LOW', '', 'it', 'Bassa'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'LOW', '', 'en', 'Low'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'MEDIUM', '', 'it', 'Media'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'MEDIUM', '', 'en', 'Medium'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'HIGH', '', 'it', 'Alta'),
  ('ENUM', 'cadastre.intensity_of_fruition', 'HIGH', '', 'en', 'High')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- perimeter_type (ASSET_AREA)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.perimeter_type', 'REAL', '', 'it', 'Reale'),
  ('ENUM', 'cadastre.perimeter_type', 'REAL', '', 'en', 'Real'),
  ('ENUM', 'cadastre.perimeter_type', 'FICTITIOUS', '', 'it', 'Fittizio'),
  ('ENUM', 'cadastre.perimeter_type', 'FICTITIOUS', '', 'en', 'Fictitious')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- administrative_status (ASSET_AREA)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.administrative_status', 'IN_DESIGN', '', 'it', 'In progettazione'),
  ('ENUM', 'cadastre.administrative_status', 'IN_DESIGN', '', 'en', 'In design'),
  ('ENUM', 'cadastre.administrative_status', 'PLANNED', '', 'it', 'Pianificato'),
  ('ENUM', 'cadastre.administrative_status', 'PLANNED', '', 'en', 'Planned'),
  ('ENUM', 'cadastre.administrative_status', 'APPROVED', '', 'it', 'Approvato'),
  ('ENUM', 'cadastre.administrative_status', 'APPROVED', '', 'en', 'Approved'),
  ('ENUM', 'cadastre.administrative_status', 'ACTIVE', '', 'it', 'Attivo'),
  ('ENUM', 'cadastre.administrative_status', 'ACTIVE', '', 'en', 'Active'),
  ('ENUM', 'cadastre.administrative_status', 'DISMISSED', '', 'it', 'Dismesso'),
  ('ENUM', 'cadastre.administrative_status', 'DISMISSED', '', 'en', 'Dismissed'),
  ('ENUM', 'cadastre.administrative_status', 'MERGED', '', 'it', 'Accorpato'),
  ('ENUM', 'cadastre.administrative_status', 'MERGED', '', 'en', 'Merged'),
  ('ENUM', 'cadastre.administrative_status', 'RECLASSIFIED', '', 'it', 'Riclassificato'),
  ('ENUM', 'cadastre.administrative_status', 'RECLASSIFIED', '', 'en', 'Reclassified')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- operational_status (ASSET_AREA)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.operational_status', 'IN_MANAGEMENT', '', 'it', 'In gestione'),
  ('ENUM', 'cadastre.operational_status', 'IN_MANAGEMENT', '', 'en', 'In management'),
  ('ENUM', 'cadastre.operational_status', 'UNDER_MAINTENANCE', '', 'it', 'In manutenzione'),
  ('ENUM', 'cadastre.operational_status', 'UNDER_MAINTENANCE', '', 'en', 'Under maintenance'),
  ('ENUM', 'cadastre.operational_status', 'TEMPORARILY_CLOSED', '', 'it', 'Temporaneamente chiuso'),
  ('ENUM', 'cadastre.operational_status', 'TEMPORARILY_CLOSED', '', 'en', 'Temporarily closed'),
  ('ENUM', 'cadastre.operational_status', 'EMERGENCY', '', 'it', 'Emergenza'),
  ('ENUM', 'cadastre.operational_status', 'EMERGENCY', '', 'en', 'Emergency'),
  ('ENUM', 'cadastre.operational_status', 'NOT_ACCESSIBLE', '', 'it', 'Non accessibile'),
  ('ENUM', 'cadastre.operational_status', 'NOT_ACCESSIBLE', '', 'en', 'Not accessible')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- survey_status (ASSET_AREA)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.survey_status', 'NOT_SURVEYED', '', 'it', 'Non censito'),
  ('ENUM', 'cadastre.survey_status', 'NOT_SURVEYED', '', 'en', 'Not surveyed'),
  ('ENUM', 'cadastre.survey_status', 'SURVEY_PENDING', '', 'it', 'Censimento in attesa'),
  ('ENUM', 'cadastre.survey_status', 'SURVEY_PENDING', '', 'en', 'Survey pending'),
  ('ENUM', 'cadastre.survey_status', 'PARTIALLY_SURVEYED', '', 'it', 'Parzialmente censito'),
  ('ENUM', 'cadastre.survey_status', 'PARTIALLY_SURVEYED', '', 'en', 'Partially surveyed'),
  ('ENUM', 'cadastre.survey_status', 'SURVEYED', '', 'it', 'Censito'),
  ('ENUM', 'cadastre.survey_status', 'SURVEYED', '', 'en', 'Surveyed'),
  ('ENUM', 'cadastre.survey_status', 'IMPORTED_DBT', '', 'it', 'Importato DBT'),
  ('ENUM', 'cadastre.survey_status', 'IMPORTED_DBT', '', 'en', 'Imported DBT'),
  ('ENUM', 'cadastre.survey_status', 'TO_BE_VERIFIED', '', 'it', 'Da verificare'),
  ('ENUM', 'cadastre.survey_status', 'TO_BE_VERIFIED', '', 'en', 'To be verified')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- asset_type (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.asset_type', 'tree', '', 'it', 'Albero'),
  ('ENUM', 'cadastre.asset_type', 'tree', '', 'en', 'Tree'),
  ('ENUM', 'cadastre.asset_type', 'row', '', 'it', 'Filare'),
  ('ENUM', 'cadastre.asset_type', 'row', '', 'en', 'Row'),
  ('ENUM', 'cadastre.asset_type', 'lawn', '', 'it', 'Prato'),
  ('ENUM', 'cadastre.asset_type', 'lawn', '', 'en', 'Lawn'),
  ('ENUM', 'cadastre.asset_type', 'park', '', 'it', 'Parco'),
  ('ENUM', 'cadastre.asset_type', 'park', '', 'en', 'Park'),
  ('ENUM', 'cadastre.asset_type', 'urban_forest', '', 'it', 'Bosco urbano'),
  ('ENUM', 'cadastre.asset_type', 'urban_forest', '', 'en', 'Urban forest'),
  ('ENUM', 'cadastre.asset_type', 'hedge', '', 'it', 'Siepe'),
  ('ENUM', 'cadastre.asset_type', 'hedge', '', 'en', 'Hedge'),
  ('ENUM', 'cadastre.asset_type', 'flower_bed', '', 'it', 'Aiuola'),
  ('ENUM', 'cadastre.asset_type', 'flower_bed', '', 'en', 'Flower bed'),
  ('ENUM', 'cadastre.asset_type', 'street_greenery', '', 'it', 'Verde stradale'),
  ('ENUM', 'cadastre.asset_type', 'street_greenery', '', 'en', 'Street greenery'),
  ('ENUM', 'cadastre.asset_type', 'other', '', 'it', 'Altro'),
  ('ENUM', 'cadastre.asset_type', 'other', '', 'en', 'Other')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- geometry_type (ASSET_AREA + ASSET_GREEN: P/L/S per OBT)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.geometry_type', 'P', '', 'it', 'Punto'),
  ('ENUM', 'cadastre.geometry_type', 'P', '', 'en', 'Point'),
  ('ENUM', 'cadastre.geometry_type', 'L', '', 'it', 'Linea'),
  ('ENUM', 'cadastre.geometry_type', 'L', '', 'en', 'Line'),
  ('ENUM', 'cadastre.geometry_type', 'S', '', 'it', 'Superficie'),
  ('ENUM', 'cadastre.geometry_type', 'S', '', 'en', 'Surface')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- health_status (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.health_status', 'UNKNOWN', '', 'it', 'Sconosciuto'),
  ('ENUM', 'cadastre.health_status', 'UNKNOWN', '', 'en', 'Unknown'),
  ('ENUM', 'cadastre.health_status', 'HEALTHY', '', 'it', 'Sano'),
  ('ENUM', 'cadastre.health_status', 'HEALTHY', '', 'en', 'Healthy'),
  ('ENUM', 'cadastre.health_status', 'DEGRADED', '', 'it', 'Degradato'),
  ('ENUM', 'cadastre.health_status', 'DEGRADED', '', 'en', 'Degraded'),
  ('ENUM', 'cadastre.health_status', 'DECLINING', '', 'it', 'In declino'),
  ('ENUM', 'cadastre.health_status', 'DECLINING', '', 'en', 'Declining'),
  ('ENUM', 'cadastre.health_status', 'SICK', '', 'it', 'Malato'),
  ('ENUM', 'cadastre.health_status', 'SICK', '', 'en', 'Sick'),
  ('ENUM', 'cadastre.health_status', 'DECEASED', '', 'it', 'Morto'),
  ('ENUM', 'cadastre.health_status', 'DECEASED', '', 'en', 'Deceased')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- stability_status (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.stability_status', 'STABLE', '', 'it', 'Stabile'),
  ('ENUM', 'cadastre.stability_status', 'STABLE', '', 'en', 'Stable'),
  ('ENUM', 'cadastre.stability_status', 'PARTIALLY_UNSTABLE', '', 'it', 'Parzialmente instabile'),
  ('ENUM', 'cadastre.stability_status', 'PARTIALLY_UNSTABLE', '', 'en', 'Partially unstable'),
  ('ENUM', 'cadastre.stability_status', 'UNSTABLE', '', 'it', 'Instabile'),
  ('ENUM', 'cadastre.stability_status', 'UNSTABLE', '', 'en', 'Unstable'),
  ('ENUM', 'cadastre.stability_status', 'FALLEN', '', 'it', 'Caduto'),
  ('ENUM', 'cadastre.stability_status', 'FALLEN', '', 'en', 'Fallen')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- structural_defect (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.structural_defect', 'NONE', '', 'it', 'Nessuno'),
  ('ENUM', 'cadastre.structural_defect', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.structural_defect', 'ROOT', '', 'it', 'Radice'),
  ('ENUM', 'cadastre.structural_defect', 'ROOT', '', 'en', 'Root'),
  ('ENUM', 'cadastre.structural_defect', 'TRUNK', '', 'it', 'Fusto'),
  ('ENUM', 'cadastre.structural_defect', 'TRUNK', '', 'en', 'Trunk'),
  ('ENUM', 'cadastre.structural_defect', 'BRANCH', '', 'it', 'Ramo'),
  ('ENUM', 'cadastre.structural_defect', 'BRANCH', '', 'en', 'Branch'),
  ('ENUM', 'cadastre.structural_defect', 'MULTIPLE', '', 'it', 'Multiplo'),
  ('ENUM', 'cadastre.structural_defect', 'MULTIPLE', '', 'en', 'Multiple')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- risk_level (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.risk_level', 'NONE', '', 'it', 'Nessuno'),
  ('ENUM', 'cadastre.risk_level', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.risk_level', 'LOW', '', 'it', 'Basso'),
  ('ENUM', 'cadastre.risk_level', 'LOW', '', 'en', 'Low'),
  ('ENUM', 'cadastre.risk_level', 'MEDIUM', '', 'it', 'Medio'),
  ('ENUM', 'cadastre.risk_level', 'MEDIUM', '', 'en', 'Medium'),
  ('ENUM', 'cadastre.risk_level', 'HIGH', '', 'it', 'Alto'),
  ('ENUM', 'cadastre.risk_level', 'HIGH', '', 'en', 'High'),
  ('ENUM', 'cadastre.risk_level', 'EXTREME', '', 'it', 'Estremo'),
  ('ENUM', 'cadastre.risk_level', 'EXTREME', '', 'en', 'Extreme')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- maintenance_priority (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.maintenance_priority', 'NONE', '', 'it', 'Nessuna'),
  ('ENUM', 'cadastre.maintenance_priority', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.maintenance_priority', 'LOW', '', 'it', 'Bassa'),
  ('ENUM', 'cadastre.maintenance_priority', 'LOW', '', 'en', 'Low'),
  ('ENUM', 'cadastre.maintenance_priority', 'MEDIUM', '', 'it', 'Media'),
  ('ENUM', 'cadastre.maintenance_priority', 'MEDIUM', '', 'en', 'Medium'),
  ('ENUM', 'cadastre.maintenance_priority', 'HIGH', '', 'it', 'Alta'),
  ('ENUM', 'cadastre.maintenance_priority', 'HIGH', '', 'en', 'High'),
  ('ENUM', 'cadastre.maintenance_priority', 'URGENT', '', 'it', 'Urgente'),
  ('ENUM', 'cadastre.maintenance_priority', 'URGENT', '', 'en', 'Urgent')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- intervention_type (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.intervention_type', 'NONE', '', 'it', 'Nessuno'),
  ('ENUM', 'cadastre.intervention_type', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.intervention_type', 'PRUNING', '', 'it', 'Potatura'),
  ('ENUM', 'cadastre.intervention_type', 'PRUNING', '', 'en', 'Pruning'),
  ('ENUM', 'cadastre.intervention_type', 'CONSOLIDATION', '', 'it', 'Consolidamento'),
  ('ENUM', 'cadastre.intervention_type', 'CONSOLIDATION', '', 'en', 'Consolidation'),
  ('ENUM', 'cadastre.intervention_type', 'TREATMENT', '', 'it', 'Trattamento'),
  ('ENUM', 'cadastre.intervention_type', 'TREATMENT', '', 'en', 'Treatment'),
  ('ENUM', 'cadastre.intervention_type', 'REMOVAL', '', 'it', 'Abbattimento'),
  ('ENUM', 'cadastre.intervention_type', 'REMOVAL', '', 'en', 'Removal'),
  ('ENUM', 'cadastre.intervention_type', 'REPLACEMENT', '', 'it', 'Sostituzione'),
  ('ENUM', 'cadastre.intervention_type', 'REPLACEMENT', '', 'en', 'Replacement')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- growth_stage (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.growth_stage', 'YOUNG', '', 'it', 'Giovane'),
  ('ENUM', 'cadastre.growth_stage', 'YOUNG', '', 'en', 'Young'),
  ('ENUM', 'cadastre.growth_stage', 'SEMI_MATURE', '', 'it', 'Semi-matura'),
  ('ENUM', 'cadastre.growth_stage', 'SEMI_MATURE', '', 'en', 'Semi-mature'),
  ('ENUM', 'cadastre.growth_stage', 'MATURE', '', 'it', 'Matura'),
  ('ENUM', 'cadastre.growth_stage', 'MATURE', '', 'en', 'Mature'),
  ('ENUM', 'cadastre.growth_stage', 'OVERMATURE', '', 'it', 'Sovramatura'),
  ('ENUM', 'cadastre.growth_stage', 'OVERMATURE', '', 'en', 'Overmature'),
  ('ENUM', 'cadastre.growth_stage', 'DEAD', '', 'it', 'Morto'),
  ('ENUM', 'cadastre.growth_stage', 'DEAD', '', 'en', 'Dead')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- origin (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.origin', 'NATIVE', '', 'it', 'Autoctono'),
  ('ENUM', 'cadastre.origin', 'NATIVE', '', 'en', 'Native'),
  ('ENUM', 'cadastre.origin', 'EXOTIC', '', 'it', 'Esotico'),
  ('ENUM', 'cadastre.origin', 'EXOTIC', '', 'en', 'Exotic'),
  ('ENUM', 'cadastre.origin', 'INVASIVE', '', 'it', 'Invasivo'),
  ('ENUM', 'cadastre.origin', 'INVASIVE', '', 'en', 'Invasive'),
  ('ENUM', 'cadastre.origin', 'CULTIVAR', '', 'it', 'Cultivar'),
  ('ENUM', 'cadastre.origin', 'CULTIVAR', '', 'en', 'Cultivar')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- protection_status (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.protection_status', 'NONE', '', 'it', 'Nessuna'),
  ('ENUM', 'cadastre.protection_status', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.protection_status', 'PROTECTED', '', 'it', 'Protetto'),
  ('ENUM', 'cadastre.protection_status', 'PROTECTED', '', 'en', 'Protected'),
  ('ENUM', 'cadastre.protection_status', 'MONUMENTAL', '', 'it', 'Monumentale'),
  ('ENUM', 'cadastre.protection_status', 'MONUMENTAL', '', 'en', 'Monumental'),
  ('ENUM', 'cadastre.protection_status', 'HISTORICAL', '', 'it', 'Storico'),
  ('ENUM', 'cadastre.protection_status', 'HISTORICAL', '', 'en', 'Historical')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- asset_status (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.asset_status', 'PLANNED', '', 'it', 'Pianificato'),
  ('ENUM', 'cadastre.asset_status', 'PLANNED', '', 'en', 'Planned'),
  ('ENUM', 'cadastre.asset_status', 'INSTALLED', '', 'it', 'Installato'),
  ('ENUM', 'cadastre.asset_status', 'INSTALLED', '', 'en', 'Installed'),
  ('ENUM', 'cadastre.asset_status', 'ACTIVE', '', 'it', 'Attivo'),
  ('ENUM', 'cadastre.asset_status', 'ACTIVE', '', 'en', 'Active'),
  ('ENUM', 'cadastre.asset_status', 'TEMPORARILY_OUT_OF_SERVICE', '', 'it', 'Temporaneamente fuori servizio'),
  ('ENUM', 'cadastre.asset_status', 'TEMPORARILY_OUT_OF_SERVICE', '', 'en', 'Temporarily out of service'),
  ('ENUM', 'cadastre.asset_status', 'REMOVED', '', 'it', 'Rimosso'),
  ('ENUM', 'cadastre.asset_status', 'REMOVED', '', 'en', 'Removed')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- monitoring_required (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.monitoring_required', 'NONE', '', 'it', 'Nessuno'),
  ('ENUM', 'cadastre.monitoring_required', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.monitoring_required', 'PERIODIC', '', 'it', 'Periodico'),
  ('ENUM', 'cadastre.monitoring_required', 'PERIODIC', '', 'en', 'Periodic'),
  ('ENUM', 'cadastre.monitoring_required', 'URGENT', '', 'it', 'Urgente'),
  ('ENUM', 'cadastre.monitoring_required', 'URGENT', '', 'en', 'Urgent')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;

-- -----------------------------------------------------------------------------
-- priority_level_evaluation (ASSET_GREEN)
-- -----------------------------------------------------------------------------
INSERT INTO public.translations (entity_type, entity_name, key, column_name, lang, translation)
VALUES
  ('ENUM', 'cadastre.priority_level_evaluation', 'NONE', '', 'it', 'Nessuno'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'NONE', '', 'en', 'None'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'LOW', '', 'it', 'Basso'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'LOW', '', 'en', 'Low'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'MEDIUM', '', 'it', 'Medio'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'MEDIUM', '', 'en', 'Medium'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'HIGH', '', 'it', 'Alto'),
  ('ENUM', 'cadastre.priority_level_evaluation', 'HIGH', '', 'en', 'High')
ON CONFLICT (entity_type, entity_name, key, lang, column_name) DO UPDATE SET
  translation = EXCLUDED.translation;
