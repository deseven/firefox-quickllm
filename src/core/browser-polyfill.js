// Cross-browser compatibility polyfill
// Chrome uses 'chrome' API, Firefox uses 'browser' API
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    // Create a promisified version of Chrome APIs
    globalThis.browser = {
        runtime: {
            onMessage: chrome.runtime.onMessage,
            onInstalled: chrome.runtime.onInstalled,
            onStartup: chrome.runtime.onStartup,
            sendMessage: (message) => {
                return new Promise((resolve, reject) => {
                    try {
                        chrome.runtime.sendMessage(message, (response) => {
                            if (chrome.runtime.lastError) {
                                // Handle common Chrome extension errors more gracefully
                                const error = chrome.runtime.lastError.message;
                                if (error.includes('Receiving end does not exist') ||
                                    error.includes('Could not establish connection') ||
                                    error.includes('message port closed before a response was received')) {
                                    console.warn('Extension context invalidated:', error);
                                    // For these errors, resolve with null instead of rejecting
                                    resolve(null);
                                } else {
                                    reject(new Error(error));
                                }
                            } else {
                                resolve(response);
                            }
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            },
            getURL: chrome.runtime.getURL
        },
        storage: {
            local: {
                get: (keys) => {
                    return new Promise((resolve, reject) => {
                        chrome.storage.local.get(keys, (result) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(result);
                            }
                        });
                    });
                },
                set: (data) => {
                    return new Promise((resolve, reject) => {
                        chrome.storage.local.set(data, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve();
                            }
                        });
                    });
                }
            }
        },
        contextMenus: chrome.contextMenus ? {
            removeAll: chrome.contextMenus.removeAll,
            create: chrome.contextMenus.create,
            onClicked: chrome.contextMenus.onClicked
        } : {
            removeAll: () => {},
            create: () => {},
            onClicked: { addListener: () => {} }
        },
        commands: chrome.commands ? {
            onCommand: chrome.commands.onCommand
        } : {
            onCommand: { addListener: () => {} }
        },
        tabs: {
            query: (queryInfo, callback) => {
                if (callback) {
                    chrome.tabs.query(queryInfo, callback);
                } else {
                    return new Promise((resolve, reject) => {
                        chrome.tabs.query(queryInfo, (tabs) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(tabs);
                            }
                        });
                    });
                }
            },
            sendMessage: (tabId, message, callback) => {
                if (callback) {
                    chrome.tabs.sendMessage(tabId, message, callback);
                } else {
                    return new Promise((resolve, reject) => {
                        try {
                            chrome.tabs.sendMessage(tabId, message, (response) => {
                                if (chrome.runtime.lastError) {
                                    const error = chrome.runtime.lastError.message;
                                    if (error.includes('Receiving end does not exist') ||
                                        error.includes('Could not establish connection') ||
                                        error.includes('message port closed before a response was received')) {
                                        console.warn('Tab context invalidated:', error);
                                        // For tab messages, we can't easily retry, so just resolve with null
                                        resolve(null);
                                    } else {
                                        reject(new Error(error));
                                    }
                                } else {
                                    resolve(response);
                                }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                }
            },
            create: (createProperties) => {
                return new Promise((resolve, reject) => {
                    chrome.tabs.create(createProperties, (tab) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(tab);
                        }
                    });
                });
            }
        },
        browserAction: chrome.browserAction ? {
            openPopup: chrome.browserAction.openPopup
        } : {
            openPopup: () => {}
        }
    };
}