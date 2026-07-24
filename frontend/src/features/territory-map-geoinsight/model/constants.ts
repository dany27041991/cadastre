/** Geoinsight geometry id prefixes (see spike plan). */
export const GEOM_PREFIX = {
  territory: 'T_',
  greenArea: 'GA_',
  greenAsset: 'GS_',
  cluster: 'GC_',
} as const

export const GEOINSIGHT_EPSG_WGS84 = 'EPSG:4326'

/** Territory fill base (Geoinsight derives fill alpha from hex). */
export const TERRITORY_GEOMETRY_FILL_COLOR = '#6b7280'
export const GREEN_AREA_GEOMETRY_COLOR = '#16a34a'
