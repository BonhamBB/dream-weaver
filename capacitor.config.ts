import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dreamweaver.app',
  appName: 'Dream Weaver',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#060919',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060919',
    },
    App: {
      // Required for back button handling
    },
  },
  android: {
    backgroundColor: '#060919',
    allowMixedContent: false,
    useLegacyBridge: false,
    buildOptions: {
      signingType: 'apksigner',
    },
  },
};

export default config;
