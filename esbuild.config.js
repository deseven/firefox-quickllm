const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');
const fs = require('fs');
const path = require('path');

// Read version from manifest.json, license, and usage guide
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;
const license = fs.readFileSync('LICENSE', 'utf8');
const usageGuide = fs.readFileSync('USAGE.md', 'utf8');

// Plugin to handle CSS files that need to be converted to strings
const cssToStringPlugin = {
  name: 'css-to-string',
  setup(build) {
    build.onLoad({ filter: /styles\/(content|shadow-modal)\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(css)};`,
        loader: 'js',
      };
    });
  },
};

// Plugin to copy assets and HTML files
const assetsPlugin = {
  name: 'assets-plugin',
  setup(build) {
    build.onEnd(async () => {
      // Copy boxicons assets
      const boxiconsSourceDir = 'node_modules/boxicons';
      const boxiconsDestDir = 'dist/assets/boxicons';
      
      // Create boxicons directory
      await fs.promises.mkdir(path.join(boxiconsDestDir, 'css'), { recursive: true });
      await fs.promises.mkdir(path.join(boxiconsDestDir, 'fonts'), { recursive: true });
      
      // Copy CSS file
      await fs.promises.copyFile(
        path.join(boxiconsSourceDir, 'css/boxicons.min.css'),
        path.join(boxiconsDestDir, 'css/boxicons.min.css')
      );
      
      // Copy font files
      const fontFiles = ['boxicons.eot', 'boxicons.svg', 'boxicons.ttf', 'boxicons.woff', 'boxicons.woff2'];
      for (const fontFile of fontFiles) {
        await fs.promises.copyFile(
          path.join(boxiconsSourceDir, 'fonts', fontFile),
          path.join(boxiconsDestDir, 'fonts', fontFile)
        );
      }

      // Process HTML files
      const htmlFiles = [
        { template: 'src/pages/extension/extension.html', output: 'extension.html', chunk: 'extension' },
        { template: 'src/pages/process/process.html', output: 'process.html', chunk: 'process' },
        { template: 'src/pages/profile-edit/profile-edit.html', output: 'profile-edit.html', chunk: 'profile-edit' },
        { template: 'src/pages/settings/settings.html', output: 'settings.html', chunk: 'settings' },
        { template: 'src/pages/help/help.html', output: 'help.html', chunk: 'help' },
      ];

      for (const htmlFile of htmlFiles) {
        let html = await fs.promises.readFile(htmlFile.template, 'utf8');
        
        // Inject the polyfill script first, then the main script
        const polyfillTag = `<script src="browser-polyfill.js"></script>`;
        const scriptTag = `<script src="${htmlFile.chunk}.js"></script>`;
        const cssTag = `<link rel="stylesheet" href="${htmlFile.chunk}.css">`;
        
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${polyfillTag}\n${scriptTag}\n</body>`);
        } else {
          html += `\n${polyfillTag}\n${scriptTag}`;
        }
        
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${cssTag}\n</head>`);
        } else if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>\n${cssTag}`);
        } else {
          html = `${cssTag}\n${html}`;
        }
        
        await fs.promises.writeFile(path.join('dist', htmlFile.output), html);
      }
    });
  },
};

const buildOptions = {
  entryPoints: {
    'browser-polyfill': './src/core/browser-polyfill.js',
    background: './src/core/background.js',
    extension: './src/pages/extension/extension.js',
    process: './src/pages/process/process.js',
    injector: './src/core/injector.js',
    'profile-edit': './src/pages/profile-edit/profile-edit.js',
    settings: './src/pages/settings/settings.js',
    help: './src/pages/help/help.js'
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: true,
  sourcemap: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.EXTENSION_VERSION': JSON.stringify(version),
    'process.env.EXTENSION_LICENSE': JSON.stringify(license),
    'process.env.USAGE_GUIDE': JSON.stringify(usageGuide),
  },
  plugins: [
    polyfillNode({
      polyfills: {
        buffer: true,
        stream: true,
        util: true,
        url: true,
        querystring: true,
        path: true,
        crypto: true,
        fs: false,
        net: false,
        tls: false,
      },
    }),
    cssToStringPlugin,
    assetsPlugin,
  ],
  loader: {
    '.css': 'css',
    '.html': 'text',
  },
  external: [],
};

async function build() {
  try {
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });

    await esbuild.build(buildOptions);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  try {
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });

    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } catch (error) {
    console.error('Watch failed:', error);
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  const isWatch = process.argv.includes('--watch');
  if (isWatch) {
    watch();
  } else {
    build();
  }
}

module.exports = { build, watch, buildOptions };