import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.capstream.editor',
  appName: 'CapStream',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
