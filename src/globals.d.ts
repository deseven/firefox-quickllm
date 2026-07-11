// Global type declarations for the QuickLLM WebExtension.
//
// These are provided at runtime by Firefox (`browser`) and Chrome (`chrome`),
// and by src/core/browser-polyfill.js which promisifies the Chrome API.
// Declaring them here silences "Cannot find name 'browser'" errors reported by
// VSCode's JavaScript language service when checkJs is enabled.

/**
 * The WebExtension `browser` API surface used by QuickLLM.
 * Typed loosely (as `any`) to avoid coupling to a specific @types package.
 * Declared as `var` so it is also accessible via `globalThis.browser`.
 */
declare var browser: any;

/**
 * The Chrome `chrome` extension API surface.
 */
declare var chrome: any;

interface Window {
    /** Bootstrap bundle exposed for inline HTML handlers. */
    bootstrap: any;
    /** Stored theme-change listener registered by theme-utils.js. */
    _quickllmThemeListener: ((e: MediaQueryListEvent) => void) | null;
}

// CSS side-effect imports (e.g. `import './styles.css'`) have no type
// declarations by default. This module declaration lets esbuild-style CSS
// imports pass type checking without error.
declare module '*.css';
