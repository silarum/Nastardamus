import { build } from 'esbuild';

await build({
  entryPoints: ['ui-kit/app.js'],
  outfile: 'ui-kit/app.bundle.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome80', 'safari13'],
  legalComments: 'none',
  sourcemap: false
});
