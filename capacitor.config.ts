import type { CapacitorConfig } from '@capacitor/cli';

// TASK-047 isolated proof. This bundles local assets and cannot load a remote app.
// Real API/auth integration and store identity require a separate reviewed release.
const config: CapacitorConfig = {
  appId: 'com.fitsmytime.proof',
  appName: 'Ordelino Local Proof',
  webDir: 'output/native-proof/www',
  server: { androidScheme: 'https', hostname: 'localhost', cleartext: false },
  android: { allowMixedContent: false },
};

export default config;
