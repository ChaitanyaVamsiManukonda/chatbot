// test_invoke_mock.js
// Invoke the Netlify function handler with a mocked 'node-fetch' to simulate OpenAI endpoints
const path = require('path');
const fs = require('fs');

(async () => {
  // Resolve node-fetch path
  let fetchPath;
  try {
    fetchPath = require.resolve('node-fetch');
  } catch (err) {
    console.error('node-fetch not found in project. Install it first.');
    process.exit(1);
  }

  const originalFetchCache = require.cache[fetchPath];

  // Create a mock fetch implementation
  const mockFetch = async (url, opts) => {
    console.log('[mockFetch] called:', url);
    // Simulate OpenAI transcription endpoint
    if (typeof url === 'string' && url.includes('/v1/audio/transcriptions')) {
      return {
        ok: true,
        json: async () => ({ text: 'this is a mocked transcription' })
      };
    }

    // Simulate OpenAI chat completions
    if (typeof url === 'string' && url.includes('/v1/chat/completions')) {
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'This is a mocked assistant reply based on transcript.' } }] })
      };
    }

    // Simulate Anthropic call (not detailed)
    if (typeof url === 'string' && url.includes('api.anthropic.com')) {
      return {
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'Mocked Claude reply' }] })
      };
    }

    // Default mock response
    return { ok: true, json: async () => ({}) };
  };

  // Insert mock into require cache for node-fetch
  require.cache[fetchPath] = {
    id: fetchPath,
    filename: fetchPath,
    loaded: true,
    exports: mockFetch
  };

  try {
    // Set env vars so the function will attempt transcription
    process.env.TRANSCRIBE_WITH_OPENAI = 'true';
    process.env.OPENAI_API_KEY = 'mock-key';

    // Load the function module (it will pick up the mocked fetch)
    const handlerModule = require('./netlify/functions/ai-query');

    // Create a fake base64 payload (pretend it's audio)
    const fakeBase64 = Buffer.from('fake-audio-bytes').toString('base64');
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        api: 'openai',
        messages: [],
        audio: fakeBase64,
        audioName: 'test_audio.webm',
        audioType: 'audio/webm'
      })
    };

    console.log('Invoking handler with mocked fetch...');
    const result = await handlerModule.handler(event, {});
    console.log('Handler result:', result);

  } catch (err) {
    console.error('Error during mocked invoke:', err);
  } finally {
    // Restore original cache
    if (originalFetchCache) require.cache[fetchPath] = originalFetchCache;
    else delete require.cache[fetchPath];
  }

})();
