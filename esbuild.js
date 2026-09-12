const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

/** @param {string} name */
function webviewConfig(name) {
  return {
    entryPoints: [`webview/${name}/index.tsx`],
    bundle: true,
    outfile: `dist/webview/${name}.js`,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
  };
}

const configs = [
  extensionConfig,
  webviewConfig('sidebar'),
  webviewConfig('dashboard'),
  webviewConfig('challenge'),
  webviewConfig('onboarding'),
];

async function run() {
  if (watch) {
    const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('watching...');
  } else {
    await Promise.all(configs.map((c) => esbuild.build(c)));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
