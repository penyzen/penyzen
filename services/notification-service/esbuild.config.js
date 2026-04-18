const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  // Include HBS templates at build time using the copy plugin pattern
  loader: { '.hbs': 'text' },
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
}).catch(() => process.exit(1));
