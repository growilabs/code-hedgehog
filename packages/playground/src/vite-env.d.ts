/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWNERS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
