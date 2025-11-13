// netlify/functions/ai-query.js
const fetch = require('node-fetch');
require('dotenv').config();

// Default models
const OPENAI_DEFAULT_MODEL = 'gpt-4.1-2025-04-14';
const CLAUDE_DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body);
        const { api, messages } = data;

        // Support for audio upload: data.audio (base64), data.audioName, data.audioType
        const audioBase64 = data.audio;
        const audioName = data.audioName || `upload_${Date.now()}.webm`;
        const audioType = data.audioType || 'audio/webm';

        // Validate API selection
        if (api !== 'openai' && api !== 'anthropic') {
            throw new Error('Invalid API selection');
        }

    // Get API keys from environment variables (read early so transcription can use it)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // If audio was provided, decode and save it, then optionally transcribe
    let transcript = null;
        if (audioBase64) {
            const fs = require('fs');
            const os = require('os');
            const path = require('path');
            const tmpDir = os.tmpdir();
            const tmpPath = path.join(tmpDir, audioName);

            const buffer = Buffer.from(audioBase64, 'base64');
            fs.writeFileSync(tmpPath, buffer);
            console.log(`Saved uploaded audio to ${tmpPath} (${buffer.length} bytes)`);

            // If enabled, try to transcribe with OpenAI's audio transcription endpoint.
            // To enable automatic transcription set TRANSCRIBE_WITH_OPENAI=true in environment variables
            // and set OPENAI_API_KEY. This code will attempt to require 'form-data' — install it if needed.
            if (process.env.TRANSCRIBE_WITH_OPENAI === 'true' && OPENAI_API_KEY) {
                try {
                    const FormData = require('form-data');
                    const form = new FormData();
                    form.append('file', fs.createReadStream(tmpPath));
                    // model name may vary; use a common Whisper-compatible model name
                    form.append('model', 'whisper-1');

                    const transcriptionResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${OPENAI_API_KEY}`
                        },
                        body: form
                    });

                    if (transcriptionResp.ok) {
                        const trJson = await transcriptionResp.json();
                        transcript = trJson.text || null;
                        console.log('Transcription result:', transcript);
                    } else {
                        console.error('Transcription API error', transcriptionResp.status);
                    }
                } catch (err) {
                    console.error('Transcription failed or form-data not installed:', err.message);
                }
            } else {
                console.log('Automatic transcription not enabled or OpenAI API key missing.');
            }

            // If a transcript exists, append it to the messages so the model can respond to it
            if (transcript) {
                if (Array.isArray(messages)) {
                    messages.push({ role: 'user', content: transcript });
                }
            }
        }

    console.log(`OpenAI API Key defined: ${Boolean(OPENAI_API_KEY)}`);
    console.log(`Anthropic API Key defined: ${Boolean(ANTHROPIC_API_KEY)}`);

        let response;
        let assistantMessage;

        if (api === 'openai') {
            // Call OpenAI API
            if (!OPENAI_API_KEY) {
                throw new Error('OpenAI API key is not configured');
            }

            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OPENAI_DEFAULT_MODEL,
                    messages: messages,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('OpenAI API Error:', errorData);
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const responseData = await response.json();
            assistantMessage = responseData.choices[0].message.content;
        } else {
            // Call Anthropic API
            if (!ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key is not configured');
            }

            // Format messages for Anthropic API
            const formattedMessages = messages.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' 
                    ? [{ type: 'text', text: msg.content }] 
                    : msg.content
            }));

            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'anthropic-version': '2023-06-01',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CLAUDE_DEFAULT_MODEL,
                    messages: formattedMessages,
                    max_tokens: 1024,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Anthropic API Error:', errorData);
                throw new Error(`Anthropic API error: ${response.status}`);
            }

            const responseData = await response.json();
            
            // Check if the response has content array and extract the text
            if (responseData.content && Array.isArray(responseData.content)) {
                // Find the first text content
                const textContent = responseData.content.find(item => item.type === 'text');
                if (textContent && textContent.text) {
                    assistantMessage = textContent.text;
                } else {
                    throw new Error('Unexpected response format from Anthropic API');
                }
            } else {
                throw new Error('Unexpected response format from Anthropic API');
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: assistantMessage, transcript: transcript })
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};