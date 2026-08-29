import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'link.created.minesweepermaui',
  appName: 'Modern Minesweeper',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
