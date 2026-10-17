import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.puzzellab.seamshift',
  appName: 'SeamShift',
  webDir: 'www',
  backgroundColor: '#0b0d1a',
  ios: { contentInset: 'never' },
  // Test build: loads the live page so changes show up after reopening the app. Remove for the store build.
  server: { url: 'https://puzzellab-test.vercel.app/seamshift/', errorPath: 'index.html' },
};

export default config;
