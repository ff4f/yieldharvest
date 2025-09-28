/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_HEDERA_NETWORK: string;
  readonly VITE_HEDERA_ACCOUNT_ID: string;
  readonly VITE_HEDERA_PRIVATE_KEY: string;
  readonly VITE_HASHSCAN_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}