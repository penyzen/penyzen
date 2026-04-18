const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  // Exclude @prisma/client — it ships as a Lambda Layer (native binaries)
  external: ['@prisma/client', '.prisma/client'],
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
}).catch(() => process.exit(1));
