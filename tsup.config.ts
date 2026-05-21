import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  banner: { js: '#!/usr/bin/env node' },
  dts: false,
  clean: true,
});
