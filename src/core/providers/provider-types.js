// Central registry of LLM provider types and their metadata.
// This is the single source of truth for provider type strings, default
// endpoints, and display metadata. Importing from here avoids scattering
// magic strings across the codebase.

/**
 * Provider type constants.
 * Use these instead of raw strings when comparing or storing provider types.
 */
export const PROVIDER_TYPES = Object.freeze({
    OPENAI: 'openai',
    OPENROUTER: 'openrouter',
    TOGETHER: 'together',
    DEEPSEEK: 'deepseek',
    ANTHROPIC: 'anthropic',
    OLLAMA: 'ollama'
});

/**
 * Default endpoints for providers that have one.
 * Providers not listed here (e.g. openai, anthropic, ollama) use the SDK default.
 */
const DEFAULT_ENDPOINTS = {
    [PROVIDER_TYPES.OPENROUTER]: 'https://openrouter.ai/api/v1',
    [PROVIDER_TYPES.TOGETHER]: 'https://api.together.xyz/v1',
    [PROVIDER_TYPES.DEEPSEEK]: 'https://api.deepseek.com/v1'
};

/**
 * Get the default endpoint for a provider type, if one exists.
 * @param {string} type - Provider type string
 * @returns {string|null} Default endpoint URL or null if no default exists
 */
export function getDefaultEndpoint(type) {
    return DEFAULT_ENDPOINTS[type] || null;
}

/**
 * Provider display metadata used by the profile editor dropdown and UI.
 * `label` is the human-readable name shown in the dropdown.
 * `icon` is the boxicon class used for the profile type badge.
 */
export const PROVIDER_METADATA = Object.freeze({
    [PROVIDER_TYPES.ANTHROPIC]: { label: 'Anthropic', icon: 'bxl bx-anthropic' },
    [PROVIDER_TYPES.DEEPSEEK]: { label: 'DeepSeek', icon: 'bxl bx-deepseek' },
    [PROVIDER_TYPES.OLLAMA]: { label: 'Ollama', icon: 'bxl bx-ollama' },
    [PROVIDER_TYPES.OPENAI]: { label: 'OpenAI', icon: 'bxl bx-openai' },
    [PROVIDER_TYPES.OPENROUTER]: { label: 'OpenRouter', icon: 'bx bx-brain-circuit' },
    [PROVIDER_TYPES.TOGETHER]: { label: 'Together.ai', icon: 'bx bx-brain-circuit' }
});

/**
 * Get the icon class for a provider type, with special handling for OpenAI
 * with a custom endpoint (which uses the brain-circuit icon).
 * @param {string} type - Provider type string
 * @param {string|null} [endpoint] - Optional endpoint to customize the icon
 * @returns {string} Boxicon class string
 */
export function getProviderIcon(type, endpoint) {
    // OpenAI with a custom endpoint uses the brain-circuit icon
    if (type === PROVIDER_TYPES.OPENAI && endpoint) {
        return 'bx bx-brain-circuit';
    }
    const meta = PROVIDER_METADATA[type];
    return meta ? meta.icon : `bxl bx-${type}`;
}

/**
 * List of provider types in the order they should appear in the dropdown.
 * @returns {string[]}
 */
export function getProviderTypeList() {
    return [
        PROVIDER_TYPES.ANTHROPIC,
        PROVIDER_TYPES.DEEPSEEK,
        PROVIDER_TYPES.OLLAMA,
        PROVIDER_TYPES.OPENAI,
        PROVIDER_TYPES.OPENROUTER,
        PROVIDER_TYPES.TOGETHER
    ];
}
