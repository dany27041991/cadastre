/**
 * Handler type for territory map feature selection.
 */
import type Feature from 'ol/Feature'

export type FeatureSelectHandler = (
  id: number,
  label: string,
  feature?: Feature
) => void
