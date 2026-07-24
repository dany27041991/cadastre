/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_GEOINSIGHT_WEBGIS_ID?: string
  readonly VITE_GEOINSIGHT_CU_ID?: string
  readonly VITE_GEOINSIGHT_MAP_ID?: string
  /** sim-dev (or other MASE env) origin for Vite dev proxy. */
  readonly VITE_MASE_API_ORIGIN?: string
  /** Mock FGP for standalone (sessionStorage); e.g. from compose. */
  readonly VITE_MOCK_FGP?: string
  /** Mock user JSON for standalone (useAuthStore); e.g. {"preferred_username":"user@test",...}. */
  readonly VITE_MOCK_USER?: string
  /** Mock Cookie header string for standalone: name=value; name2=value2. */
  readonly VITE_MOCK_COOKIE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
