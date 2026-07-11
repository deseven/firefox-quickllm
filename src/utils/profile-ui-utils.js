// Shared profile UI helpers for QuickLLM extension.
// Extracted from extension.js and settings.js to eliminate duplication.

import { getProviderIcon, getDefaultEndpoint } from '../core/providers/provider-types.js';
import { formatEndpointForDisplay } from './dom-utils.js';

/**
 * @typedef {import('../content/types.js').Profile} Profile
 */

/**
 * A partial profile shape used by the UI helpers. The UI only needs a subset
 * of the full Profile fields, and tests pass partial objects, so accept a
 * loosely-typed record here.
 * @typedef {Object<string, any>} ProfileLike
 */

/**
 * Get the boxicon class for a profile's provider type.
 * Delegates to the central provider-types registry so icon logic
 * is defined in a single place.
 * @param {ProfileLike} profile - Profile object with `type` and optional `endpoint`
 * @returns {string} Boxicon class string
 */
export function getProfileIcon(profile) {
    return getProviderIcon(profile.type, profile.endpoint);
}

/**
 * Determine whether a profile's endpoint should be displayed in the UI.
 * Only custom endpoints (those that differ from the provider default) are shown.
 * @param {ProfileLike} profile - Profile object with optional `endpoint` and `type`
 * @returns {boolean} True if the endpoint should be displayed
 */
export function shouldDisplayEndpoint(profile) {
    if (!profile.endpoint) {
        return false;
    }
    const defaultEndpoint = getDefaultEndpoint(profile.type);
    // Show endpoint if there's no default, or if it differs from the default
    return !defaultEndpoint || profile.endpoint !== defaultEndpoint;
}

/**
 * Build the display text for a profile's model, appending the endpoint
 * hostname in parentheses when the endpoint is custom.
 * @param {ProfileLike} profile - Profile object
 * @returns {string} Model display text
 */
export function getProfileModelText(profile) {
    return shouldDisplayEndpoint(profile)
        ? `${profile.model} (${formatEndpointForDisplay(profile.endpoint)})`
        : profile.model;
}
