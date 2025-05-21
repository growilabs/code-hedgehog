/// <reference types="vite/client" />
/// <reference lib="deno.ns" />

interface ImportMetaEnv {
  readonly VITE_OWNERS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
