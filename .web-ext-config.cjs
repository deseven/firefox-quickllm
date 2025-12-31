module.exports = {
  // Use current directory as source but ignore unnecessary files
  sourceDir: '.',
  
  // Output directory for the XPI file
  artifactsDir: 'web-ext-artifacts',
  
  // Ignore files that shouldn't be in the extension package
  ignoreFiles: [
    'node_modules',
    'src',
    'package.json',
    'package-lock.json',
    'esbuild.config.js',
    '.gitignore',
    'README.md',
    'LICENSE',
    '.web-ext-config.cjs',
    'web-ext-artifacts',
    '.git',
    '*.log'
  ],
  
  build: {
    overwriteDest: true
  }
};