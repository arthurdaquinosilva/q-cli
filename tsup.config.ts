import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  banner: { js: '#!/usr/bin/env node' },
  dts: false,
  clean: true,
  external: ['better-sqlite3', 'keytar'],
  define: { __PKG_VERSION__: JSON.stringify(version) },
});
