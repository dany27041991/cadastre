/**
 * Full Geoinsight endpoint map for Vite standalone (from bundle defaults ODe, paths → sim-dev proxy).
 * Must not replace bundle defaults with a partial map — endpointStore.init() overwrites all keys.
 */
const GEO = '/core/api/geoinsight/v1'
const IL = '/core/api/integrationlogic'

export const STANDALONE_GEOINSIGHT_ENDPOINTS: Record<string, { url: string }> = {
  'CONFIG.GET_WEBGIS_CONFIG': {
    url: `${GEO}/__standalone_block_duplicate_config__`,
  },
  'CONFIG.GET_WEBGIS_TOOLS': { url: `${GEO}/webgis/config/services` },
  GEOCODING: { url: `${GEO}/geocode` },
  'CATALOG.GET_CATALOGS': { url: `${GEO}/webgis/config/catalog_layers` },
  'CATALOG.GET_CATALOG_CONFIG_BY_GUID': { url: `${GEO}/layer/config/` },
  'CATALOG.GET_OWNER_ORGANIZATIONS': { url: '/portalediaccesso/common-labels.json' },
  'TECHNICAL_METADATA.SEARCH': { url: `${IL}/technical-metadata/search` },
  'TECHNICAL_METADATA.INTEGRATION_LOGIC_SEARCH': { url: `${IL}/technical-metadata/search` },
  'LAYER.LAYER_GET_EXTENT': { url: `${GEO}/layer/get_extent` },
  'LAYER.DESCRIBE_FEATURES_BY_LAYER': { url: `${GEO}/features/describe` },
  'LAYER.GET_FEATURES_BY_LAYER': { url: `${GEO}/features` },
  'LAYER.GET_FEATURE_INFO': { url: `${GEO}/features/info` },
  'LAYER.GET_WMTS_CAPABILITIES': { url: `${GEO}/layer/wmts/capabilities` },
  'LAYER.SAVE_EDITING': { url: `${GEO}/features/editing` },
  'LAYER.CONVERT_GEODATA': { url: `${GEO}/upload/layer` },
  'LAYER.FEATURE_EXPORT': { url: `${GEO}/features/export` },
  'DOWNLOAD.GET_ADMIN_BOUNDARIES': { url: `${IL}/admin-boundaries-geoinsight` },
  'DOWNLOAD.GET_LAYER_BY_ADMIN_BOUNDARY': { url: `${GEO}/features/by_admin_boundaries` },
  'DOWNLOAD.DOWNLOAD_CART': { url: `${IL}/layers/download` },
  'DOWNLOAD.DOWNLOAD_STATUS': { url: `${IL}/layers/download/\${cart_id}/status` },
  'DOWNLOAD.DOWNLOAD_FILE': { url: `${IL}/layers/download/\${cart_id}` },
  'WEBGIS_MANAGER.GET_WEBGIS_LIST': { url: `${GEO}/webgis/all` },
  'WEBGIS_MANAGER.GET_WEBGIS': { url: `${GEO}/webgis` },
  'WEBGIS_MANAGER.SAVE_NEW_WEBGIS': { url: `${GEO}/webgis` },
  'WEBGIS_MANAGER.CLONE_WEBGIS': { url: `${GEO}/webgis/clone` },
  'WEBGIS_MANAGER.UPDATE_WEBGIS_METADATA': { url: `${GEO}/webgis` },
  'WEBGIS_MANAGER.SAVE_WEBGIS': { url: `${GEO}/webgis/file` },
  'WEBGIS_MANAGER.DELETE_WEBGIS': { url: `${GEO}/webgis` },
}
