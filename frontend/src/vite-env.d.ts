/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** FGP mock per standalone (sessionStorage); es. da compose. */
  readonly VITE_MOCK_FGP?: string
  /** Utente mock JSON per standalone (useAuthStore); es. {"preferred_username":"user@test","nome":"Nome","cognome":"Cognome"}. */
  readonly VITE_MOCK_USER?: string
  /** Cookie mock per standalone (formato header Cookie: name=value; name2=value2). */
  readonly VITE_MOCK_COOKIE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
