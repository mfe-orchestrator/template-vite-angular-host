/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MFE_BACKEND_URL: string
  readonly VITE_MFE_PROJECT_ID: string
  /** Optional: left unset, the backend resolves the environment from the domain. */
  readonly VITE_MFE_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Remotes are resolved at runtime, so the compiler cannot see their types.
 * Add one line per remote module you import.
 */
declare module 'exampleremote/Button'
