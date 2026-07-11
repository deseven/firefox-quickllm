// Tests for the concrete provider implementations.
// These test buildRequestParams, extractContent, and extractResponseContent
// without making real network calls. The SDK clients are mocked via vi.mock.
import { describe, it, expect, vi } from 'vitest';

// Mock the SDK modules so importing the providers doesn't pull in heavy deps.
vi.mock('openai', () => ({ default: class MockOpenAI {} }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class MockAnthropic {} }));
vi.mock('ollama/browser', () => ({ Ollama: class MockOllama {} }));

import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';

function makeContext(overrides = {}) {
    return {
        apiKey: 'test-key',
        endpoint: 'https://api.example.com/v1',
        model: 'test-model',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Summarize this.',
        text: 'Hello world',
        extraOptions: null,
        isStreaming: false,
        tabId: 1,
        streamId: 's1',
        streamController: { cancelled: false },
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// OpenAIProvider
// ---------------------------------------------------------------------------

describe('OpenAIProvider', () => {
    const provider = new OpenAIProvider();

    describe('buildRequestParams', () => {
        it('builds messages with system, user prompt, and text', () => {
            const params = provider.buildRequestParams(makeContext(), false);
            expect(params.model).toBe('test-model');
            expect(params.messages).toEqual([
                { role: 'system', content: 'You are helpful.' },
                { role: 'user', content: 'Summarize this.' },
                { role: 'user', content: 'Hello world' }
            ]);
        });

        it('omits system prompt when not provided', () => {
            const params = provider.buildRequestParams(makeContext({ systemPrompt: '' }), false);
            expect(params.messages).toEqual([
                { role: 'user', content: 'Summarize this.' },
                { role: 'user', content: 'Hello world' }
            ]);
        });

        it('omits user prompt when not provided', () => {
            const params = provider.buildRequestParams(makeContext({ userPrompt: '' }), false);
            expect(params.messages).toEqual([
                { role: 'system', content: 'You are helpful.' },
                { role: 'user', content: 'Hello world' }
            ]);
        });

        it('always includes the text as the final user message', () => {
            const params = provider.buildRequestParams(makeContext({ systemPrompt: '', userPrompt: '' }), false);
            expect(params.messages).toEqual([
                { role: 'user', content: 'Hello world' }
            ]);
        });
    });

    describe('extractContent', () => {
        it('extracts delta content from a chunk', () => {
            const chunk = { choices: [{ delta: { content: 'Hello' } }] };
            expect(provider.extractContent(chunk)).toBe('Hello');
        });

        it('returns empty string when delta content is missing', () => {
            const chunk = { choices: [{ delta: {} }] };
            expect(provider.extractContent(chunk)).toBe('');
        });

        it('returns empty string when choices is empty', () => {
            const chunk = { choices: [] };
            expect(provider.extractContent(chunk)).toBe('');
        });

        it('returns empty string when choices is undefined', () => {
            expect(provider.extractContent({})).toBe('');
        });
    });

    describe('extractResponseContent', () => {
        it('extracts the message content from a completion', () => {
            const response = { choices: [{ message: { content: 'result text' } }] };
            expect(provider.extractResponseContent(response)).toBe('result text');
        });
    });

    describe('createClient', () => {
        it('creates a client instance', () => {
            const client = provider.createClient(makeContext());
            expect(client).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

describe('AnthropicProvider', () => {
    const provider = new AnthropicProvider();

    describe('buildRequestParams', () => {
        it('builds params with model, messages, max_tokens, and system', () => {
            const params = provider.buildRequestParams(makeContext(), false);
            expect(params.model).toBe('test-model');
            expect(params.max_tokens).toBe(4096);
            expect(params.system).toBe('You are helpful.');
            // Anthropic does not use a system message in the messages array
            expect(params.messages).toEqual([
                { role: 'user', content: 'Summarize this.' },
                { role: 'user', content: 'Hello world' }
            ]);
        });

        it('omits system field when systemPrompt is empty', () => {
            const params = provider.buildRequestParams(makeContext({ systemPrompt: '' }), false);
            expect(params.system).toBeUndefined();
        });

        it('omits user prompt message when not provided', () => {
            const params = provider.buildRequestParams(makeContext({ userPrompt: '' }), false);
            expect(params.messages).toEqual([
                { role: 'user', content: 'Hello world' }
            ]);
        });

        it('always includes max_tokens (required by Anthropic API)', () => {
            const params = provider.buildRequestParams(makeContext(), false);
            expect(params.max_tokens).toBe(4096);
        });
    });

    describe('extractContent', () => {
        it('extracts text from a content_block_delta chunk', () => {
            const chunk = { type: 'content_block_delta', delta: { text: 'Hello' } };
            expect(provider.extractContent(chunk)).toBe('Hello');
        });

        it('returns empty string for non-content_block_delta chunks', () => {
            const chunk = { type: 'message_start' };
            expect(provider.extractContent(chunk)).toBe('');
        });

        it('returns empty string when delta.text is missing', () => {
            const chunk = { type: 'content_block_delta', delta: {} };
            expect(provider.extractContent(chunk)).toBe('');
        });
    });

    describe('extractResponseContent', () => {
        it('extracts the first content block text', () => {
            const response = { content: [{ text: 'result' }, { text: 'ignored' }] };
            expect(provider.extractResponseContent(response)).toBe('result');
        });
    });
});

// ---------------------------------------------------------------------------
// OllamaProvider
// ---------------------------------------------------------------------------

describe('OllamaProvider', () => {
    const provider = new OllamaProvider();

    describe('buildRequestParams', () => {
        it('builds a concatenated prompt with system and user prompts', () => {
            const params = provider.buildRequestParams(makeContext(), false);
            expect(params.model).toBe('test-model');
            expect(params.prompt).toBe('You are helpful.\n\nSummarize this.\n\nHello world');
        });

        it('omits system prompt when not provided', () => {
            const params = provider.buildRequestParams(makeContext({ systemPrompt: '' }), false);
            expect(params.prompt).toBe('Summarize this.\n\nHello world');
        });

        it('omits user prompt when not provided', () => {
            const params = provider.buildRequestParams(makeContext({ userPrompt: '' }), false);
            expect(params.prompt).toBe('You are helpful.\n\nHello world');
        });

        it('includes only the text when no prompts are provided', () => {
            const params = provider.buildRequestParams(makeContext({ systemPrompt: '', userPrompt: '' }), false);
            expect(params.prompt).toBe('Hello world');
        });
    });

    describe('extractContent', () => {
        it('extracts the response field from a chunk', () => {
            expect(provider.extractContent({ response: 'Hello' })).toBe('Hello');
        });

        it('returns empty string when response is missing', () => {
            expect(provider.extractContent({})).toBe('');
        });
    });

    describe('extractResponseContent', () => {
        it('extracts the response field', () => {
            expect(provider.extractResponseContent({ response: 'final' })).toBe('final');
        });
    });

    describe('createClient', () => {
        it('creates a client with the provided endpoint', () => {
            const client = provider.createClient(makeContext({ endpoint: 'http://localhost:11434' }));
            expect(client).toBeDefined();
        });

        it('creates a client with default host when endpoint is falsy', () => {
            const client = provider.createClient(makeContext({ endpoint: null }));
            expect(client).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// SDK method dispatch — verifies each provider calls the correct SDK method
// with the correct params. This guards against regressions like the Anthropic
// bug where executeRequest fell through to client.chat.completions.create().
// ---------------------------------------------------------------------------

describe('Provider SDK method dispatch', () => {
    // Helper: create a mock SDK client with spy methods for every possible
    // SDK call path. Each provider should only call the one that matches its API.
    function makeMockClient() {
        const createSpy = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'openai-result' } }]
        });
        const messagesCreateSpy = vi.fn().mockResolvedValue({
            content: [{ text: 'anthropic-result' }]
        });
        const generateSpy = vi.fn().mockResolvedValue({
            response: 'ollama-result'
        });

        return {
            spies: { createSpy, messagesCreateSpy, generateSpy },
            client: {
                // OpenAI SDK: client.chat.completions.create()
                chat: { completions: { create: createSpy } },
                // Anthropic SDK: client.messages.create()
                messages: { create: messagesCreateSpy },
                // Ollama SDK: client.generate()
                generate: generateSpy
            }
        };
    }

    // Helper: create a mock streaming client that yields given chunks
    function makeMockStreamingClient(chunks) {
        const createSpy = vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
                for (const chunk of chunks) yield chunk;
            }
        });
        const messagesCreateSpy = vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
                for (const chunk of chunks) yield chunk;
            }
        });
        const generateSpy = vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
                for (const chunk of chunks) yield chunk;
            }
        });

        return {
            spies: { createSpy, messagesCreateSpy, generateSpy },
            client: {
                chat: { completions: { create: createSpy } },
                messages: { create: messagesCreateSpy },
                generate: generateSpy
            }
        };
    }

    describe('OpenAIProvider', () => {
        it('calls client.chat.completions.create() for non-streaming requests', async () => {
            const provider = new OpenAIProvider();
            const { spies, client } = makeMockClient();
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: false });
            const result = await provider.process(context);

            expect(spies.createSpy).toHaveBeenCalledTimes(1);
            expect(spies.messagesCreateSpy).not.toHaveBeenCalled();
            expect(spies.generateSpy).not.toHaveBeenCalled();
            expect(result).toBe('openai-result');
        });

        it('calls client.chat.completions.create() with stream:true for streaming requests', async () => {
            const provider = new OpenAIProvider();
            const chunks = [{ choices: [{ delta: { content: 'Hi' } }] }];
            const { spies, client } = makeMockStreamingClient(chunks);
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: true });
            await provider.process(context);

            expect(spies.createSpy).toHaveBeenCalledTimes(1);
            const calledParams = spies.createSpy.mock.calls[0][0];
            expect(calledParams.stream).toBe(true);
            expect(spies.messagesCreateSpy).not.toHaveBeenCalled();
            expect(spies.generateSpy).not.toHaveBeenCalled();
        });
    });

    describe('AnthropicProvider', () => {
        it('calls client.messages.create() for non-streaming requests', async () => {
            const provider = new AnthropicProvider();
            const { spies, client } = makeMockClient();
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: false });
            const result = await provider.process(context);

            expect(spies.messagesCreateSpy).toHaveBeenCalledTimes(1);
            expect(spies.createSpy).not.toHaveBeenCalled();
            expect(spies.generateSpy).not.toHaveBeenCalled();
            expect(result).toBe('anthropic-result');
        });

        it('calls client.messages.create() with stream:true for streaming requests', async () => {
            const provider = new AnthropicProvider();
            const chunks = [{ type: 'content_block_delta', delta: { text: 'Hi' } }];
            const { spies, client } = makeMockStreamingClient(chunks);
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: true });
            await provider.process(context);

            expect(spies.messagesCreateSpy).toHaveBeenCalledTimes(1);
            const calledParams = spies.messagesCreateSpy.mock.calls[0][0];
            expect(calledParams.stream).toBe(true);
            expect(spies.createSpy).not.toHaveBeenCalled();
            expect(spies.generateSpy).not.toHaveBeenCalled();
        });

        it('never calls client.chat.completions.create()', async () => {
            const provider = new AnthropicProvider();

            // Non-streaming call
            const nonStreamMock = makeMockClient();
            vi.spyOn(provider, 'createClient').mockReturnValue(nonStreamMock.client);
            await provider.process(makeContext({ isStreaming: false }));

            // Streaming call (needs async iterable response)
            const streamMock = makeMockStreamingClient([
                { type: 'content_block_delta', delta: { text: 'Hi' } }
            ]);
            vi.spyOn(provider, 'createClient').mockReturnValue(streamMock.client);
            await provider.process(makeContext({ isStreaming: true }));

            expect(nonStreamMock.spies.createSpy).not.toHaveBeenCalled();
            expect(streamMock.spies.createSpy).not.toHaveBeenCalled();
        });
    });

    describe('OllamaProvider', () => {
        it('calls client.generate() for non-streaming requests', async () => {
            const provider = new OllamaProvider();
            const { spies, client } = makeMockClient();
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: false });
            const result = await provider.process(context);

            expect(spies.generateSpy).toHaveBeenCalledTimes(1);
            expect(spies.createSpy).not.toHaveBeenCalled();
            expect(spies.messagesCreateSpy).not.toHaveBeenCalled();
            expect(result).toBe('ollama-result');
        });

        it('calls client.generate() with stream:true for streaming requests', async () => {
            const provider = new OllamaProvider();
            const chunks = [{ response: 'Hi' }];
            const { spies, client } = makeMockStreamingClient(chunks);
            vi.spyOn(provider, 'createClient').mockReturnValue(client);

            const context = makeContext({ isStreaming: true });
            await provider.process(context);

            expect(spies.generateSpy).toHaveBeenCalledTimes(1);
            const calledParams = spies.generateSpy.mock.calls[0][0];
            expect(calledParams.stream).toBe(true);
            expect(spies.createSpy).not.toHaveBeenCalled();
            expect(spies.messagesCreateSpy).not.toHaveBeenCalled();
        });

        it('never calls client.chat.completions.create()', async () => {
            const provider = new OllamaProvider();

            // Non-streaming call
            const nonStreamMock = makeMockClient();
            vi.spyOn(provider, 'createClient').mockReturnValue(nonStreamMock.client);
            await provider.process(makeContext({ isStreaming: false }));

            // Streaming call (needs async iterable response)
            const streamMock = makeMockStreamingClient([{ response: 'Hi' }]);
            vi.spyOn(provider, 'createClient').mockReturnValue(streamMock.client);
            await provider.process(makeContext({ isStreaming: true }));

            expect(nonStreamMock.spies.createSpy).not.toHaveBeenCalled();
            expect(streamMock.spies.createSpy).not.toHaveBeenCalled();
        });
    });
});
