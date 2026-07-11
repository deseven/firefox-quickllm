// Test setup: mock the WebExtension `browser` global API.
// The provider base class calls browser.tabs.sendMessage() during streaming
// to push updates to the content script. In tests we capture these calls
// so tests can assert on the streamed content.

import { vi } from 'vitest';

// Each test can reset/inspect this mock via vi.mocked()
global.browser = {
    tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    runtime: {
        onMessage: { addListener: vi.fn() },
    },
    contextMenus: {
        removeAll: vi.fn((cb) => cb && cb()),
        create: vi.fn(),
        onClicked: { addListener: vi.fn() },
    },
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
        },
    },
    commands: {
        onCommand: { addListener: vi.fn() },
    },
    runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
    },
    browserAction: {
        openPopup: vi.fn(),
    },
};
