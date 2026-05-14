const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  sourcemap: true,
  minify: false,
}).then(() => {
  // Copy the SQL alongside the handler so readFileSync(__dirname + '/initial-schema.sql') works.
  fs.copyFileSync(
    path.join('src', 'initial-schema.sql'),
    path.join('dist', 'initial-schema.sql'),
  );
}).catch(() => process.exit(1));
