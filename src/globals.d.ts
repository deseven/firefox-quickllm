// Global type declarations for the WebExtension `browser` and `chrome` APIs.
// These are provided at runtime by Firefox (`browser`) and Chrome (`chrome`),
// and by src/core/browser-polyfill.js which promisifies the Chrome API.
// Declaring them here silences "Cannot find name 'browser'" errors reported by
// VSCode's JavaScript language service when checkJs is enabled.

/**
 * The WebExtension `browser` API surface used by QuickLLM.
 * Typed loosely (as `any`) to avoid coupling to a specific @types package.
 */
declare const browser: any;

/**
 * The Chrome `chrome` extension API surface.
 */
declare const chrome: any;

// CSS side-effect imports (e.g. `import './styles.css'`) have no type
// declarations by default. This module declaration lets esbuild-style CSS
// imports pass type checking without error.
declare module '*.css';
