/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Firebase (client-side, public by design)
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  // RevenueCat (native only, public SDK key)
  readonly VITE_REVENUECAT_API_KEY?: string;
  // NEVER add ANTHROPIC_API_KEY or ELEVENLABS_API_KEY here!
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
