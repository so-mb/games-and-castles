/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_USE_EMULATORS?: string;
  readonly VITE_FIREBASE_APP_CHECK_ENABLED?: string;
  readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_APP_CHECK_PROVIDER?: string;
  readonly VITE_FIREBASE_APP_CHECK_DEBUG?: string;
  readonly VITE_BUILD_SHA?: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_BUILD_REF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
