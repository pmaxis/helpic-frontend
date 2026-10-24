/// <reference types="vite/client" />

/** The frontend's version and when it was built, baked in by vite.config.ts. */
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface HelpicConfig {
  apiBaseUrl?: string
}

interface Window {
  __HELpic_CONFIG__?: HelpicConfig
}
