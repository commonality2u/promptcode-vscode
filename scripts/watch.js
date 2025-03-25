const esbuild = require('esbuild');
const { copyFileSync, mkdirSync, readdirSync } = require('fs');
const { join } = require('path');
const { existsSync } = require('fs');

// Ensure output directory exists
const outDir = join(__dirname, '..', 'out');
const outWebviewDir = join(outDir, 'webview');
const outWebviewStylesDir = join(outWebviewDir, 'styles');

if (!existsSync(outWebviewDir)) {
  mkdirSync(outWebviewDir, { recursive: true });
}

if (!existsSync(outWebviewStylesDir)) {
  mkdirSync(outWebviewStylesDir, { recursive: true });
}

// Copy webview files
function copyWebviewFiles() {
  const webviewDir = join(__dirname, '..', 'src', 'webview');
  const webviewStylesDir = join(webviewDir, 'styles');
  
  // Copy all CSS files
  readdirSync(webviewStylesDir)
    .filter(file => file.endsWith('.css'))
    .forEach(file => {
      const src = join(webviewStylesDir, file);
      const dest = join(outWebviewStylesDir, file);
      try {
        copyFileSync(src, dest);
      } catch (err) {
        console.error(`Error copying ${file}:`, err);
      }
    });
  
  // JS files are now handled by esbuild in the watch context
}

// Build and watch
async function watch() {
  // Main extension context
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    external: ['vscode'],
    platform: 'node',
    format: 'cjs',
    sourcemap: true,
    logLevel: 'info'
  });

  // Webview JS context
  const webviewJsFiles = [
    'webview.js',
    'mergeTab.js',
    'instructionsTab.js',
    'selectFilesTab.js',
    'generatePromptTab.js'
  ];

  const webviewCtx = await esbuild.context({
    entryPoints: webviewJsFiles.map(file => `src/webview/${file}`),
    bundle: true,
    outdir: 'out/webview',
    format: 'iife',
    sourcemap: true,
    target: ['es2020'],
    logLevel: 'info'
  });

  await extensionCtx.rebuild();
  await webviewCtx.rebuild();
  copyWebviewFiles();
  
  await Promise.all([
    extensionCtx.watch(),
    webviewCtx.watch()
  ]);
  console.log('Watching for changes...');
}

watch().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});