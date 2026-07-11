// Type definitions for the content script layer.
//
// These JSDoc typedefs document the shape of the data that flows through
// the content script: profile objects, extracted text, and stream state.
// With checkJs enabled (jsconfig.json), editors can surface these types
// across the content/ modules without a TypeScript migration.

/**
 * A configured LLM profile.
 *
 * This is the canonical shape used across storage, background, content,
 * and UI layers. In memory, `apiKey` holds plaintext; in storage it is
 * obfuscated (see crypto-utils.js). The `id` is assigned at creation time
 * and is stable for the profile's lifetime.
 *
 * @typedef {Object} Profile
 * @property {string} id - Unique profile identifier.
 * @property {string} name - Display name.
 * @property {string} type - Provider type string (e.g. 'openai', 'anthropic', 'ollama').
 * @property {string} model - Model identifier to use.
 * @property {string|null|undefined} [apiKey] - API key (plaintext in memory, obfuscated in storage).
 * @property {string|null} [endpoint] - Custom endpoint URL override, or null to use the provider default.
 * @property {string} [systemPrompt] - System prompt text.
 * @property {string|null} [userPrompt] - Default user prompt text, or null when unset.
 * @property {boolean} [processImmediately] - Whether to auto-run on profile selection.
 * @property {boolean} [diffOutput] - Whether to render the response as a diff.
 * @property {string|null} [extraOptions] - JSON string of extra provider options, or null when unset.
 */

/**
 * The result of extracting text from the page.
 * @typedef {Object} ExtractedText
 * @property {string} text - The extracted text content.
 * @property {'selected text'|'page content'} textType - How the text was obtained.
 */

/**
 * Tracks the lifecycle of a single LLM stream within the content script.
 * @typedef {Object} StreamState
 * @property {string|null} streamId - The active stream ID, or null when idle.
 * @property {boolean} diffMode - Whether the response should be rendered as a diff.
 * @property {string|null} diffOriginalText - The original text to diff against (when diffMode is true).
 * @property {{ content: string }|null} diffThrottle - Pending diff content awaiting an animation frame.
 */

/**
 * Decides what the Enter key should do inside the prompt modal.
 *
 * - If a response is available and the prompt hasn't changed since the last
 *   process, Enter copies the response and closes the modal.
 * - Otherwise Enter triggers a new processing request.
 *
 * @callback EnterActionResolver
 * @param {boolean} hasResponse - Whether a response is currently displayed.
 * @param {boolean} hasProcessedOnce - Whether at least one process has run.
 * @param {string} currentPrompt - The trimmed current prompt value.
 * @param {string} originalPrompt - The trimmed prompt value from the last process.
 * @param {boolean} copyVisible - Whether the copy button is currently visible.
 * @returns {'copy'|'process'} The action to take.
 */

export {};
