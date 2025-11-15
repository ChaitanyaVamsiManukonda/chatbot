// netlify/functions/ai-query.js
const fetch = require('node-fetch');
require('dotenv').config();

// Default models
const OPENAI_DEFAULT_MODEL = 'gpt-4.1-2025-04-14';
const CLAUDE_DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const { search, loadIndex } = require('../../lib/retrieval');

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

        // Validate API selection. Allow local 'rag' mode in addition to remote APIs.
        if (api !== 'openai' && api !== 'anthropic' && api !== 'rag') {
            throw new Error('Invalid API selection');
        }

        // Get API keys from environment variables (read early so transcription can use it)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // If audio was provided, decode and save it, then optionally transcribe
    let transcript = null;
    // Make retrieved visible to outer scope so rag-mode can access it below
    let retrieved = [];
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

        // Basic retrieval augmentation (TF-IDF). If an index exists, search for relevant passages
        try {
            // ensure messages array
            const msgs = Array.isArray(messages) ? messages : [];
            // find last user message to use as query
            const lastUser = [...msgs].reverse().find(m => m && m.role === 'user' && typeof m.content === 'string');
            const userQuery = lastUser ? lastUser.content : null;
            retrieved = [];
            if (userQuery) {
                retrieved = search(userQuery, 5);
            }

            // If the client explicitly requested local RAG answers, return a local RAG-generated message
            if (api === 'rag') {
                if (!retrieved || retrieved.length === 0) {
                    return { statusCode: 200, body: JSON.stringify({ message: 'No relevant documents found in the index.', transcript }) };
                }
                // Create a concise extractive answer: score sentences across retrieved passages by overlap with query terms
                const queryTokens = (userQuery || '').toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
                const sentences = [];
                retrieved.slice(0, 6).forEach((doc, di) => {
                    const parts = (doc.text || '').split(/(?<=[.!?])\s+/);
                    parts.forEach((s, si) => {
                        const clean = s.replace(/\s+/g, ' ').trim();
                        if (clean.length > 8) {
                            sentences.push({ docIndex: di, text: clean, title: doc.title || '' });
                        }
                    });
                });

                function sentenceScore(s) {
                    const words = (s.text || '').toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
                    if (words.length === 0) return 0;
                    let matches = 0;
                    const uniq = new Set(words);
                    queryTokens.forEach(q => { if (uniq.has(q)) matches++; });
                    return matches / Math.sqrt(words.length);
                }

                const scored = sentences.map(s => ({ ...s, score: sentenceScore(s) }));
                scored.sort((a,b) => b.score - a.score);
                // pick top sentences (max 4) and keep them in doc order where possible
                const topSentences = scored.slice(0, 6).filter(s => s.score > 0);
                let answer = '';
                if (topSentences.length > 0) {
                    // group by docIndex to keep context
                    const grouped = {};
                    topSentences.forEach(s => { grouped[s.docIndex] = grouped[s.docIndex] || []; grouped[s.docIndex].push(s.text); });
                    const parts = Object.keys(grouped).map(k => grouped[k].join(' '));
                    answer = parts.join('\n\n');
                } else {
                    // fallback: concatenate top passages
                    answer = retrieved.slice(0,3).map(r => (r.title ? r.title + ': ' : '') + r.text).join('\n\n');
                }

                const truncated = answer.length > 2000 ? answer.slice(0,2000) + '... (truncated)' : answer;
                return { statusCode: 200, body: JSON.stringify({ message: truncated, transcript, retrieved: retrieved.slice(0,5) }) };
            }

            // If we have retrieved results but no API keys configured, return them directly (no-cost mode)
            if (retrieved && retrieved.length > 0 && !OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: null, transcript: transcript, retrieved })
                };
            }

            // If we have retrieved results and an API key is present, inject them as a system message
            if (retrieved && retrieved.length > 0) {
                const combined = retrieved.map((r, i) => `[[${i+1}] ${r.title || 'doc'}]\n${r.text}`).join('\n\n---\n\n');
                // prepend a system message with retrieved context
                if (Array.isArray(messages)) {
                    messages.unshift({ role: 'system', content: `Retrieved documents:\n${combined}` });
                }
            }
        } catch (err) {
            console.error('Retrieval error:', err.message);
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