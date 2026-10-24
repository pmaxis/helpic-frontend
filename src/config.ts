/** Product name shown in the sidebar and mobile header. */
export const APP_NAME = 'Helpic'

/** This frontend's build: its version (git describe, or "dev") and when it was built. */
export const BUILD = {
  version: __APP_VERSION__,
  builtAt: __BUILD_TIME__,
  /** Served by Vite's dev server, not a production bundle. */
  dev: import.meta.env.DEV,
}
