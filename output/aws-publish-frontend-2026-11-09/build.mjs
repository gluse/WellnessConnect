import path from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = process.cwd();
await build({
  configFile: false,
  envFile: false,
  envPrefix: 'AWS_PUBLISH_TEST_NO_ENV_',
  plugins: [react()],
  root: path.join(root, 'client'),
  resolve: { alias: {
    '@': path.join(root, 'client/src'),
    '@shared': path.join(root, 'shared'),
    '@assets': path.join(root, 'attached_assets'),
  } },
  build: { outDir: path.join(root, 'output/aws-publish-frontend-2026-11-09/build'), emptyOutDir: true },
});
