const esbuild = require('esbuild');
const { copyFileSync, mkdirSync, readdirSync, unlinkSync } = require('fs');
const { join, dirname } = require('path');
const { existsSync } = require('fs');
const path = require('path');
const fs = require('fs');

// Parse arguments
const shouldMinify = process.argv.includes('--minify');
const isPublishBuild = process.argv.includes('--publish') || process.env.NODE_ENV === 'production';

// Build the extension
esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  sourcemap: !isPublishBuild, // Only generate sourcemaps for development builds
  minify: shouldMinify || isPublishBuild,
  target: ['es2020'],
  treeShaking: true,
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': isPublishBuild ? '"production"' : '"development"'
  },
  // Add any legal comments or copyright notices at the top of the file
  banner: {
    js: '/* PromptCode - Copyright (C) 2025. All Rights Reserved. */',
  },
}).then(() => {
  console.log('Extension compiled successfully');
  
  // Copy webview resources
  const webviewDir = join(__dirname, '..', 'src', 'webview');
  const webviewStylesDir = join(webviewDir, 'styles');
  const outWebviewStylesDir = join(__dirname, '..', 'out', 'webview', 'styles');
  
  // Copy all CSS files
  readdirSync(webviewStylesDir)
    .filter(file => file.endsWith('.css'))
    .forEach(file => {
      const sourcePath = join(webviewStylesDir, file);
      const destPath = join(outWebviewStylesDir, file);
      copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    });
  
  // Process webview JS files with esbuild (minify and bundle for production)
  console.log('Processing webview JS files...');
  
  // Dynamically find all JS files in the webview directory
  const webviewJsFiles = readdirSync(webviewDir)
    .filter(file => file.endsWith('.js'))
    .map(file => join(webviewDir, file));
  
  console.log(`Found ${webviewJsFiles.length} webview JS files to process:`, webviewJsFiles);
  
  esbuild.build({
    entryPoints: webviewJsFiles,
    bundle: true,
    outdir: outWebviewDir,
    minify: shouldMinify || isPublishBuild,
    sourcemap: !isPublishBuild,
    target: ['es2020'],
    format: 'iife', // Use IIFE for browser compatibility
    legalComments: 'none',
    define: {
      'process.env.NODE_ENV': isPublishBuild ? '"production"' : '"development"'
    },
    banner: {
      js: '/* PromptCode - Copyright (C) 2025. All Rights Reserved. */',
    },
  }).then(() => {
    console.log('Webview JS files compiled and minified successfully');
  }).catch(error => {
    console.error('Error processing webview JS files:', error);
    process.exit(1);
  });
  
  // Copy codicons files to output directory
  const codiconsDir = path.join(__dirname, '../node_modules/@vscode/codicons/dist');
  const codiconsOutDir = path.join(__dirname, '../out/webview/codicons');
  
  // Create directory if it doesn't exist
  if (!existsSync(codiconsOutDir)) {
    mkdirSync(codiconsOutDir, { recursive: true });
  }
  
  // Copy codicon.ttf
  copyFileSync(
    path.join(codiconsDir, 'codicon.ttf'),
    path.join(codiconsOutDir, 'codicon.ttf')
  );
  
  // Read the original CSS file
  const codiconCssContent = fs.readFileSync(path.join(codiconsDir, 'codicon.css'), 'utf8');
  
  // Update the font path to point to the same directory
  const updatedCssContent = codiconCssContent.replace(
    'src: url("./codicon.ttf?',
    'src: url("codicon.ttf?'
  );
  
  // Write the modified CSS file
  fs.writeFileSync(path.join(codiconsOutDir, 'codicon.css'), updatedCssContent);
  
  console.log('Copied and modified codicons files to output directory');
  
  // Add copyright notice to all output JavaScript files
  if (isPublishBuild) {
    console.log('Adding copyright notices to output files...');
    const copyrightNotice = '/* PromptCode - Copyright (C) 2025. All Rights Reserved. */\n';
    
    // Function to add copyright to a file
    const addCopyrightToFile = (filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('Copyright (C)')) {
        fs.writeFileSync(filePath, copyrightNotice + content);
        console.log(`Added copyright notice to ${filePath}`);
      }
    };

    // Add copyright to all JS files in output directory
    const processDir = (dir) => {
      readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          processDir(fullPath);
        } else if (dirent.name.endsWith('.js')) {
          addCopyrightToFile(fullPath);
        }
      });
    };

    processDir(outDir);
  }
  
  console.log('Build completed successfully!');
  
  // Remove sourcemap files for publish builds
  if (isPublishBuild) {
    console.log('Removing sourcemap files for production build...');
    removeSourcemapFiles(outDir);
  }
}).catch(() => process.exit(1)); 