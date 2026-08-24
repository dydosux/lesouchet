import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.timber.lesouchet',
  appName: 'ЛесоУчёт',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
