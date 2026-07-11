// Tests for base-provider.js — the abstract base class that owns the
// streaming loop, cancellation, mergeExtraOptions, and streamUpdate messaging.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseProvider } from './base-provider.js';

// A concrete test subclass that lets us control the chunks emitted and
// the content extracted from each chunk.
class TestProvider extends BaseProvider {
    /**
     * @param {any[]} [chunks]
     * @param {string} [responseContent]
     */
    constructor(chunks = [], responseContent = 'final-response') {
        super();
        this._chunks = chunks;
        this._responseContent = responseContent;
        this.createClient = vi.fn(() => ({ mock: true }));
    }

    /**
     * @param {any} context
     * @param {boolean} isStream
     */
    buildRequestParams(context, isStream) {
        return { model: context.model, messages: [{ role: 'user', content: context.text }] };
    }

    /** @param {any} chunk */
    extractContent(chunk) {
        return chunk.text || '';
    }

    /** @param {any} response */
    extractResponseContent(response) {
        return this._responseContent;
    }

    // Override executeRequest to return a fake async iterable for streaming,
    // or a fake response object for non-streaming.
    /**
     * @param {any} client
     * @param {any} params
     */
    async executeRequest(client, params) {
        if (params.stream) {
            const chunks = this._chunks;
            return {
                async *[Symbol.asyncIterator]() {
                    for (const chunk of chunks) {
                        yield chunk;
                    }
                }
            };
        }
        return { mockResponse: true };
    }
}

function makeContext(overrides = {}) {
    return {
        apiKey: 'test-key',
        endpoint: 'https://example.com/v1',
        model: 'test-model',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Summarize this.',
        text: 'Hello world',
        extraOptions: null,
        isStreaming: false,
        tabId: 42,
        streamId: 'stream-123',
        streamController: { cancelled: false },
        ...overrides
    };
}

describe('BaseProvider.mergeExtraOptions', () => {
    const provider = new TestProvider();

    it('returns baseOptions unchanged when extraOptions is null', () => {
        const base = { model: 'gpt-4', messages: [] };
        expect(provider.mergeExtraOptions(base, null)).toBe(base);
    });

    it('returns baseOptions unchanged when extraOptions is undefined', () => {
        const base = { model: 'gpt-4', messages: [] };
        expect(provider.mergeExtraOptions(base, undefined)).toBe(base);
    });

    it('merges valid JSON extra options into base options', () => {
        const base = { model: 'gpt-4', messages: [] };
        const result = provider.mergeExtraOptions(base, '{"temperature":0.7,"top_p":0.9}');
        expect(result.temperature).toBe(0.7);
        expect(result.top_p).toBe(0.9);
    });

    it('protects critical base fields from being overwritten by extra options', () => {
        const base = { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] };
        // extraOptions tries to override model and messages
        const result = provider.mergeExtraOptions(base, '{"model":"hacked","messages":["evil"]}');
        expect(result.model).toBe('gpt-4');
        expect(result.messages).toEqual([{ role: 'user', content: 'hi' }]);
    });

    it('returns baseOptions unchanged when extraOptions is invalid JSON', () => {
        const base = { model: 'gpt-4', messages: [] };
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = provider.mergeExtraOptions(base, '{invalid json');
        expect(result).toBe(base);
        expect(warnSpy).toHaveBeenCalledWith(
            'Invalid extra options JSON, ignoring:',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });
});

describe('BaseProvider.process (non-streaming)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the extracted response content for non-streaming requests', async () => {
        const provider = new TestProvider([], 'non-stream-result');
        const context = makeContext({ isStreaming: false });
        const result = await provider.process(context);
        expect(result).toBe('non-stream-result');
    });

    it('calls createClient with the context', async () => {
        const provider = new TestProvider([], 'result');
        const context = makeContext({ isStreaming: false });
        await provider.process(context);
        expect(provider.createClient).toHaveBeenCalledWith(context);
    });

    it('throws if cancelled before the request starts', async () => {
        const provider = new TestProvider([], 'result');
        const context = makeContext({
            isStreaming: false,
            streamController: { cancelled: true }
        });
        await expect(provider.process(context)).rejects.toThrow('Request cancelled');
    });
});

describe('BaseProvider.process (streaming)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('accumulates content from chunks and returns the full response', async () => {
        const chunks = [
            { text: 'Hello' },
            { text: ' ' },
            { text: 'world' }
        ];
        const provider = new TestProvider(chunks);
        const context = makeContext({ isStreaming: true });
        const result = await provider.process(context);
        expect(result).toBe('Hello world');
    });

    it('sends streamUpdate messages to the content script for each chunk', async () => {
        const chunks = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];
        const provider = new TestProvider(chunks);
        const context = makeContext({ isStreaming: true, tabId: 99, streamId: 's1' });
        await provider.process(context);

        expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(3);
        // First message: accumulated "A"
        expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(1, 99, {
            type: 'streamUpdate',
            content: 'A',
            streamId: 's1'
        });
        // Second: "AB"
        expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(2, 99, {
            type: 'streamUpdate',
            content: 'AB',
            streamId: 's1'
        });
        // Third: "ABC"
        expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(3, 99, {
            type: 'streamUpdate',
            content: 'ABC',
            streamId: 's1'
        });
    });

    it('skips chunks with empty content (no streamUpdate sent)', async () => {
        const chunks = [{ text: 'A' }, { text: '' }, { text: 'B' }];
        const provider = new TestProvider(chunks);
        const context = makeContext({ isStreaming: true });
        await provider.process(context);

        // Only 2 messages: "A" and "AB"
        expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('stops streaming when cancelled mid-stream', async () => {
        const controller = { cancelled: false };
        const chunks = [
            { text: 'A' },
            { text: 'B' },
            { text: 'C' }
        ];
        const provider = new TestProvider(chunks);
        const context = makeContext({ isStreaming: true, streamController: controller });

        // Cancel after the first chunk is processed.
        // We intercept sendMessage to flip the cancelled flag.
        browser.tabs.sendMessage.mockImplementationOnce(() => {
            controller.cancelled = true;
            return Promise.resolve();
        });

        const result = await provider.process(context);
        // Only "A" was accumulated before cancellation
        expect(result).toBe('A');
        // Only one message was sent before cancellation
        expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('throws if cancelled before streaming starts', async () => {
        const provider = new TestProvider([{ text: 'A' }]);
        const context = makeContext({
            isStreaming: true,
            streamController: { cancelled: true }
        });
        await expect(provider.process(context)).rejects.toThrow('Request cancelled');
    });

    it('passes stream:true in the request params for streaming', async () => {
        const chunks = [{ text: 'A' }];
        const provider = new TestProvider(chunks);
        const executeSpy = vi.spyOn(provider, 'executeRequest');
        const context = makeContext({ isStreaming: true });
        await provider.process(context);

        const calledParams = executeSpy.mock.calls[0][1];
        expect(calledParams.stream).toBe(true);
    });

    it('merges extra options into streaming params', async () => {
        const chunks = [{ text: 'A' }];
        const provider = new TestProvider(chunks);
        const executeSpy = vi.spyOn(provider, 'executeRequest');
        const context = makeContext({
            isStreaming: true,
            extraOptions: '{"temperature":0.5}'
        });
        await provider.process(context);

        const calledParams = executeSpy.mock.calls[0][1];
        expect(calledParams.temperature).toBe(0.5);
        expect(calledParams.stream).toBe(true);
    });
});

describe('BaseProvider abstract methods', () => {
    it('throws when createClient is not overridden', () => {
        const provider = new BaseProvider();
        expect(() => provider.createClient(/** @type {any} */ ({}))).toThrow('createClient() must be implemented by subclass');
    });

    it('throws when buildRequestParams is not overridden', () => {
        const provider = new BaseProvider();
        expect(() => provider.buildRequestParams(/** @type {any} */ ({}), false)).toThrow('buildRequestParams() must be implemented by subclass');
    });

    it('throws when extractContent is not overridden', () => {
        const provider = new BaseProvider();
        expect(() => provider.extractContent({})).toThrow('extractContent() must be implemented by subclass');
    });

    it('throws when extractResponseContent is not overridden', () => {
        const provider = new BaseProvider();
        expect(() => provider.extractResponseContent({})).toThrow('extractResponseContent() must be implemented by subclass');
    });
});
