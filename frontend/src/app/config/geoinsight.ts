/**
 * Geoinsight WebGIS configuration — defaults match cu1.5-fe (webgis 155, CU PNRR).
 */
import {
  GEOINSIGHT_CU_ID,
  GEOINSIGHT_MAP_ID,
  GEOINSIGHT_WEBGIS_ID,
} from './geoinsightConstants'

export const geoinsightConfig = {
  webgisId: Number(import.meta.env.VITE_GEOINSIGHT_WEBGIS_ID ?? String(GEOINSIGHT_WEBGIS_ID)),
  cuId: import.meta.env.VITE_GEOINSIGHT_CU_ID ?? GEOINSIGHT_CU_ID,
  mapId: Number(import.meta.env.VITE_GEOINSIGHT_MAP_ID ?? String(GEOINSIGHT_MAP_ID)),
} as const
